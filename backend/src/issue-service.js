import crypto from 'node:crypto';
import {
  MERGE_PARAMS, STATUS_FLOW, TYPES,
  deptFor, distanceM, findMergeCandidates, isValidStatus, priorityOf, selectReviewQueue, summarizeIssue,
} from './domain.js';
import { getAllIssues, getIssueById, saveIssue } from './store.js';

/**
 * 대표 문제(issue) 서비스 — 신고를 문제 단위로 묶고 상태를 전환한다 (Issue #22)
 * ─────────────────────────────────────────────────────────────
 * 신고(report) = 시민이 올린 개별 건 · 문제(issue) = 담당자가 처리하는 단위.
 * 판정 규칙은 domain.js(순수 함수)에 있고, 여기서는 저장소와 엮어 상태를 바꾼다.
 *
 * 상태 흐름: 접수 → 배정 → 처리중 → 완료 (SFR-006)
 */

const newId = () => `is_${crypto.randomBytes(6).toString('hex')}`;

function record(issue, event) {
  issue.history.push({ at: new Date().toISOString(), event });
}

/**
 * 신고를 대표 문제에 연결한다.
 * - attachIssueId가 있으면 그 문제에 통합 (신고자가 선택한 경우)
 * - 없으면 새 대표 문제 생성
 * @returns {{ issue: object, merged: boolean }}
 */
export function attachReportToIssue(report, attachIssueId = null) {
  if (attachIssueId) {
    const target = getIssueById(attachIssueId);
    if (target && target.status !== '완료') {
      target.reports.push(report);
      target.lastReportAt = report.createdAt;
      record(target, `신고 통합 (${report.receiptNo})`);
      saveIssue(target);
      return { issue: target, merged: true };
    }
    // 없거나 이미 완료된 문제면 통합하지 않고 새로 만든다.
  }

  const issue = {
    id: newId(),
    type: report.type,
    lat: report.lat,
    lng: report.lng,
    address: report.address,
    dept: deptFor(report.type),
    status: '접수',
    reports: [report],
    empathyDevices: [],
    needsReview: Boolean(report.needsReview),
    history: [{ at: report.createdAt, event: `신고 접수 (${report.receiptNo})` }],
    createdAt: report.createdAt,
    lastReportAt: report.createdAt,
  };
  saveIssue(issue);
  return { issue, merged: false };
}

/** 접수번호로 그 신고가 속한 대표 문제를 찾는다 */
export function findIssueByReceiptNo(receiptNo) {
  return getAllIssues().find((i) => i.reports.some((r) => r.receiptNo === receiptNo));
}

/** 유사 신고 후보 (반경·유형·시간창) — 통합 판정은 domain.js가 한다 */
export function nearbyCandidates({ lat, lng, type, confidence }) {
  return findMergeCandidates(getAllIssues(), { lat, lng, type, confidence })
    .map(({ issue, distance }) => ({ ...summarizeIssue(issue), distance }));
}

/**
 * 공감 요청 IP별 시간창 제한 (Issue #58)
 * deviceId는 위조 가능하므로, 같은 IP가 같은 문제에 짧은 간격으로
 * 공감을 반복하는 것을 서버가 막는다. 우선순위 상한(domain.js)과 이중 방어.
 */
const EMPATHY_WINDOW_MS = Number(process.env.MOA_EMPATHY_WINDOW_MS ?? 60 * 60 * 1000);
const empathyLog = new Map(); // `${issueId}|${ip}` → 마지막 공감 시각(ms)

function pruneEmpathyLog(now) {
  if (empathyLog.size < 10000) return;
  for (const [key, at] of empathyLog) {
    if (now - at > EMPATHY_WINDOW_MS) empathyLog.delete(key);
  }
}

/** '나도 불편해요' — 기기당 문제별 1회 + IP 시간창 (악용 방지, #15·#58) */
export function addEmpathy(issueId, deviceId, { ip, now = Date.now() } = {}) {
  const issue = getIssueById(issueId);
  if (!issue) return null;

  if (ip && EMPATHY_WINDOW_MS > 0) {
    const key = `${issueId}|${ip}`;
    const last = empathyLog.get(key);
    if (last != null && now - last < EMPATHY_WINDOW_MS) {
      return { count: issue.empathyDevices.length, added: false, limited: true, priority: priorityOf(issue) };
    }
    pruneEmpathyLog(now);
    empathyLog.set(key, now);
  }

  const added = !issue.empathyDevices.includes(deviceId);
  if (added) {
    issue.empathyDevices.push(deviceId);
    record(issue, "'나도 불편해요' 공감 추가");
    saveIssue(issue);
  }
  return { count: issue.empathyDevices.length, added, priority: priorityOf(issue) };
}

/**
 * 내 주변 신고 목록 (멘토 피드백 7/23 — 시민 '내 주변' 탭)
 * 위치 주변의 대표 문제를 공개 가능한 필드만으로 돌려준다.
 * 사진·연락처·정확한 신고 이력은 제외한다 (개인정보 노출 방지).
 */
export function issuesAround({ lat, lng, radiusM = 1500, limit = 100 }) {
  const r = Math.min(Math.max(Number(radiusM) || 1500, 100), 5000);
  return getAllIssues()
    .map((issue) => ({ issue, distance: Math.round(distanceM(lat, lng, issue.lat, issue.lng)) }))
    .filter(({ distance }) => distance <= r)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, limit)
    .map(({ issue, distance }) => {
      const s = summarizeIssue(issue);
      return {
        id: s.id, type: s.type, status: s.status, statusIndex: s.statusIndex,
        priorityLabel: s.priorityLabel, reportCount: s.reportCount, empathy: s.empathy,
        lat: s.lat, lng: s.lng, address: s.address, createdAt: s.createdAt, distance,
      };
    });
}

// ─────────────────────── 관리자 ───────────────────────

/** 대표 문제 목록 — 우선순위 또는 최신순 */
export function listIssues({ sort = 'priority', queue, status } = {}) {
  let list = getAllIssues();
  if (queue === 'review') list = selectReviewQueue(list);
  if (status) list = list.filter((i) => i.status === status);

  const summaries = list.map(summarizeIssue);
  summaries.sort((a, b) => (sort === 'recent'
    ? new Date(b.lastReportAt) - new Date(a.lastReportAt)
    : b.priority - a.priority));

  return { params: MERGE_PARAMS, issues: summaries };
}

/** 문제 상세 — 통합된 신고 목록 포함 (사진 비교용) */
export function issueDetail(id) {
  const issue = getIssueById(id);
  if (!issue) return null;
  return {
    ...summarizeIssue(issue),
    history: issue.history,
    statusFlow: STATUS_FLOW,
    reports: issue.reports.map((r) => ({
      id: r.id, receiptNo: r.receiptNo, photoUrl: r.photoUrl,
      address: r.address, lat: r.lat, lng: r.lng,
      type: r.type, confidence: r.confidence, spam: r.spam, createdAt: r.createdAt,
    })),
  };
}

/** 처리 상태 전환 (SFR-006) */
export function changeStatus(id, status) {
  if (!isValidStatus(status)) return { error: `상태는 ${STATUS_FLOW.join(' / ')} 중 하나여야 합니다.` };
  const issue = getIssueById(id);
  if (!issue) return { error: '문제를 찾을 수 없습니다.' };

  // 같은 상태 재클릭은 무시 — 이력에 중복 기록이 쌓이고,
  // '완료' 재설정 시 보관기간(completedAt) 기산이 리셋되는 것을 막는다.
  if (issue.status === status) return { issue: summarizeIssue(issue) };

  issue.status = status;
  // 보관기간(#59)은 '완료' 시각부터 계산한다. 완료를 되돌리면 기산도 초기화.
  if (status === '완료') issue.completedAt = new Date().toISOString();
  else delete issue.completedAt;
  record(issue, `상태 변경 → ${status}`);
  saveIssue(issue);
  return { issue: summarizeIssue(issue) };
}

/** 오분류 보정 — 수동 재분류 (COR-001·SFR-005). 검수 결과는 학습 라벨이 된다 (DAR-002) */
export function reclassifyReport(reportId, type) {
  if (!TYPES.includes(type)) return { error: '유형이 올바르지 않습니다.' };

  for (const issue of getAllIssues()) {
    const report = issue.reports.find((r) => r.id === reportId);
    if (!report) continue;

    const from = report.type;
    report.type = type;
    let warning = null;

    const active = issue.reports.filter((r) => !r.spam);
    if (active.length === 1) {
      issue.type = type;
      issue.dept = deptFor(type);
      record(issue, `유형 재분류 ${from} → ${type} (담당: ${issue.dept})`);
    } else {
      warning = '통합된 신고 중 1건만 유형이 변경되었습니다. 별개 문제라면 분리를 진행하세요.';
      record(issue, `신고 ${report.receiptNo} 유형 재분류 ${from} → ${type}`);
    }
    issue.needsReview = false; // 사람이 확인했으므로 검수 큐에서 해제
    saveIssue(issue);
    return { report, issue: summarizeIssue(issue), warning };
  }
  return { error: '신고를 찾을 수 없습니다.' };
}

/** 스팸 처리/해제 — 우선순위 계산에서 제외된다 */
export function markSpam(reportId, spam) {
  for (const issue of getAllIssues()) {
    const report = issue.reports.find((r) => r.id === reportId);
    if (!report) continue;

    report.spam = Boolean(spam);
    record(issue, spam ? `스팸 처리 (${report.receiptNo})` : `스팸 해제 (${report.receiptNo})`);
    saveIssue(issue);
    return { report, issue: summarizeIssue(issue) };
  }
  return { error: '신고를 찾을 수 없습니다.' };
}

/** 오통합 분리 — 잘못 묶인 신고를 새 문제로 떼어낸다 (제안서 5p 절차) */
export function splitReport(issueId, reportId, reason) {
  const issue = getIssueById(issueId);
  if (!issue) return { error: '문제를 찾을 수 없습니다.' };

  const idx = issue.reports.findIndex((r) => r.id === reportId);
  if (idx < 0) return { error: '해당 신고가 이 문제에 없습니다.' };
  if (issue.reports.length < 2) return { error: '신고가 1건뿐인 문제는 분리할 수 없습니다.' };

  const [moved] = issue.reports.splice(idx, 1);
  record(issue, `신고 분리 (${moved.receiptNo}) — 사유: ${reason || '미기재'}`);
  saveIssue(issue);

  const created = {
    id: newId(),
    type: moved.type, lat: moved.lat, lng: moved.lng, address: moved.address,
    dept: deptFor(moved.type), status: '접수',
    reports: [moved], empathyDevices: [], needsReview: false,
    history: [{ at: new Date().toISOString(), event: `분리로 생성 (원 문제 ${issue.id}, 사유: ${reason || '미기재'})` }],
    createdAt: moved.createdAt, lastReportAt: moved.createdAt,
  };
  saveIssue(created);
  return { original: summarizeIssue(issue), created: summarizeIssue(created) };
}

/** 대시보드 통계 */
export function stats() {
  const issues = getAllIssues();
  return {
    total: issues.length,
    byStatus: Object.fromEntries(STATUS_FLOW.map((s) => [s, issues.filter((i) => i.status === s).length])),
    reviewQueue: selectReviewQueue(issues).length,
    reports: issues.reduce((n, i) => n + i.reports.filter((r) => !r.spam).length, 0),
    splits: issues.filter((i) => i.history.some((h) => h.event.startsWith('분리로 생성'))).length,
  };
}
