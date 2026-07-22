import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEPT_BY_TYPE, MERGE_PARAMS, STATUS_FLOW,
  deptFor, distanceM, findMergeCandidates, isAutoMergeEligible, isValidStatus,
  needsReview, priorityLabel, priorityOf, riskOf, selectReviewQueue, statusIndex, summarizeIssue,
} from '../src/domain.js';

// 세종 도움6로 인근 기준 좌표
const BASE = { lat: 36.48012, lng: 127.28901 };
const NOW = Date.parse('2026-07-22T12:00:00Z');
const hoursAgo = (h) => new Date(NOW - h * 3600 * 1000).toISOString();

function makeIssue(over = {}) {
  return {
    id: 'is_1', type: '도로 파손', lat: BASE.lat, lng: BASE.lng,
    address: '세종특별자치시 도움6로 24 인근', status: '접수',
    reports: [{ id: 'rp_1', photoUrl: '/uploads/a.jpg', spam: false }],
    empathyDevices: [], needsReview: false,
    createdAt: hoursAgo(5), lastReportAt: hoursAgo(5),
    ...over,
  };
}

// ─────────────── 거리 ───────────────

test('distanceM — 같은 좌표는 0', () => {
  assert.equal(Math.round(distanceM(BASE.lat, BASE.lng, BASE.lat, BASE.lng)), 0);
});

test('distanceM — 위도 1도 차이는 약 111km', () => {
  const d = distanceM(36, 127, 37, 127);
  assert.ok(d > 110000 && d < 112000, `실제 ${d}`);
});

// ─────────── 부서 자동 배정 (#18) ───────────

test('#18 유형별 담당 부서 매핑', () => {
  assert.equal(deptFor('도로 파손'), '도로관리부');
  assert.equal(deptFor('가로등 고장'), '시설관리부');
  assert.equal(deptFor('쓰레기 무단투기'), '환경관리부');
  assert.equal(deptFor('기타'), '민원총괄팀');
});

test('#18 정의되지 않은 유형은 민원총괄팀으로 폴백', () => {
  assert.equal(deptFor('알 수 없는 유형'), DEPT_BY_TYPE['기타']);
});

// ─────────── 우선순위 산정 (#17) ───────────

test('#17 우선순위 = 위험도 + 신고 건수 + 공감 수', () => {
  const issue = makeIssue({
    reports: [{ spam: false }, { spam: false }],
    empathyDevices: ['d1', 'd2', 'd3'],
  });
  // 도로 파손 5 + 신고 2 + 공감 3 = 10
  assert.equal(priorityOf(issue), 10);
});

test('#17 스팸 처리된 신고는 우선순위에서 제외', () => {
  const issue = makeIssue({ reports: [{ spam: false }, { spam: true }], empathyDevices: [] });
  assert.equal(priorityOf(issue), riskOf('도로 파손') + 1);
});

test('#17 우선순위 라벨 경계값 (8 높음 / 5 보통 / 그 외 낮음)', () => {
  assert.equal(priorityLabel(8), '높음');
  assert.equal(priorityLabel(7), '보통');
  assert.equal(priorityLabel(5), '보통');
  assert.equal(priorityLabel(4), '낮음');
});

// ─────── 신뢰도 임계값·검수 큐 (#11) ───────

test('#11 신뢰도 0.7 미만이면 검수 필요', () => {
  assert.equal(needsReview(0.69), true);
  assert.equal(needsReview(0.7), false);
  assert.equal(needsReview(0.91), false);
});

test('#11 신뢰도 미달 신고는 자동 통합 대상이 아님', () => {
  assert.equal(isAutoMergeEligible({ confidence: 0.58 }), false);
  assert.equal(isAutoMergeEligible({ confidence: 0.87 }), true);
});

test('#11 검수 큐는 needsReview 건만, 우선순위 높은 순', () => {
  const low = makeIssue({ id: 'low', needsReview: true, reports: [{ spam: false }] });
  const high = makeIssue({ id: 'high', needsReview: true, reports: [{ spam: false }], empathyDevices: ['a', 'b', 'c'] });
  const clean = makeIssue({ id: 'clean', needsReview: false });

  const queue = selectReviewQueue([low, high, clean]);
  assert.deepEqual(queue.map((i) => i.id), ['high', 'low']);
});

// ─────── 유사 신고 통합 판정 (#13) ───────

test('#13 반경 50m 이내 · 동일 유형 · 72시간 이내면 후보', () => {
  const issues = [makeIssue()];
  const found = findMergeCandidates(
    issues,
    { lat: BASE.lat, lng: BASE.lng + 0.00009, type: '도로 파손', confidence: 0.9 },
    { now: NOW },
  );
  assert.equal(found.length, 1);
  assert.ok(found[0].distance <= MERGE_PARAMS.radiusM, `거리 ${found[0].distance}m`);
});

test('#13 반경을 벗어나면 후보 아님', () => {
  const found = findMergeCandidates(
    [makeIssue()],
    { lat: BASE.lat, lng: BASE.lng + 0.0012, type: '도로 파손', confidence: 0.9 }, // 약 107m
    { now: NOW },
  );
  assert.equal(found.length, 0);
});

test('#13 유형이 다르면 후보 아님', () => {
  const found = findMergeCandidates(
    [makeIssue()],
    { lat: BASE.lat, lng: BASE.lng, type: '쓰레기 무단투기', confidence: 0.9 },
    { now: NOW },
  );
  assert.equal(found.length, 0);
});

test('#13 시간창(72h)을 벗어나면 후보 아님', () => {
  const found = findMergeCandidates(
    [makeIssue({ lastReportAt: hoursAgo(73) })],
    { lat: BASE.lat, lng: BASE.lng, type: '도로 파손', confidence: 0.9 },
    { now: NOW },
  );
  assert.equal(found.length, 0);
});

test('#13 이미 완료된 문제는 후보 아님', () => {
  const found = findMergeCandidates(
    [makeIssue({ status: '완료' })],
    { lat: BASE.lat, lng: BASE.lng, type: '도로 파손', confidence: 0.9 },
    { now: NOW },
  );
  assert.equal(found.length, 0);
});

test('#13 후보는 가까운 순으로 정렬', () => {
  const near = makeIssue({ id: 'near', lat: BASE.lat, lng: BASE.lng + 0.00009 });   // 약 8m
  const far = makeIssue({ id: 'far', lat: BASE.lat, lng: BASE.lng + 0.00040 });     // 약 36m
  const found = findMergeCandidates(
    [far, near],
    { lat: BASE.lat, lng: BASE.lng, type: '도로 파손', confidence: 0.9 },
    { now: NOW },
  );
  assert.deepEqual(found.map((f) => f.issue.id), ['near', 'far']);
});

test('#11+#13 신뢰도 미달 신고는 통합 후보를 만들지 않음', () => {
  const found = findMergeCandidates(
    [makeIssue()],
    { lat: BASE.lat, lng: BASE.lng, type: '도로 파손', confidence: 0.55 },
    { now: NOW },
  );
  assert.equal(found.length, 0);
});

test('#13 파라미터를 설정값으로 덮어쓸 수 있음', () => {
  const report = { lat: BASE.lat, lng: BASE.lng + 0.0012, type: '도로 파손', confidence: 0.9 }; // 약 107m
  const 기본 = findMergeCandidates([makeIssue()], report, { now: NOW });
  const 확장 = findMergeCandidates([makeIssue()], report, {
    now: NOW,
    params: { ...MERGE_PARAMS, radiusM: 150 },
  });
  assert.equal(기본.length, 0);
  assert.equal(확장.length, 1);
});

// ─────────────── 상태 ───────────────

test('상태 흐름은 접수 → 배정 → 처리중 → 완료', () => {
  assert.deepEqual(STATUS_FLOW, ['접수', '배정', '처리중', '완료']);
  assert.equal(statusIndex('처리중'), 2);
  assert.equal(isValidStatus('배정'), true);
  assert.equal(isValidStatus('처리 완료'), false);
});

// ─────────── 계약 형태 변환 ───────────

test('summarizeIssue는 API 계약의 issueSummary 형태를 만든다', () => {
  const issue = makeIssue({
    reports: [{ photoUrl: '/uploads/a.jpg', spam: false }, { photoUrl: '/uploads/b.jpg', spam: false }],
    empathyDevices: ['d1', 'd2', 'd3'],
  });
  const s = summarizeIssue(issue);

  assert.equal(s.priority, 10);
  assert.equal(s.priorityLabel, '높음');
  assert.equal(s.reportCount, 2);
  assert.equal(s.empathy, 3);
  assert.equal(s.dept, '도로관리부');
  assert.equal(s.statusIndex, 0);
  assert.equal(s.thumbnail, '/uploads/a.jpg');
  for (const key of ['id', 'type', 'address', 'lat', 'lng', 'dept', 'status', 'statusIndex',
    'priority', 'priorityLabel', 'reportCount', 'empathy', 'needsReview', 'thumbnail',
    'createdAt', 'lastReportAt']) {
    assert.ok(key in s, `issueSummary에 ${key} 누락`);
  }
});
