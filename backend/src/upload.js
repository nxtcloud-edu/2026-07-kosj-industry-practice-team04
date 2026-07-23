import crypto from 'node:crypto';

/**
 * Presigned URL 발급 서비스 (Issue #9 · #55 · PER-002)
 * ─────────────────────────────────────────────────────
 * 기본은 로컬 저장 모드 — 이 서버의 PUT /uploads/:fileKey 로 실제 업로드하고
 * GET /uploads/:fileKey 로 서빙한다 (upload-store.js).
 *
 * S3 전환 지점: MOA_STORAGE=s3 분기를 추가하고 @aws-sdk/s3-request-presigner로
 * 같은 형태({ uploadUrl, publicUrl, fileKey, expiresIn })를 반환하면
 * 프론트·라우터는 수정 없이 동작한다.
 */

const URL_EXPIRY_SECONDS = 600; // 10분

// 서버 기동마다 새로 만든다. 재시작하면 발급했던 업로드 URL은 만료된 것으로 취급
// (presign 유효기간 10분과 같은 성격). 고정하려면 MOA_UPLOAD_SECRET 지정.
const SECRET = process.env.MOA_UPLOAD_SECRET || crypto.randomBytes(32).toString('hex');

function signKey(fileKey, exp) {
  return crypto.createHmac('sha256', SECRET).update(`${fileKey}:${exp}`).digest('hex').slice(0, 32);
}

/**
 * presigned URL 발급 (로컬 저장 모드)
 * @param {{ filename: string, contentType: string }} params
 */
export function generatePresignedUrl({ filename }) {
  const ext = (filename.split('.').pop() || 'jpg').toLowerCase();
  const uniqueId = crypto.randomUUID();
  const datePrefix = new Date().toISOString().slice(0, 10).replace(/-/g, '/');
  const fileKey = `reports/${datePrefix}/${uniqueId}.${ext}`;

  const exp = Math.floor(Date.now() / 1000) + URL_EXPIRY_SECONDS;
  const sig = signKey(fileKey, exp);

  return {
    uploadUrl: `/uploads/${fileKey}?exp=${exp}&sig=${sig}`,
    publicUrl: `/uploads/${fileKey}`,
    fileKey,
    expiresIn: URL_EXPIRY_SECONDS,
  };
}

/**
 * 업로드 서명 검증 — presign 없이 임의 키에 쓰는 것을 막는다 (Issue #55)
 * @returns {boolean}
 */
export function verifyUploadSignature(fileKey, exp, sig) {
  const expNum = Number(exp);
  if (!Number.isFinite(expNum) || expNum * 1000 < Date.now()) return false;
  if (typeof sig !== 'string' || sig.length !== 32) return false;

  const expected = signKey(fileKey, expNum);
  try {
    return crypto.timingSafeEqual(Buffer.from(sig, 'utf8'), Buffer.from(expected, 'utf8'));
  } catch {
    return false;
  }
}
