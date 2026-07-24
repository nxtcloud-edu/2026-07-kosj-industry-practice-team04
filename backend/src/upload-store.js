import fs from 'node:fs';
import path from 'node:path';

/**
 * 업로드 파일 저장소 (Issue #55)
 * ─────────────────────────────────────────────────────
 * presign으로 발급된 fileKey의 실제 바이트를 로컬 디스크에 저장한다.
 * S3 전환 시 이 모듈과 upload.js의 local 분기만 교체하면 된다.
 *
 * 보안 경계:
 *  - fileKey는 생성 규칙(reports/날짜/UUID.확장자)과 정확히 일치해야만 받는다
 *    → 경로 탈출(../)과 임의 키 쓰기를 원천 차단.
 *  - 같은 키 재업로드는 409 성격의 오류로 거절한다 (덮어쓰기 방지).
 */

const FILE_KEY_PATTERN = /^reports\/\d{4}\/\d{2}\/\d{2}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpe?g|png|webp|heic)$/;

const CONTENT_TYPE_BY_EXT = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  heic: 'image/heic',
};

function uploadDir() {
  return process.env.MOA_UPLOAD_DIR || path.join(process.cwd(), 'uploads');
}

export function isValidFileKey(fileKey) {
  return typeof fileKey === 'string' && FILE_KEY_PATTERN.test(fileKey);
}

export function contentTypeOf(fileKey) {
  const ext = fileKey.split('.').pop()?.toLowerCase();
  return CONTENT_TYPE_BY_EXT[ext] || 'application/octet-stream';
}

function diskPathOf(fileKey) {
  // 검증된 키만 오지만, 혹시 몰라 한 번 더 정규화 경로가 저장소 안인지 확인한다.
  const full = path.resolve(uploadDir(), fileKey);
  if (!full.startsWith(path.resolve(uploadDir()) + path.sep)) {
    throw new Error('잘못된 파일 경로입니다.');
  }
  return full;
}

/**
 * 업로드 바이트 저장
 * @returns {{ ok: true } | { ok: false, reason: 'invalid-key' | 'exists' }}
 */
export function saveUpload(fileKey, buffer) {
  if (!isValidFileKey(fileKey)) return { ok: false, reason: 'invalid-key' };

  const target = diskPathOf(fileKey);
  if (fs.existsSync(target)) return { ok: false, reason: 'exists' };

  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, buffer);
  return { ok: true };
}

/**
 * 업로드 바이트 조회
 * @returns {{ buffer: Buffer, contentType: string } | null}
 */
export function readUpload(fileKey) {
  if (!isValidFileKey(fileKey)) return null;
  const target = diskPathOf(fileKey);
  if (!fs.existsSync(target)) return null;
  return { buffer: fs.readFileSync(target), contentType: contentTypeOf(fileKey) };
}

/** 보관기간 만료 삭제용 (retention.js) — 없는 파일은 조용히 넘어간다 */
export function deleteUpload(fileKey) {
  if (!isValidFileKey(fileKey)) return false;
  const target = diskPathOf(fileKey);
  try {
    fs.unlinkSync(target);
    return true;
  } catch {
    return false;
  }
}

/**
 * 저장소의 모든 파일 키를 나열한다 (고아 파일 정리용).
 * reports/YYYY/MM/DD/uuid.ext 구조를 순회한다.
 * @returns {{ fileKey: string, mtimeMs: number }[]}
 */
export function listUploads() {
  const root = path.resolve(uploadDir(), 'reports');
  if (!fs.existsSync(root)) return [];
  const out = [];
  // reports/YYYY/MM/DD/*.ext — 4단계 고정 깊이라 재귀 없이 순회한다.
  for (const y of safeReaddir(root)) {
    for (const m of safeReaddir(path.join(root, y))) {
      for (const d of safeReaddir(path.join(root, y, m))) {
        const dir = path.join(root, y, m, d);
        for (const f of safeReaddir(dir)) {
          const fileKey = `reports/${y}/${m}/${d}/${f}`;
          if (!isValidFileKey(fileKey)) continue;
          try {
            out.push({ fileKey, mtimeMs: fs.statSync(path.join(dir, f)).mtimeMs });
          } catch { /* 순회 중 사라진 파일은 건너뛴다 */ }
        }
      }
    }
  }
  return out;
}

function safeReaddir(dir) {
  try {
    return fs.readdirSync(dir);
  } catch {
    return [];
  }
}
