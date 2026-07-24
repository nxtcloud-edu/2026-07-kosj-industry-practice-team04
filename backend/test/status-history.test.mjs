import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { handleRequest } from '../src/router.js';
import { submitReport } from '../src/report-service.js';
import { addEmpathy, changeStatus, findIssueByReceiptNo } from '../src/issue-service.js';
import { clearReports, clearIssues } from '../src/store.js';

/**
 * 시민 상태 조회의 이력 최소화 (개인정보 보호)
 * 통합된 다른 신고의 접수번호가 담긴 이벤트(접수·통합·공감)는 내려주지 않고,
 * 담당자의 '상태 변경' 이력만 공개한다.
 */

let server;
let base;

test.before(async () => {
  server = http.createServer(handleRequest);
  await new Promise((resolve) => server.listen(0, resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

test.after(() => new Promise((resolve) => server.close(resolve)));

test('시민 조회 이력에는 상태 변경만 남고 타인 접수번호는 없다', async () => {
  clearReports();
  clearIssues();

  // 신고 A 접수 → 같은 문제에 신고 B 통합 → 공감 → 상태 변경 2회
  const a = submitReport({
    photos: ['/uploads/reports/2026/07/24/11111111-2222-3333-4444-555555555555.jpg'],
    latitude: 36.4875, longitude: 127.2817, locationConsent: true,
    type: '도로 파손', confidence: 0.9,
  });
  const issue = findIssueByReceiptNo(a.receiptNo);
  const b = submitReport({
    photos: ['/uploads/reports/2026/07/24/11111111-2222-3333-4444-666666666666.jpg'],
    latitude: 36.48751, longitude: 127.28171, locationConsent: true,
    type: '도로 파손', confidence: 0.88, attachIssueId: issue.id,
  });
  addEmpathy(issue.id, 'device-x');
  changeStatus(issue.id, '배정');
  changeStatus(issue.id, '처리중');

  const res = await fetch(`${base}/api/status/${a.receiptNo}?token=${a.viewToken}`);
  assert.equal(res.status, 200);
  const { data } = await res.json();

  const history = data.issue.history;
  assert.equal(history.length, 2, '상태 변경 2건만 내려온다');
  assert.ok(history.every((h) => h.event.startsWith('상태 변경')), '상태 변경 이벤트만 허용');

  const raw = JSON.stringify(data);
  assert.ok(!raw.includes(b.receiptNo), '통합된 다른 신고의 접수번호가 노출되면 안 된다');
  assert.ok(!raw.includes('공감'), '공감 이벤트는 내려주지 않는다');
  assert.equal(data.issue.status, '처리중');
});

test('헬스체크가 분류 엔진·인증 모드를 알려준다 (배포 확인용)', async () => {
  const res = await fetch(`${base}/api/health`);
  const body = await res.json();
  assert.equal(body.status, 'ok');
  assert.ok(['gemini', 'mock'].includes(body.classifier));
  assert.ok(['env', 'boot-token'].includes(body.adminAuth));
});
