/**
 * 공통 요청 헬퍼 — docs/API_CONTRACT.md 1장(응답 형태 규약)
 *
 * 성공: { success: true, data: {...} }  → data만 돌려준다
 * 실패: { success: false, errors: [{ field, message }] } → message를 합쳐 throw
 *
 * 봉투가 없는 응답(구버전·정적 목)도 그대로 통과시킨다.
 */
function apiBaseUrl() {
  const configured = (import.meta.env.VITE_API_BASE_URL || '').trim();
  if (!configured) return '';

  const normalized = configured.replace(/\/+$/, '');
  let parsed;
  try {
    parsed = new URL(normalized);
  } catch {
    throw new Error('VITE_API_BASE_URL은 HTTPS origin이어야 합니다.');
  }

  if (parsed.protocol !== 'https:' || parsed.origin !== normalized) {
    throw new Error('VITE_API_BASE_URL은 경로 없이 HTTPS origin만 허용합니다.');
  }
  return parsed.origin;
}

const API_BASE_URL = apiBaseUrl();

/** 상대 경로 사진 URL(/uploads/…)을 API 서버 기준 절대 경로로 바꾼다 */
export function photoSrc(url) {
  if (!url) return url;
  return url.startsWith('/') ? `${API_BASE_URL}${url}` : url;
}

/* ── 관리자 토큰 (#56) — 백엔드에 MOA_ADMIN_TOKEN이 설정된 경우에만 요구된다 ── */
const ADMIN_TOKEN_KEY = 'moa-admin-token';

export function getAdminToken() {
  try { return window.sessionStorage.getItem(ADMIN_TOKEN_KEY) || ''; } catch { return ''; }
}
export function setAdminToken(token) {
  try { window.sessionStorage.setItem(ADMIN_TOKEN_KEY, token); } catch { /* 세션 저장 불가 시 이번 요청만 실패 */ }
}
export function clearAdminToken() {
  try { window.sessionStorage.removeItem(ADMIN_TOKEN_KEY); } catch { /* 무시 */ }
}

async function req(method, url, body) {
  const headers = {};
  if (body) headers['Content-Type'] = 'application/json';
  if (url.startsWith('/api/admin/')) {
    const token = getAdminToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE_URL}${url}`, {
    method,
    headers: Object.keys(headers).length ? headers : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await res.json().catch(() => ({}));

  if (!res.ok || payload.success === false) {
    const detail = Array.isArray(payload.errors)
      ? payload.errors.map((e) => e.message).filter(Boolean).join(' / ')
      : payload.error;
    const error = new Error(detail || `요청 실패 (${res.status})`);
    error.status = res.status;
    throw error;
  }
  return payload.data ?? payload;
}

// ── 시민 (FE 팀이 사용) ──
/** 사진 업로드용 presigned URL 발급 — 응답의 publicUrl을 신고에 첨부한다 */
export const presignUpload = ({ filename, contentType, fileSize }) =>
  req('POST', '/api/uploads/presign', { filename, contentType, fileSize });

/** presign으로 받은 uploadUrl에 실제 사진 바이트를 올린다 (#55) */
export async function uploadPhoto(uploadUrl, file) {
  const res = await fetch(`${API_BASE_URL}${uploadUrl}`, { method: 'PUT', body: file });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok || payload.success === false) {
    const error = new Error(payload.errors?.[0]?.message || `사진 업로드 실패 (${res.status})`);
    error.status = res.status;
    throw error;
  }
  return payload.data; // { publicUrl }
}

export const analyzePhoto = (photo, filename) => req('POST', '/api/analyze', { photo, filename });
export const nearbyIssues = (lat, lng, type) =>
  req('GET', `/api/issues/nearby?lat=${lat}&lng=${lng}&type=${encodeURIComponent(type)}`);
/** '내 주변' 탭 — 반경 안 대표 문제의 공개 요약 (사진·개인정보 없음) */
export const issuesMap = (lat, lng, radiusM = 1500) =>
  req('GET', `/api/issues/map?lat=${lat}&lng=${lng}&radiusM=${radiusM}`);
/** 좌표 → 실주소 (실패 시 address: null — 좌표 표기로 폴백) */
export const reverseGeocode = (lat, lng) =>
  req('GET', `/api/geocode/reverse?lat=${lat}&lng=${lng}`);
export const createReport = (payload) => req('POST', '/api/reports', payload);
export const getStatus = (receiptNo, token) =>
  req('GET', `/api/status/${encodeURIComponent(receiptNo)}?token=${encodeURIComponent(token)}`);
export const addEmpathy = (issueId, deviceId) =>
  req('POST', `/api/issues/${issueId}/empathy`, { deviceId });

// ── 관리자 ──
export const adminIssues = (qs = '') => req('GET', `/api/admin/issues${qs}`);
export const adminIssue = (id) => req('GET', `/api/admin/issues/${id}`);
export const reclassify = (reportId, type) => req('PATCH', `/api/admin/reports/${reportId}`, { type });
export const markSpam = (reportId, spam) => req('PATCH', `/api/admin/reports/${reportId}`, { spam });
export const splitIssue = (issueId, reportId, reason) =>
  req('POST', `/api/admin/issues/${issueId}/split`, { reportId, reason });
export const setIssueStatus = (issueId, status) =>
  req('PATCH', `/api/admin/issues/${issueId}`, { status });
export const adminStats = () => req('GET', '/api/admin/stats');
