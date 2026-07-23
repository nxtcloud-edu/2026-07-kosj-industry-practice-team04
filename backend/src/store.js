import fs from 'node:fs';
import path from 'node:path';
import { matchesViewToken } from './view-token.js';

/**
 * 신고·대표 문제 저장소 (Issue #9 · #22 · #59)
 * ─────────────────────────────────────────────────────
 * 기본은 인메모리 Map. server.js가 initPersistence()를 호출하면
 * JSON 파일로 스냅숏을 남겨 재시작해도 데이터가 살아남는다.
 * (테스트는 initPersistence를 부르지 않으므로 순수 인메모리로 동작)
 *
 * 향후 DynamoDB/RDS 도입 시 이 모듈만 교체한다.
 */

/** @type {Map<string, object>} receiptNo → report */
const reports = new Map();

/** @type {Map<string, object>} issueId → issue */
const issues = new Map();

/* ───────────────────── 파일 영속화 (#59) ───────────────────── */

let dataFile = null;
let persistTimer = null;

/** 저장 예약 — 연속 변경을 300ms로 모아 한 번만 쓴다 */
function persist() {
  if (!dataFile) return;
  clearTimeout(persistTimer);
  persistTimer = setTimeout(flushNow, 300);
  persistTimer.unref?.();
}

/** 즉시 저장 (프로세스 종료 훅·스윕 직후용) */
export function flushNow() {
  if (!dataFile) return;
  clearTimeout(persistTimer);
  const snapshot = JSON.stringify({
    savedAt: new Date().toISOString(),
    reports: [...reports.values()],
    issues: [...issues.values()],
  });
  fs.mkdirSync(path.dirname(dataFile), { recursive: true });
  // 쓰다 만 파일이 데이터를 덮지 않도록 임시 파일에 쓴 뒤 원자적으로 교체한다.
  const tmp = `${dataFile}.tmp`;
  fs.writeFileSync(tmp, snapshot);
  fs.renameSync(tmp, dataFile);
}

/**
 * 파일 영속화 시작 — 파일이 있으면 읽어 복원한다.
 * issue.reports가 reports Map의 같은 객체를 가리키도록 다시 연결해
 * (스팸 처리·보관기한 삭제가 한 곳만 고치면 되도록) 참조를 복원한다.
 */
export function initPersistence(filePath) {
  dataFile = path.resolve(filePath);

  if (fs.existsSync(dataFile)) {
    try {
      const raw = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
      reports.clear();
      issues.clear();
      for (const r of raw.reports ?? []) reports.set(r.receiptNo, r);
      for (const i of raw.issues ?? []) {
        i.reports = (i.reports ?? [])
          .map((r) => reports.get(r.receiptNo) ?? r);
        issues.set(i.id, i);
      }
      console.log(`[moa-backend] 데이터 복원 — 신고 ${reports.size}건 · 문제 ${issues.size}건 (${dataFile})`);
    } catch (e) {
      console.error(`[moa-backend] 데이터 파일을 읽지 못했습니다 — 빈 상태로 시작: ${e.message}`);
    }
  }

  process.once('exit', () => { try { flushNow(); } catch { /* 종료 중 실패는 무시 */ } });
}

/* ───────────────────────── 신고 ───────────────────────── */

/** 신고 저장 */
export function saveReport(report) {
  reports.set(report.receiptNo, report);
  persist();
  return report;
}

/** 접수번호로 신고 조회 */
export function getReportByReceiptNo(receiptNo) {
  return reports.get(receiptNo);
}

/** 조회 토큰으로 신고 조회 */
export function getReportByToken(token) {
  for (const report of reports.values()) {
    if (matchesViewToken(report.viewTokenHash, token)) return report;
  }
  return undefined;
}

/** 전체 신고 목록 (관리자·보관기한 스윕용) */
export function getAllReports() {
  return [...reports.values()];
}

/** 저장소 초기화 (테스트용) */
export function clearReports() {
  reports.clear();
}

/* ─────────────────────── 대표 문제 ─────────────────────── */

/** 대표 문제 저장 */
export function saveIssue(issue) {
  issues.set(issue.id, issue);
  persist();
  return issue;
}

/** ID로 대표 문제 조회 */
export function getIssueById(id) {
  return issues.get(id);
}

/** 전체 대표 문제 목록 */
export function getAllIssues() {
  return [...issues.values()];
}

/** 문제 저장소 초기화 (테스트용) */
export function clearIssues() {
  issues.clear();
}

/** 변경사항 저장 예약 — 저장소 밖에서 객체를 직접 고친 뒤 호출한다 (retention.js) */
export function markDirty() {
  persist();
}
