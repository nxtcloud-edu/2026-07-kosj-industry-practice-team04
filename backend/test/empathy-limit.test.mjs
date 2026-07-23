import test from 'node:test';
import assert from 'node:assert/strict';
import { submitReport } from '../src/report-service.js';
import { addEmpathy, findIssueByReceiptNo, issuesAround } from '../src/issue-service.js';
import { clearReports, clearIssues } from '../src/store.js';
import { priorityOf, riskOf, EMPATHY_PRIORITY_CAP } from '../src/domain.js';

/**
 * 공감 남용 방지 (Issue #58)
 * ① 우선순위 산식의 공감 기여 상한 ② 같은 IP의 시간창 반복 제한.
 */

function makeIssue() {
  clearReports();
  clearIssues();
  const { receiptNo } = submitReport({
    photos: ['/uploads/reports/2026/07/23/11111111-2222-3333-4444-555555555555.jpg'],
    latitude: 36.4875,
    longitude: 127.2817,
    locationConsent: true,
    type: '도로 파손',
    confidence: 0.9,
  });
  return findIssueByReceiptNo(receiptNo);
}

test('#58 공감이 아무리 쌓여도 우선순위 기여는 상한까지만 오른다', () => {
  const issue = makeIssue();
  for (let i = 0; i < 100; i += 1) issue.empathyDevices.push(`forged-device-${i}`);

  const expected = riskOf('도로 파손') + 1 + EMPATHY_PRIORITY_CAP;
  assert.equal(priorityOf(issue), expected);
  assert.ok(EMPATHY_PRIORITY_CAP <= 5, '상한 기본값은 5 이하');
});

test('#58 같은 IP는 시간창 안에서 같은 문제에 다시 공감할 수 없다', () => {
  const issue = makeIssue();
  const now = Date.now();

  const first = addEmpathy(issue.id, 'device-A', { ip: '10.0.0.1', now });
  assert.equal(first.added, true);

  const repeat = addEmpathy(issue.id, 'device-B', { ip: '10.0.0.1', now: now + 1000 });
  assert.equal(repeat.limited, true, '같은 IP의 연속 공감은 제한된다');
  assert.equal(repeat.count, 1, '공감 수가 늘어나지 않아야 한다');
});

test('#58 시간창이 지나면 같은 IP도 다시 공감할 수 있다', () => {
  const issue = makeIssue();
  const now = Date.now();

  addEmpathy(issue.id, 'device-A', { ip: '10.0.0.2', now });
  const later = addEmpathy(issue.id, 'device-C', { ip: '10.0.0.2', now: now + 61 * 60 * 1000 });
  assert.equal(later.limited, undefined);
  assert.equal(later.count, 2);
});

test('#58 다른 IP는 서로 영향을 주지 않는다', () => {
  const issue = makeIssue();
  const now = Date.now();

  addEmpathy(issue.id, 'device-A', { ip: '10.0.0.3', now });
  const other = addEmpathy(issue.id, 'device-D', { ip: '10.0.0.4', now: now + 1000 });
  assert.equal(other.added, true);
  assert.equal(other.count, 2);
});

test('#15 기존 규칙 유지 — 같은 deviceId는 IP와 무관하게 1회만 집계된다', () => {
  const issue = makeIssue();
  const now = Date.now();

  addEmpathy(issue.id, 'device-same', { ip: '10.0.1.1', now });
  const dup = addEmpathy(issue.id, 'device-same', { ip: '10.0.1.2', now: now + 1000 });
  assert.equal(dup.added, false);
  assert.equal(dup.count, 1);
});

test("내 주변 탭 — 반경 안 문제만 거리순으로, 공개 필드만 내려준다", () => {
  const issue = makeIssue();
  const near = issuesAround({ lat: 36.4876, lng: 127.2818, radiusM: 1500 });
  assert.equal(near.length, 1);
  assert.equal(near[0].id, issue.id);
  assert.ok(near[0].distance < 50);
  assert.equal(near[0].thumbnail, undefined, '시민 지도에는 사진을 노출하지 않는다');
  assert.equal(near[0].reports, undefined, '개별 신고 내용을 노출하지 않는다');

  const far = issuesAround({ lat: 36.6, lng: 127.5, radiusM: 1500 });
  assert.equal(far.length, 0);
});
