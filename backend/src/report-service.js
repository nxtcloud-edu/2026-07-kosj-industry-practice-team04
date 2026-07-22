import crypto from 'node:crypto';
import { saveReport } from './store.js';

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
 * 조회 토큰 생성 — 시민이 접수 결과를 조회할 때 사용하는 비밀 토큰
 * @returns {string}
 */
function generateViewToken() {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * 신고 접수
 * @param {{ photos: string[], latitude: number, longitude: number, address?: string, locationConsent: boolean }} data
 * @returns {{ receiptNo: string, viewToken: string, report: object }}
 */
export function submitReport(data) {
  const receiptNo = generateReceiptNo();
  const viewToken = generateViewToken();
  const now = new Date().toISOString();

  const report = {
    receiptNo,
    viewToken,
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
    status: '접수', // 접수 → 배정 → 처리중 → 완료
    createdAt: now,
    updatedAt: now,
  };

  saveReport(report);

  return { receiptNo, viewToken, report };
}
