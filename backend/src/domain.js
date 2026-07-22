import { TYPES, DETECTABLE_TYPES } from './types.js';

/**
 * 「모아」 도메인 규칙 — 순수 함수 모음 (Issue #11 · #13 · #17 · #18)
 * ─────────────────────────────────────────────────────────────
 * 저장소·라우터에 의존하지 않는 계산 로직만 둔다.
 * 라우터(#9)는 이 모듈을 import 해서 판정 결과만 쓰면 된다.
 *
 * 기준 문서: docs/API_CONTRACT.md 4장(데이터 모델·공통 상수)
 */

// types.js를 단일 출처로 re-export (docs/INTEGRATION_NOTES.md 약속)
export { TYPES, DETECTABLE_TYPES };

/** 상태 흐름 — 이 순서·라벨을 시민/관리자 화면이 공유한다 (SFR-006) */
export const STATUS_FLOW = ['접수', '배정', '처리중', '완료'];

/** 유형별 기본 위험도 (SFR-003 우선순위 산정의 기본값) */
export const RISK = {
  '도로 파손': 5,
  '가로등 고장': 3,
  '쓰레기 무단투기': 2,
  '기타': 1,
};

/** 유형 → 담당 부서 매핑 (SFR-004 · DAR-003 기준 데이터) */
export const DEPT_BY_TYPE = {
  '도로 파손': '도로관리부',
  '가로등 고장': '시설관리부',
  '쓰레기 무단투기': '환경관리부',
  '기타': '민원총괄팀',
};

/**
 * 유사 신고 통합·검수 파라미터 (Issue #13 — "파라미터는 설정값으로")
 * 하드코딩하지 않고 환경변수로 덮어쓸 수 있게 한다.
 * 운영 데이터(분리율·재통합률)를 근거로 보정하는 것이 전제 — 제안서 5p.
 */
export const MERGE_PARAMS = {
  radiusM: Number(process.env.MOA_MERGE_RADIUS_M ?? 50),      // GPS 오차(도심 10~30m)의 1.5~2배
  windowHours: Number(process.env.MOA_MERGE_WINDOW_HOURS ?? 72), // 재신고 집중 구간
  minConfidence: Number(process.env.MOA_MIN_CONFIDENCE ?? 0.7),  // 미만이면 자동 통합 제외 + 검수 큐
};

// ─────────────────────────── 거리 ───────────────────────────

/**
 * 두 좌표 사이 거리 (haversine, 미터)
 * @returns {number}
 */
export function distanceM(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// ──────────────────── 부서 배정 (Issue #18) ────────────────────

/**
 * 유형 기준 담당 부서 배정 (SFR-004)
 * @param {string} type
 * @param {string} [region] 행정구역 — 구역별 분리 운영 시 확장 지점 (DAR-003)
 * @returns {string}
 */
export function deptFor(type) {
  // 구역별로 담당 부서가 나뉘는 운영이 되면, 여기서 (유형 × 행정구역) 매핑 테이블을
  // 조회하도록 확장한다 (DAR-003 시설·구역 기준 데이터).
  return DEPT_BY_TYPE[type] ?? DEPT_BY_TYPE['기타'];
}

// ──────────────────── 우선순위 (Issue #17) ────────────────────

/** 유형별 기본 위험도 */
export function riskOf(type) {
  return RISK[type] ?? RISK['기타'];
}

/**
 * 우선순위 = 기본 위험도 + 누적 신고 건수 + '나도 불편해요' 공감 수 (SFR-003)
 * 스팸 처리된 신고는 제외한다.
 * @param {{type:string, reports?:Array<{spam?:boolean}>, empathyDevices?:string[]}} issue
 * @returns {number}
 */
export function priorityOf(issue) {
  const active = (issue.reports ?? []).filter((r) => !r.spam);
  return riskOf(issue.type) + active.length + (issue.empathyDevices?.length ?? 0);
}

/** 점수 → 라벨 (≥8 높음 · ≥5 보통 · 그 외 낮음) */
export function priorityLabel(score) {
  if (score >= 8) return '높음';
  if (score >= 5) return '보통';
  return '낮음';
}

// ─────────── 신뢰도 임계값·검수 큐 (Issue #11) ───────────

/**
 * 관리자 검수가 필요한 분류 결과인지 (QUR-001 · COR-001)
 * @param {number} confidence
 * @param {typeof MERGE_PARAMS} [params]
 */
export function needsReview(confidence, params = MERGE_PARAMS) {
  return Number(confidence) < params.minConfidence;
}

/**
 * 자동 통합 대상이 될 수 있는 신고인지.
 * 신뢰도가 임계값 미만이면 **자동 통합에서 제외**하고 사람이 먼저 본다 (Issue #11).
 * @param {{confidence:number}} report
 * @param {typeof MERGE_PARAMS} [params]
 */
export function isAutoMergeEligible(report, params = MERGE_PARAMS) {
  return !needsReview(report?.confidence, params);
}

/**
 * 관리자 우선 검수 큐 — 사람 확인이 필요한 문제만 우선순위 높은 순으로 (Issue #11)
 * @param {Array<object>} issues
 * @returns {Array<object>}
 */
export function selectReviewQueue(issues) {
  return (issues ?? [])
    .filter((i) => i.needsReview)
    .sort((a, b) => priorityOf(b) - priorityOf(a));
}

// ──────────── 유사 신고 통합 판정 (Issue #13) ────────────

/**
 * 통합 후보 탐색 — 반경 + 동일 유형 + 시간창 + 미완료 문제.
 * 신뢰도가 임계값 미만인 신고는 자동 통합 후보를 만들지 않는다 (Issue #11).
 *
 * 강제로 묶지 않고 **후보만 돌려준다** — 최종 선택은 신고자가 한다(제안서 5p, 멘토 피드백 반영).
 *
 * @param {Array<object>} issues 기존 대표 문제 목록
 * @param {{lat:number, lng:number, type:string, confidence?:number}} report 새 신고
 * @param {{now?:number, params?:typeof MERGE_PARAMS}} [opts]
 * @returns {Array<{issue:object, distance:number}>} 가까운 순
 */
export function findMergeCandidates(issues, report, opts = {}) {
  const params = opts.params ?? MERGE_PARAMS;
  const now = opts.now ?? Date.now();

  // 신뢰도 미달 → 자동 통합 제외 (검수 큐로 보낸다)
  if (report?.confidence != null && !isAutoMergeEligible(report, params)) return [];

  const windowMs = params.windowHours * 3600 * 1000;

  return (issues ?? [])
    .filter((issue) => issue.status !== '완료')
    .filter((issue) => issue.type === report.type)
    .filter((issue) => now - new Date(issue.lastReportAt).getTime() <= windowMs)
    .map((issue) => ({
      issue,
      distance: Math.round(distanceM(report.lat, report.lng, issue.lat, issue.lng)),
    }))
    .filter(({ distance }) => distance <= params.radiusM)
    .sort((a, b) => a.distance - b.distance);
}

// ──────────────────────── 상태 ────────────────────────

/** 정의된 상태인지 */
export function isValidStatus(status) {
  return STATUS_FLOW.includes(status);
}

/** 상태의 진행 단계 인덱스 (없으면 -1) */
export function statusIndex(status) {
  return STATUS_FLOW.indexOf(status);
}

// ───────────────── 응답 변환 (API 계약 4장) ─────────────────

/**
 * 내부 issue → API 계약의 issueSummary 형태로 변환.
 * 라우터가 이 함수만 쓰면 응답 형태가 계약과 어긋나지 않는다.
 * @param {object} issue
 * @returns {object}
 */
export function summarizeIssue(issue) {
  const active = (issue.reports ?? []).filter((r) => !r.spam);
  const priority = priorityOf(issue);
  return {
    id: issue.id,
    type: issue.type,
    address: issue.address,
    lat: issue.lat,
    lng: issue.lng,
    dept: issue.dept ?? deptFor(issue.type),
    status: issue.status,
    statusIndex: statusIndex(issue.status),
    priority,
    priorityLabel: priorityLabel(priority),
    reportCount: active.length,
    empathy: issue.empathyDevices?.length ?? 0,
    needsReview: Boolean(issue.needsReview),
    thumbnail: active[0]?.photoUrl ?? null,
    createdAt: issue.createdAt,
    lastReportAt: issue.lastReportAt,
  };
}
