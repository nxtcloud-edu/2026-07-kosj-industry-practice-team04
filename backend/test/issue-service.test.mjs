import test from 'node:test';
import assert from 'node:assert/strict';
import { submitReport } from '../src/report-service.js';
import {
  addEmpathy, changeStatus, findIssueByReceiptNo, issueDetail, listIssues,
  markSpam, nearbyCandidates, reclassifyReport, splitReport, stats,
} from '../src/issue-service.js';
import { clearIssues, clearReports } from '../src/store.js';
import { priorityOf } from '../src/domain.js';

/**
 * 대표 문제 계층 · 처리 상태 전환 (Issue #22)
 */

const BASE = {
  photos: ['https://example.com/a.jpg'],
  latitude: 36.48012,
  longitude: 127.28901,
  address: '세종특별자치시 도움6로 24 인근',
  locationConsent: true,
  type: '도로 파손',
  confidence: 0.9,
};

function reset() {
  clearReports();
  clearIssues();
}

test('#22 신고를 접수하면 대표 문제가 생성된다', () => {
  reset();
  const { issue, merged } = submitReport(BASE);
  assert.equal(merged, false);
  assert.equal(issue.type, '도로 파손');
  assert.equal(issue.dept, '도로관리부', '유형에 맞는 부서가 자동 배정되어야 한다');
  assert.equal(issue.status, '접수');
  // submitReport는 내부 issue 객체를 반환한다 (API 응답은 라우터가 summarizeIssue로 변환)
  assert.equal(issue.reports.length, 1);
});

test('#22 attachIssueId로 기존 문제에 통합된다', () => {
  reset();
  const first = submitReport(BASE);
  const second = submitReport({ ...BASE, attachIssueId: first.issue.id });

  assert.equal(second.merged, true);
  assert.equal(second.issue.id, first.issue.id);
  assert.equal(second.issue.reports.length, 2);
  // 도로 파손 위험도 5 + 신고 2건 = 7
  assert.equal(priorityOf(second.issue), 7);
});

test('#13·#14 유사 신고 후보를 반경·유형으로 찾는다', () => {
  reset();
  submitReport(BASE);

  const near = nearbyCandidates({ lat: 36.48012, lng: 127.28911, type: '도로 파손', confidence: 1 });
  assert.equal(near.length, 1);
  assert.ok(near[0].distance <= 50);

  const farAway = nearbyCandidates({ lat: 36.49, lng: 127.30, type: '도로 파손', confidence: 1 });
  assert.equal(farAway.length, 0, '반경 밖은 후보가 아니다');

  const otherType = nearbyCandidates({ lat: 36.48012, lng: 127.28911, type: '가로등 고장', confidence: 1 });
  assert.equal(otherType.length, 0, '유형이 다르면 후보가 아니다');
});

test('#15 공감은 기기당 1회만 반영되고 우선순위를 올린다', () => {
  reset();
  const { issue } = submitReport(BASE);

  const first = addEmpathy(issue.id, 'device-a');
  assert.equal(first.added, true);
  assert.equal(first.count, 1);
  assert.equal(first.priority, 7, '위험도 5 + 신고 1 + 공감 1');

  const again = addEmpathy(issue.id, 'device-a');
  assert.equal(again.added, false, '같은 기기는 중복 공감 불가');
  assert.equal(again.count, 1);

  const other = addEmpathy(issue.id, 'device-b');
  assert.equal(other.count, 2);
});

test('#22 상태 전환: 접수 → 배정 → 처리중 → 완료', () => {
  reset();
  const { issue } = submitReport(BASE);

  for (const [i, status] of ['배정', '처리중', '완료'].entries()) {
    const result = changeStatus(issue.id, status);
    assert.equal(result.issue.status, status);
    assert.equal(result.issue.statusIndex, i + 1);
  }

  const detail = issueDetail(issue.id);
  assert.ok(detail.history.some((h) => h.event.includes('상태 변경 → 완료')), '이력에 남아야 한다');
});

test('#22 정의되지 않은 상태는 거부된다', () => {
  reset();
  const { issue } = submitReport(BASE);
  const result = changeStatus(issue.id, '처리 완료');
  assert.ok(result.error);
});

test('#22 상태 조회는 대표 문제의 상태를 따른다', () => {
  reset();
  const { receiptNo, issue } = submitReport(BASE);
  changeStatus(issue.id, '처리중');

  const found = findIssueByReceiptNo(receiptNo);
  assert.equal(found.status, '처리중', '담당자가 바꾼 상태를 시민이 조회할 수 있어야 한다');
});

test('#12 재분류하면 유형·부서가 함께 바뀐다', () => {
  reset();
  const { issue } = submitReport(BASE);
  const reportId = issueDetail(issue.id).reports[0].id;

  const result = reclassifyReport(reportId, '가로등 고장');
  assert.equal(result.issue.type, '가로등 고장');
  assert.equal(result.issue.dept, '시설관리부');
  assert.equal(result.warning, null);
});

test('#12 통합된 문제에서 1건만 재분류하면 경고가 나온다', () => {
  reset();
  const first = submitReport(BASE);
  submitReport({ ...BASE, attachIssueId: first.issue.id });
  const reportId = issueDetail(first.issue.id).reports[1].id;

  const result = reclassifyReport(reportId, '쓰레기 무단투기');
  assert.ok(result.warning, '별개 문제일 수 있음을 알려야 한다');
  assert.equal(result.issue.type, '도로 파손', '대표 문제 유형은 유지된다');
});

test('#16 오통합 분리는 새 문제를 만들고 우선순위를 재계산한다', () => {
  reset();
  const first = submitReport(BASE);
  submitReport({ ...BASE, attachIssueId: first.issue.id });
  const reportId = issueDetail(first.issue.id).reports[1].id;

  const before = listIssues().issues.find((i) => i.id === first.issue.id).priority;
  const result = splitReport(first.issue.id, reportId, '위치 상이');

  assert.equal(result.original.reportCount, 1);
  assert.equal(result.created.reportCount, 1);
  assert.ok(result.original.priority < before, '분리하면 원 문제 우선순위가 내려간다');
});

test('#16 신고 1건짜리 문제는 분리할 수 없다', () => {
  reset();
  const { issue } = submitReport(BASE);
  const reportId = issueDetail(issue.id).reports[0].id;
  assert.ok(splitReport(issue.id, reportId, '위치 상이').error);
});

test('스팸 처리한 신고는 우선순위에서 빠진다', () => {
  reset();
  const first = submitReport(BASE);
  submitReport({ ...BASE, attachIssueId: first.issue.id });
  const reportId = issueDetail(first.issue.id).reports[1].id;

  const result = markSpam(reportId, true);
  assert.equal(result.issue.reportCount, 1, '스팸은 집계에서 제외');
});

test('#11 신뢰도가 낮은 신고는 검수 큐로 간다', () => {
  reset();
  submitReport({ ...BASE, confidence: 0.5 });
  const queue = listIssues({ queue: 'review' }).issues;
  assert.equal(queue.length, 1);
  assert.equal(queue[0].needsReview, true);
});

test('#24 목록은 우선순위 내림차순으로 정렬된다', () => {
  reset();
  const road = submitReport(BASE);                                  // 위험도 5
  submitReport({ ...BASE, type: '쓰레기 무단투기', latitude: 36.5, longitude: 127.4 }); // 위험도 2
  addEmpathy(road.issue.id, 'd1');

  const list = listIssues().issues;
  assert.ok(list[0].priority >= list[1].priority);
  assert.equal(list[0].type, '도로 파손');
});

test('#24 통계가 상태별 집계를 반영한다', () => {
  reset();
  const a = submitReport(BASE);
  submitReport({ ...BASE, latitude: 36.5, longitude: 127.4 });
  changeStatus(a.issue.id, '배정');

  const s = stats();
  assert.equal(s.total, 2);
  assert.equal(s.byStatus['접수'], 1);
  assert.equal(s.byStatus['배정'], 1);
  assert.equal(s.reports, 2);
});
