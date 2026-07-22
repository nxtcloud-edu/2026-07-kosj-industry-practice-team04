import crypto from 'node:crypto';
import { saveReport } from './store.js';
import { generateViewToken, hashViewToken } from './view-token.js';

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
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
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

  const report = {
    receiptNo,
    viewTokenHash: hashViewToken(viewToken),
    photos: data.photos,
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

  return { receiptNo, viewToken, report };
}
