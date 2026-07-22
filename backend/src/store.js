/**
 * 인메모리 신고 저장소 (Issue #9)
 * ─────────────────────────────────────────────────────
 * MVP 단계에서는 인메모리 Map으로 신고 데이터를 관리한다.
 * 향후 DynamoDB, RDS 등 영속 저장소 도입 시 이 모듈만 교체한다.
 */

/** @type {Map<string, object>} receiptNo → report */
const reports = new Map();

/**
 * 신고 저장
 * @param {object} report
 * @returns {object} 저장된 report 객체
 */
export function saveReport(report) {
  reports.set(report.receiptNo, report);
  return report;
}

/**
 * 접수번호로 신고 조회
 * @param {string} receiptNo
 * @returns {object|undefined}
 */
export function getReportByReceiptNo(receiptNo) {
  return reports.get(receiptNo);
}

/**
 * 조회 토큰으로 신고 조회
 * @param {string} token
 * @returns {object|undefined}
 */
export function getReportByToken(token) {
  for (const report of reports.values()) {
    if (report.viewToken === token) return report;
  }
  return undefined;
}

/**
 * 전체 신고 목록 (관리자용)
 * @returns {object[]}
 */
export function getAllReports() {
  return [...reports.values()];
}

/**
 * 저장소 초기화 (테스트용)
 */
export function clearReports() {
  reports.clear();
}
