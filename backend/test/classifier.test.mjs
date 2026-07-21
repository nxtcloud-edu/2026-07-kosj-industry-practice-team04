import test from 'node:test';
import assert from 'node:assert/strict';
import { classify, REVIEW_THRESHOLD } from '../src/classifier.js';
import { TYPES } from '../src/types.js';

test('유형은 항상 정의된 4종 중 하나', async () => {
  const { type } = await classify({ buffer: Buffer.from('anything'), filename: 'a.jpg' });
  assert.ok(TYPES.includes(type));
});

test('결정적: 같은 입력은 항상 같은 결과', async () => {
  const a = await classify({ buffer: Buffer.from('same-bytes'), filename: 'img.jpg' });
  const b = await classify({ buffer: Buffer.from('same-bytes'), filename: 'img.jpg' });
  assert.deepEqual(a, b);
});

test('파일명 힌트 pothole → 도로 파손, 신뢰도 0.8 이상', async () => {
  const r = await classify({ buffer: Buffer.from('1'), filename: 'pothole_01.jpg' });
  assert.equal(r.type, '도로 파손');
  assert.ok(r.confidence >= 0.8);
  assert.equal(r.needsReview, false);
});

test('파일명 힌트 streetlight → 가로등 고장', async () => {
  const r = await classify({ buffer: Buffer.from('1'), filename: 'streetlight.jpg' });
  assert.equal(r.type, '가로등 고장');
});

test('파일명 힌트 trash → 쓰레기 무단투기', async () => {
  const r = await classify({ buffer: Buffer.from('1'), filename: 'trash_dump.jpg' });
  assert.equal(r.type, '쓰레기 무단투기');
});

test('한글 파일명 힌트도 인식', async () => {
  const r = await classify({ buffer: Buffer.from('1'), filename: '도로_균열.jpg' });
  assert.equal(r.type, '도로 파손');
});

test('신뢰도는 0.55~0.95 범위, 소수 둘째 자리', async () => {
  const { confidence } = await classify({ buffer: Buffer.from('field-photo-bytes'), filename: 'IMG_1.jpg' });
  assert.ok(confidence >= 0.55 && confidence <= 0.95);
  assert.equal(Math.round(confidence * 100), confidence * 100);
});

test('needsReview는 임계값과 일관', async () => {
  const r = await classify({ buffer: Buffer.from('another-field-photo'), filename: 'DCIM_9.jpg' });
  assert.equal(r.needsReview, r.confidence < REVIEW_THRESHOLD);
});

test('빈 버퍼는 오류', async () => {
  await assert.rejects(() => classify({ buffer: Buffer.alloc(0), filename: 'x.jpg' }));
});
