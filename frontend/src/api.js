/**
 * 공통 요청 헬퍼 — docs/API_CONTRACT.md 1장(응답 형태 규약)
 *
 * 성공: { success: true, data: {...} }  → data만 돌려준다
 * 실패: { success: false, errors: [{ field, message }] } → message를 합쳐 throw
 *
 * 봉투가 없는 응답(구버전·정적 목)도 그대로 통과시킨다.
 */
async function req(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await res.json().catch(() => ({}));

  if (!res.ok || payload.success === false) {
    const detail = Array.isArray(payload.errors)
      ? payload.errors.map((e) => e.message).filter(Boolean).join(' / ')
      : payload.error;
    throw new Error(detail || `요청 실패 (${res.status})`);
  }
  return payload.data ?? payload;
}

// ── 시민 (FE 팀이 사용) ──
/** 사진 업로드용 presigned URL 발급 — 응답의 publicUrl을 신고에 첨부한다 */
export const presignUpload = ({ filename, contentType, fileSize }) =>
  req('POST', '/api/uploads/presign', { filename, contentType, fileSize });
export const analyzePhoto = (photo, filename) => req('POST', '/api/analyze', { photo, filename });
export const nearbyIssues = (lat, lng, type) =>
  req('GET', `/api/issues/nearby?lat=${lat}&lng=${lng}&type=${encodeURIComponent(type)}`);
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
