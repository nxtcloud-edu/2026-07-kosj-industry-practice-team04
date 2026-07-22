import test from 'node:test';
import assert from 'node:assert/strict';
import { submitReport } from '../src/report-service.js';
import { getReportByReceiptNo, clearReports } from '../src/store.js';
import { validateReportRequest } from '../src/schema.js';

/**
 * 위치정보 수집 동의 (SER-001 · Issue #33)
 * 검증만으로는 "동의를 받았다"는 근거가 남지 않으므로, 신고 데이터에 실제로
 * 기록되는지까지 확인한다.
 */

const BASE = {
  photos: ['https://example.com/a.jpg'],
  latitude: 36.48012,
  longitude: 127.28901,
  address: '세종특별자치시 도움6로 24 인근',
  locationConsent: true,
};

test('#33 동의 없이는 접수 요청이 거부된다', () => {
  const { valid, errors } = validateReportRequest({ ...BASE, locationConsent: undefined });
  assert.equal(valid, false);
  assert.ok(errors.some((e) => e.field === 'locationConsent'));
});

test('#33 동의를 false로 보내도 거부된다', () => {
  const { valid } = validateReportRequest({ ...BASE, locationConsent: false });
  assert.equal(valid, false);
});

test('#33 동의 사실이 신고 데이터에 기록된다', () => {
  clearReports();
  const { receiptNo } = submitReport(BASE);

  const saved = getReportByReceiptNo(receiptNo);
  assert.ok(saved, '신고가 저장되어야 한다');
  assert.equal(saved.consent.location, true, '위치정보 동의가 true로 기록되어야 한다');
  assert.ok(saved.consent.agreedAt, '동의 시각이 기록되어야 한다');
  assert.ok(!Number.isNaN(Date.parse(saved.consent.agreedAt)), '동의 시각은 유효한 ISO 문자열이어야 한다');
});

test('#33 동의 시각은 접수 시각과 일관된다', () => {
  clearReports();
  const { receiptNo } = submitReport(BASE);
  const saved = getReportByReceiptNo(receiptNo);
  assert.equal(saved.consent.agreedAt, saved.createdAt);
});
