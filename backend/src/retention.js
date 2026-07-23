import { getAllIssues, markDirty } from './store.js';
import { deleteUpload } from './upload-store.js';

/**
 * 개인정보 보관기간 만료 스윕 (Issue #59 · SER-003)
 * ─────────────────────────────────────────────────────
 * docs/PRIVACY_POLICY.md 2장의 보관 기준을 실행한다.
 *  - 연락처: 처리 완료 후 30일 → 삭제
 *  - 사진·위치·조회 토큰 해시: 처리 완료 후 6개월(180일) → 삭제·비식별화
 *
 * 완료 시각은 issue.completedAt(상태가 '완료'로 바뀐 시각)을 기준으로 한다.
 * 삭제 로그는 정책 4장 3항에 따라 민감정보 원문 없이 건수만 남긴다.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
export const CONTACT_RETENTION_MS = 30 * DAY_MS;
export const MEDIA_RETENTION_MS = 180 * DAY_MS;

/** 좌표 비식별화 — 소수 2자리(약 1km 격자)로 낮춰 통계용 범위 정보만 남긴다 */
function coarsen(value) {
  return typeof value === 'number' ? Math.round(value * 100) / 100 : value;
}

function anonymizeReport(report) {
  for (const url of report.photos ?? []) {
    if (typeof url === 'string' && url.startsWith('/uploads/')) {
      deleteUpload(url.slice('/uploads/'.length));
    }
  }
  report.photos = [];
  report.photoUrl = null;
  report.lat = coarsen(report.lat);
  report.lng = coarsen(report.lng);
  report.address = null;
  if (report.location) {
    report.location = {
      latitude: coarsen(report.location.latitude),
      longitude: coarsen(report.location.longitude),
      address: null,
    };
  }
  report.viewTokenHash = null; // 조회 링크 무효화 (정책 2장)
  report.anonymizedAt = new Date().toISOString();
}

/**
 * 만료 데이터 스윕 — server.js가 주기 실행하고, 테스트는 now를 주입한다.
 * @param {number} [now]
 * @returns {{ contactsRemoved: number, reportsAnonymized: number }}
 */
export function sweepRetention(now = Date.now()) {
  let contactsRemoved = 0;
  let reportsAnonymized = 0;

  for (const issue of getAllIssues()) {
    if (issue.status !== '완료' || !issue.completedAt) continue;
    const age = now - new Date(issue.completedAt).getTime();
    if (age < CONTACT_RETENTION_MS) continue;

    for (const report of issue.reports ?? []) {
      if (report.contact) {
        delete report.contact;
        contactsRemoved += 1;
      }
      if (age >= MEDIA_RETENTION_MS && !report.anonymizedAt) {
        anonymizeReport(report);
        reportsAnonymized += 1;
      }
    }

    if (age >= MEDIA_RETENTION_MS && !issue.anonymizedAt) {
      issue.lat = coarsen(issue.lat);
      issue.lng = coarsen(issue.lng);
      issue.address = null;
      issue.anonymizedAt = new Date().toISOString();
    }
  }

  if (contactsRemoved || reportsAnonymized) {
    markDirty();
    console.log(`[retention] 만료 처리 — 연락처 ${contactsRemoved}건 삭제 · 신고 ${reportsAnonymized}건 비식별화`);
  }
  return { contactsRemoved, reportsAnonymized };
}
