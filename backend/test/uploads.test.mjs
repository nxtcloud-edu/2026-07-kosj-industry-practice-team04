import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { handleRequest } from '../src/router.js';

/**
 * 사진 실제 저장·서빙 (Issue #55)
 * presign → PUT 업로드 → GET 서빙까지 실제 HTTP로 왕복 검증한다.
 */

let server;
let base;
let tmpDir;

test.before(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'moa-uploads-'));
  process.env.MOA_UPLOAD_DIR = tmpDir;
  server = http.createServer(handleRequest);
  await new Promise((resolve) => server.listen(0, resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

test.after(() => {
  delete process.env.MOA_UPLOAD_DIR;
  fs.rmSync(tmpDir, { recursive: true, force: true });
  return new Promise((resolve) => server.close(resolve));
});

async function presign() {
  const res = await fetch(`${base}/api/uploads/presign`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename: 'pothole.jpg', contentType: 'image/jpeg', fileSize: 1234 }),
  });
  assert.equal(res.status, 200);
  return (await res.json()).data;
}

test('#55 presign이 로컬 업로드 URL과 publicUrl을 발급한다', async () => {
  const data = await presign();
  assert.match(data.uploadUrl, /^\/uploads\/reports\/\d{4}\/\d{2}\/\d{2}\/[0-9a-f-]{36}\.jpg\?exp=\d+&sig=[0-9a-f]{32}$/);
  assert.equal(data.publicUrl, data.uploadUrl.split('?')[0]);
});

test('#55 PUT으로 올린 바이트가 GET으로 그대로 서빙된다', async () => {
  const { uploadUrl, publicUrl } = await presign();
  const bytes = Buffer.from('fake-jpeg-bytes-for-roundtrip');

  const put = await fetch(`${base}${uploadUrl}`, { method: 'PUT', body: bytes });
  assert.equal(put.status, 201);
  assert.equal((await put.json()).data.publicUrl, publicUrl);

  const get = await fetch(`${base}${publicUrl}`);
  assert.equal(get.status, 200);
  assert.equal(get.headers.get('content-type'), 'image/jpeg');
  assert.ok(get.headers.get('cache-control').includes('immutable'));
  assert.deepEqual(Buffer.from(await get.arrayBuffer()), bytes);
});

test('#55 서명이 틀리면 PUT이 403으로 거절된다', async () => {
  const { uploadUrl } = await presign();
  const tampered = uploadUrl.replace(/sig=[0-9a-f]{6}/, 'sig=000000');
  const res = await fetch(`${base}${tampered}`, { method: 'PUT', body: Buffer.from('x') });
  assert.equal(res.status, 403);
});

test('#55 presign 없는 임의 키로는 업로드할 수 없다', async () => {
  const res = await fetch(`${base}/uploads/reports/2026/07/23/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee.jpg?exp=9999999999&sig=${'0'.repeat(32)}`, {
    method: 'PUT',
    body: Buffer.from('x'),
  });
  assert.equal(res.status, 403);
});

test('#55 같은 키 재업로드는 409 (덮어쓰기 방지)', async () => {
  const { uploadUrl } = await presign();
  const first = await fetch(`${base}${uploadUrl}`, { method: 'PUT', body: Buffer.from('a') });
  assert.equal(first.status, 201);
  const second = await fetch(`${base}${uploadUrl}`, { method: 'PUT', body: Buffer.from('b') });
  assert.equal(second.status, 409);
});

test('#55 없는 파일 GET은 404', async () => {
  const res = await fetch(`${base}/uploads/reports/2026/07/23/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee.jpg`);
  assert.equal(res.status, 404);
});

test('#55 경로 탈출 키는 형식 검증에서 거절된다', async () => {
  const res = await fetch(`${base}/uploads/..%2F..%2Fpackage.json`);
  assert.equal(res.status, 404);
});
