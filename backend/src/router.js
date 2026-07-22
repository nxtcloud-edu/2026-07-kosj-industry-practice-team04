import { validateUploadRequest, validateReportRequest } from './schema.js';
import { generatePresignedUrl } from './upload.js';
import { submitReport } from './report-service.js';
import { getReportByReceiptNo } from './store.js';

/**
 * HTTP 라우터 (Issue #9)
 * ─────────────────────────────────────────────────────
 * node:http 기반 최소 라우터. 향후 Express/Fastify 도입 시 교체 가능.
 *
 * API 경로 (API_CONTRACT.md 기준):
 *   POST /api/uploads/presign       — presigned URL 발급
 *   POST /api/reports               — 신고 접수
 *   GET  /api/status/:receiptNo     — 신고 조회 (token 필수)
 *   GET  /api/health                — 헬스체크
 */

/**
 * 요청 본문을 JSON으로 파싱
 * @param {import('node:http').IncomingMessage} req
 * @returns {Promise<object>}
 */
function parseBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve(raw ? JSON.parse(raw) : {});
      } catch (e) {
        reject(new Error('잘못된 JSON 형식입니다.'));
      }
    });
    req.on('error', reject);
  });
}

/**
 * JSON 응답 전송 헬퍼
 */
function json(res, statusCode, data) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

/**
 * 라우팅 핸들러
 * @param {import('node:http').IncomingMessage} req
 * @param {import('node:http').ServerResponse} res
 */
export async function handleRequest(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const { pathname } = url;
  const method = req.method?.toUpperCase();

  // CORS (개발용)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  try {
    // ─── POST /api/uploads/presign ───────────────────────
    if (method === 'POST' && pathname === '/api/uploads/presign') {
      const body = await parseBody(req);
      const { valid, errors } = validateUploadRequest(body);
      if (!valid) {
        return json(res, 400, { success: false, errors });
      }

      const result = generatePresignedUrl({
        filename: body.filename,
        contentType: body.contentType,
      });

      return json(res, 200, { success: true, data: result });
    }

    // ─── POST /api/reports ───────────────────────────────
    if (method === 'POST' && pathname === '/api/reports') {
      const body = await parseBody(req);
      const { valid, errors } = validateReportRequest(body);
      if (!valid) {
        return json(res, 400, { success: false, errors });
      }

      const { receiptNo, viewToken } = submitReport(body);

      return json(res, 201, {
        success: true,
        data: { receiptNo, viewToken },
      });
    }

    // ─── GET /api/status/:receiptNo ──────────────────────
    if (method === 'GET' && pathname.startsWith('/api/status/')) {
      const receiptNo = pathname.replace('/api/status/', '');
      const token = url.searchParams.get('token');

      if (!receiptNo) {
        return json(res, 400, { success: false, errors: [{ field: 'receiptNo', message: '접수번호가 필요합니다.' }] });
      }

      const report = getReportByReceiptNo(receiptNo);
      if (!report) {
        return json(res, 404, { success: false, errors: [{ field: 'receiptNo', message: '해당 접수번호의 신고를 찾을 수 없습니다.' }] });
      }

      // 조회 토큰 검증 — 토큰이 없거나 틀리면 403
      if (!token || report.viewToken !== token) {
        return json(res, 403, { success: false, errors: [{ field: 'token', message: '유효한 조회 토큰이 필요합니다.' }] });
      }

      return json(res, 200, {
        success: true,
        data: {
          receiptNo: report.receiptNo,
          photos: report.photos,
          location: report.location,
          status: report.status,
          createdAt: report.createdAt,
        },
      });
    }

    // ─── 헬스체크 ────────────────────────────────────────
    if (method === 'GET' && pathname === '/api/health') {
      return json(res, 200, { status: 'ok', timestamp: new Date().toISOString() });
    }

    // ─── 404 ─────────────────────────────────────────────
    json(res, 404, { success: false, errors: [{ field: 'path', message: `${method} ${pathname} 를 찾을 수 없습니다.` }] });
  } catch (err) {
    console.error('[router]', err);
    json(res, 500, { success: false, errors: [{ field: 'server', message: err.message || '서버 내부 오류' }] });
  }
}
