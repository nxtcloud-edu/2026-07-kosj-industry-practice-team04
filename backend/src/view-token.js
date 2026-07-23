import crypto from 'node:crypto';

const TOKEN_BYTES = 16;

/** 개인정보를 포함하지 않는 128비트 조회 토큰을 만든다. */
export function generateViewToken() {
  return crypto.randomBytes(TOKEN_BYTES).toString('hex');
}

/** 저장소에는 원문 토큰 대신 단방향 해시만 보관한다. */
export function hashViewToken(token) {
  return crypto.createHash('sha256').update(token, 'utf8').digest('hex');
}

/** 토큰 해시를 일정 시간 비교해 단순 타이밍 차이를 줄인다. */
export function matchesViewToken(storedHash, token) {
  if (typeof storedHash !== 'string' || typeof token !== 'string') return false;

  const expected = Buffer.from(storedHash, 'hex');
  const actual = Buffer.from(hashViewToken(token), 'hex');
  if (expected.length !== actual.length) return false;

  return crypto.timingSafeEqual(expected, actual);
}
