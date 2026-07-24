import crypto from 'node:crypto';
import { saveReport } from './store.js';
import { generateViewToken, hashViewToken } from './view-token.js';
import { attachReportToIssue } from './issue-service.js';
import { needsReview } from './domain.js';
import { kstDateCompact } from './kst.js';

/**
 * 신고 접수 비즈니스 로직 (Issue #9 · SFR-001)
 * ─────────────────────────────────────────────────────
 * 신고를 접수하고 접수번호·조회 토큰을 생성한다.
 */

/**
 * 접수번호 생성 — MOA-YYYYMMDD-XXXXX 형식
 * @returns {string}
 */
function generateReceiptNo() {
  const date = kstDateCompact(); // KST 기준 — 자정~오전9시 접수분이 전날로 찍히지 않게
  const seq = crypto.randomInt(10000, 99999);
  return `MOA-${date}-${seq}`;
}

/**
 * 신고 접수
 * @param {{ photos: string[], latitude: number, longitude: number, address?: string, locationConsent: boolean, contact?: string }} data
 * @returns {{ receiptNo: string, viewToken: string, report: object }}
 */
export function submitReport(data) {
  const receiptNo = generateReceiptNo();
  const viewToken = generateViewToken();
  const contact = typeof data.contact === 'string' ? data.contact.trim() : '';
  const now = new Date().toISOString();
  const confidence = Number(data.confidence) || 0;

  const report = {
    id: `rp_${crypto.randomBytes(6).toString('hex')}`,
    receiptNo,
    viewTokenHash: hashViewToken(viewToken),
    photos: data.photos,
    // 대표 문제 판정·관리자 화면이 쓰는 평평한 필드 (Issue #22)
    photoUrl: data.photos?.[0] ?? null,
    lat: data.latitude,
    lng: data.longitude,
    address: data.address || null,
    type: data.type || '기타',
    confidence,
    needsReview: needsReview(confidence),
    spam: false,
    location: {
      latitude: data.latitude,
      longitude: data.longitude,
      address: data.address || null, // TODO: 역지오코딩 API 연동 후 자동 채움
    },
    // 위치정보 수집 동의 사실을 신고와 함께 보관한다 (SER-001, Issue #33).
    // 검증(schema)만으로는 "동의를 받았다"는 근거가 남지 않으므로 시각까지 기록.
    consent: {
      location: data.locationConsent === true,
      agreedAt: now,
    },
    // 연락처 존재 자체를 처리 알림 희망으로 본다. 미입력 시 필드도 만들지 않는다.
    ...(contact ? { contact } : {}),
    status: '접수', // 접수 → 배정 → 처리중 → 완료
    createdAt: now,
    updatedAt: now,
  };

  saveReport(report);

  // 신고를 대표 문제에 연결한다 — attachIssueId가 있으면 통합, 없으면 새 문제 (Issue #22)
  const { issue, merged } = attachReportToIssue(report, data.attachIssueId);

  return { receiptNo, viewToken, report, issue, merged };
}
