import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';

const MAX_FILE_BYTES = 8 * 1024 * 1024;

class TransientFailure extends Error {}

async function filesUnder(directory, prefix = '') {
  const entries = await readdir(directory, { withFileTypes: true });
  const results = [];
  for (const entry of entries) {
    const relative = path.posix.join(prefix, entry.name);
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      results.push(...await filesUnder(absolute, relative));
    } else if (entry.isFile()) {
      results.push({ absolute, relative });
    }
  }
  return results;
}

async function checkDist(distDirectory) {
  const files = await filesUnder(distDirectory);
  if (!files.some(({ relative }) => relative === 'index.html')) {
    throw new Error('frontend/dist/index.html이 없습니다.');
  }

  for (const file of files) {
    const metadata = await stat(file.absolute);
    if (metadata.size >= MAX_FILE_BYTES) {
      throw new Error(`${file.relative} 파일이 8MiB 이상입니다.`);
    }
    if (file.relative === 'index.html') continue;
    if (!file.relative.startsWith('assets/')) {
      throw new Error(`index.html 외 비해시 산출물은 배포할 수 없습니다: ${file.relative}`);
    }
    if (!/-[A-Za-z0-9_-]{8,}\.[^/]+$/.test(file.relative)) {
      throw new Error(`assets 파일명이 Vite 내용 해시 형식이 아닙니다: ${file.relative}`);
    }
  }
}

async function fetchChecked(url) {
  let response;
  try {
    response = await fetch(url, { redirect: 'manual' });
  } catch (error) {
    throw new TransientFailure(`연결 실패: ${url} (${error.message})`);
  }
  if (response.status >= 500 && response.status <= 599) {
    throw new TransientFailure(`일시적 서버 오류: ${url} (${response.status})`);
  }
  return response;
}

function header(response, name) {
  return response.headers.get(name) || '';
}

async function assertHtml(baseUrl, pathname) {
  const response = await fetchChecked(new URL(pathname, baseUrl));
  const body = await response.text();
  if (response.status !== 200 || !header(response, 'content-type').includes('text/html')) {
    throw new Error(`${pathname}은 HTML 200이어야 합니다. 실제: ${response.status} ${header(response, 'content-type')}`);
  }
  if (!/<div\s+id=["']root["']\s*>/i.test(body)) {
    throw new Error(`${pathname} 응답에 React mount 지점이 없습니다.`);
  }
  return body;
}

function assetPaths(indexHtml) {
  const paths = new Set();
  for (const match of indexHtml.matchAll(/(?:src|href)=["'](\/assets\/[^"']+)["']/g)) {
    paths.add(match[1]);
  }
  return [...paths];
}

function assertAssetContentType(assetPath, contentType) {
  if (assetPath.endsWith('.js') && !/(javascript|ecmascript)/i.test(contentType)) {
    throw new Error(`${assetPath}의 JavaScript Content-Type이 올바르지 않습니다: ${contentType}`);
  }
  if (assetPath.endsWith('.css') && !/^text\/css(?:;|$)/i.test(contentType)) {
    throw new Error(`${assetPath}의 CSS Content-Type이 올바르지 않습니다: ${contentType}`);
  }
}

async function assertAssets(baseUrl, indexHtml) {
  const paths = assetPaths(indexHtml);
  if (paths.length === 0) throw new Error('index.html에서 /assets 참조를 찾지 못했습니다.');

  for (const assetPath of paths) {
    const response = await fetchChecked(new URL(assetPath, baseUrl));
    if (response.status !== 200) {
      throw new Error(`${assetPath}은 200이어야 합니다. 실제: ${response.status}`);
    }
    assertAssetContentType(assetPath, header(response, 'content-type'));
    const cacheControl = header(response, 'cache-control').replaceAll(' ', '');
    if (!cacheControl.includes('public,max-age=31536000,immutable')) {
      throw new Error(`${assetPath}의 immutable cache header가 없습니다: ${cacheControl}`);
    }
  }
}

async function assertMissing(baseUrl, pathname) {
  const response = await fetchChecked(new URL(pathname, baseUrl));
  const body = await response.text();
  if (![403, 404].includes(response.status)) {
    throw new Error(`${pathname} 누락 경로는 403 또는 404여야 합니다. 실제: ${response.status}`);
  }
  if (/<div\s+id=["']root["']\s*>/i.test(body)) {
    throw new Error(`${pathname} 누락 경로가 index.html을 반환했습니다.`);
  }
}

async function smoke(baseUrl) {
  const indexHtml = await assertHtml(baseUrl, '/');
  await assertHtml(baseUrl, '/admin');
  await assertHtml(baseUrl, '/status/TEST');
  await assertAssets(baseUrl, indexHtml);
  const nonce = Date.now();
  await assertMissing(baseUrl, `/assets/__smoke_missing_${nonce}.js`);
  await assertMissing(baseUrl, `/api/__smoke_missing_${nonce}`);
}

const [mode, ...args] = process.argv.slice(2);
try {
  if (mode === 'dist' && args.length === 1) {
    await checkDist(args[0]);
  } else if (mode === 'smoke' && args.length === 2) {
    await smoke(args[0]);
  } else {
    throw new Error('사용법: dist <frontend/dist> | smoke <base-url> <frontend/dist>');
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = error instanceof TransientFailure ? 75 : 1;
}
