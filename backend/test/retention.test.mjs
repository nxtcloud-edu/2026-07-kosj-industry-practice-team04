import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { submitReport } from '../src/report-service.js';
import { changeStatus, findIssueByReceiptNo } from '../src/issue-service.js';
import { clearReports, clearIssues, getReportByReceiptNo } from '../src/store.js';
import { sweepRetention, CONTACT_RETENTION_MS, MEDIA_RETENTION_MS } from '../src/retention.js';
import { saveUpload } from '../src/upload-store.js';

/**
 * 보관기간 만료 자동 삭제 (Issue #59 · SER-003)
 * PRIVACY_POLICY.md 2장 기준: 연락처 30일 · 사진/위치/토큰 6개월.
 * now를 주입해 시간 경과를 시뮬레이션한다.
 */

const DAY = 24 * 60 * 60 * 1000;
const FILE_KEY = 'reports/2026/07/23/11111111-2222-3333-4444-555555555555.jpg';

function setup({ withUploadFile = false } = {}) {
  clearReports();
  clearIssues();
  const { receiptNo } = submitReport({
    photos: [`/uploads/${FILE_KEY}`],
    latitude: 36.480123,
    longitude: 127.289456,
    address: '세종특별자치시 도움6로 24 인근',
    locationConsent: true,
    contact: '010-1234-5678',
    type: '도로 파손',
    confidence: 0.9,
  });
  const issue = findIssueByReceiptNo(receiptNo);
  changeStatus(issue.id, '완료');
  if (withUploadFile) saveUpload(FILE_KEY, Buffer.from('expired-photo-bytes'));
  return { receiptNo, issue };
}

test('#59 완료 30일 전에는 아무것도 삭제되지 않는다', () => {
  const { receiptNo, issue } = setup();
  const completed = new Date(issue.completedAt).getTime();

  sweepRetention(completed + CONTACT_RETENTION_MS - DAY);

  const report = getReportByReceiptNo(receiptNo);
  assert.equal(report.contact, '010-1234-5678');
  assert.ok(report.viewTokenHash);
  assert.equal(report.photos.length, 1);
});

test('#59 완료 30일이 지나면 연락처만 삭제된다', () => {
  const { receiptNo, issue } = setup();
  const completed = new Date(issue.completedAt).getTime();

  const result = sweepRetention(completed + CONTACT_RETENTION_MS + DAY);

  const report = getReportByReceiptNo(receiptNo);
  assert.equal(result.contactsRemoved, 1);
  assert.equal(report.contact, undefined, '연락처는 삭제되어야 한다');
  assert.ok(report.viewTokenHash, '사진·토큰은 6개월까지 유지된다');
  assert.equal(report.photos.length, 1);
});

test('#59 완료 6개월이 지나면 사진·위치·토큰이 삭제·비식별화된다', () => {
  process.env.MOA_UPLOAD_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'moa-ret-'));
  try {
    // 임시 저장소에 실제 파일을 두고 스윕이 지우는 것까지 확인한다.
    const { receiptNo, issue } = setup({ withUploadFile: true });
    const uploaded = path.join(process.env.MOA_UPLOAD_DIR, FILE_KEY);
    assert.ok(fs.existsSync(uploaded));

    const completed = new Date(issue.completedAt).getTime();
    const result = sweepRetention(completed + MEDIA_RETENTION_MS + DAY);

    const report = getReportByReceiptNo(receiptNo);
    assert.equal(result.reportsAnonymized, 1);
    assert.equal(report.photos.length, 0);
    assert.equal(report.photoUrl, null);
    assert.equal(report.viewTokenHash, null, '조회 링크가 무효화되어야 한다');
    assert.equal(report.address, null);
    assert.equal(report.lat, 36.48, '좌표는 약 1km 격자로 비식별화된다');
    assert.equal(fs.existsSync(uploaded), false, '업로드 파일도 삭제되어야 한다');
  } finally {
    fs.rmSync(process.env.MOA_UPLOAD_DIR, { recursive: true, force: true });
    delete process.env.MOA_UPLOAD_DIR;
  }
});

test('#59 완료되지 않은 신고는 기간과 무관하게 건드리지 않는다', () => {
  clearReports();
  clearIssues();
  const { receiptNo } = submitReport({
    photos: ['/uploads/' + FILE_KEY],
    latitude: 36.48,
    longitude: 127.28,
    locationConsent: true,
    contact: '010-9999-8888',
  });

  sweepRetention(Date.now() + MEDIA_RETENTION_MS * 10);

  const report = getReportByReceiptNo(receiptNo);
  assert.equal(report.contact, '010-9999-8888');
  assert.ok(report.viewTokenHash);
});

test('#59 완료를 되돌리면 보관기간 기산이 초기화된다', () => {
  const { issue } = setup();
  changeStatus(issue.id, '처리중');
  assert.equal(issue.completedAt, undefined);

  const result = sweepRetention(Date.now() + MEDIA_RETENTION_MS * 10);
  assert.equal(result.contactsRemoved, 0);
});
