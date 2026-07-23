import test from 'node:test';
import assert from 'node:assert/strict';
import { classify } from '../src/classifier.js';
import { TYPES } from '../src/types.js';

/**
 * /api/analyze 가 쓰는 분류 경로 (Issue #10·#11)
 * 라우터는 dataURL 또는 photoUrl 문자열을 버퍼로 만들어 classify()에 넘긴다.
 */

test('#10 dataURL 바이트로 분류하면 유효한 유형이 나온다', async () => {
  const buffer = Buffer.from('fake-image-bytes');
  const r = await classify({ buffer, filename: 'photo.jpg' });
  assert.ok(TYPES.includes(r.type));
  assert.ok(r.confidence >= 0.55 && r.confidence <= 0.95);
  assert.equal(typeof r.needsReview, 'boolean');
});

test('#10 파일명 힌트가 분류에 반영된다', async () => {
  const buffer = Buffer.from('bytes');
  assert.equal((await classify({ buffer, filename: 'pothole_01.jpg' })).type, '도로 파손');
  assert.equal((await classify({ buffer, filename: 'streetlight.jpg' })).type, '가로등 고장');
  assert.equal((await classify({ buffer, filename: 'trash_dump.jpg' })).type, '쓰레기 무단투기');
});

test('#11 신뢰도가 임계값 미만이면 needsReview가 켜진다', async () => {
  const r = await classify({ buffer: Buffer.from('field-photo'), filename: 'IMG_1.jpg' });
  assert.equal(r.needsReview, r.confidence < 0.7);
});

test('#10 photoUrl 문자열만으로도 분류가 가능하다 (라우터 폴백 경로)', async () => {
  const buffer = Buffer.from('https://bucket/reports/pothole.jpg', 'utf8');
  const r = await classify({ buffer, filename: 'https://bucket/reports/pothole.jpg' });
  assert.equal(r.type, '도로 파손');
});
