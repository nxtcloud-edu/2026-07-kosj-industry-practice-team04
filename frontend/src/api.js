async function req(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `요청 실패 (${res.status})`);
  return data;
}

// ── 시민 (FE 팀이 사용) ──
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
