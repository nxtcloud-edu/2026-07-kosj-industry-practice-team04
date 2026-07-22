import test from 'node:test';
import assert from 'node:assert/strict';
import { submitReport } from '../src/report-service.js';
import { validateReportRequest, validateStatusLookup } from '../src/schema.js';
import { clearReports, getReportByReceiptNo, getReportByToken } from '../src/store.js';

const BASE = {
  photos: ['https://example.com/a.jpg'],
  latitude: 36.48012,
  longitude: 127.28901,
  address: '세종특별자치시 도움6로 24 인근',
  locationConsent: true,
};

test.beforeEach(() => {
  clearReports();
});

test('#34 연락처를 보내지 않아도 신고할 수 있고 저장하지 않는다', () => {
  assert.equal(validateReportRequest(BASE).valid, true);

  const { receiptNo } = submitReport(BASE);
  const saved = getReportByReceiptNo(receiptNo);
  assert.equal('contact' in saved, false);
});

test('#34 알림 희망 연락처는 공백을 제거해 선택 저장한다', () => {
  const input = { ...BASE, contact: ' 010-1234-5678 ' };
  assert.equal(validateReportRequest(input).valid, true);

  const { receiptNo } = submitReport(input);
  assert.equal(getReportByReceiptNo(receiptNo).contact, '010-1234-5678');
});

test('#34 연락처는 국내 010 휴대전화만 허용한다', () => {
  assert.equal(validateReportRequest({ ...BASE, contact: '01012345678' }).valid, true);

  for (const contact of ['011-1234-5678', '+82-10-1234-5678', '010-123-4567', '010-12345-6789']) {
    const { valid, errors } = validateReportRequest({ ...BASE, contact });
    assert.equal(valid, false);
    assert.ok(errors.some((error) => error.field === 'contact'));
  }
});

test('#34 비어 있거나 문자열이 아닌 연락처는 거부한다', () => {
  for (const contact of ['', '   ', 1012345678, { phone: '010-1234-5678' }]) {
    const { valid, errors } = validateReportRequest({ ...BASE, contact });
    assert.equal(valid, false);
    assert.ok(errors.some((error) => error.field === 'contact'));
  }
});

test('#34 연락처는 010 형식에서 벗어나면 거부한다', () => {
  for (const contact of ['not-a-phone', '0       ', '010-1234-5678'.repeat(8)]) {
    const { valid, errors } = validateReportRequest({ ...BASE, contact });
    assert.equal(valid, false);
    assert.ok(errors.some((error) => error.field === 'contact'));
  }
});

test('#34 조회 토큰은 개인정보 없는 128비트 난수이며 원문으로 저장하지 않는다', () => {
  const { receiptNo, viewToken } = submitReport({ ...BASE, contact: '010-1234-5678' });
  const saved = getReportByReceiptNo(receiptNo);

  assert.match(viewToken, /^[a-f0-9]{32}$/);
  assert.equal('viewToken' in saved, false);
  assert.match(saved.viewTokenHash, /^[a-f0-9]{64}$/);
  assert.notEqual(saved.viewTokenHash, viewToken);
  assert.equal(getReportByToken(viewToken), saved);
  assert.equal(getReportByToken('0'.repeat(32)), undefined);
});

test('#34 상태 조회는 접수번호와 32자리 난수 토큰 형식을 함께 검증한다', () => {
  assert.equal(validateStatusLookup('MOA-20260723-12345', 'a'.repeat(32)), true);
  assert.equal(validateStatusLookup('MOA-invalid', 'a'.repeat(32)), false);
  assert.equal(validateStatusLookup('MOA-20260723-12345', 'not-a-token'), false);
});
