import { validateStatusLookup, validateUploadRequest, validateReportRequest } from './schema.js';
import { generatePresignedUrl } from './upload.js';
import { submitReport } from './report-service.js';
import { getReportByReceiptNo } from './store.js';
import { matchesViewToken } from './view-token.js';

class InvalidJsonError extends Error {
  constructor() {
    super('잘못된 JSON 형식입니다.');
    this.name = 'InvalidJsonError';
  }
}

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
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new InvalidJsonError());
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
 * 라우터 오류를 공개 가능한 HTTP 응답과 최소 로그로 변환한다.
 */
export function respondToRouterError(err, method, res, logError = console.error) {
  if (err instanceof InvalidJsonError) {
    return json(res, 400, {
      success: false,
      errors: [{ field: 'body', message: '잘못된 JSON 형식입니다.' }],
    });
  }

  logError({ event: 'UNEXPECTED_ERROR', method: method || 'UNKNOWN' });
  return json(res, 500, {
    success: false,
    errors: [{ field: 'server', message: '서버 내부 오류' }],
  });
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

      // 조회 URL의 토큰과 응답이 브라우저 캐시·후속 요청에 남지 않도록 제한한다.
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Referrer-Policy', 'no-referrer');

      if (!receiptNo) {
        return json(res, 400, { success: false, errors: [{ field: 'receiptNo', message: '접수번호가 필요합니다.' }] });
      }

      // 형식 오류·없는 번호·잘못된 토큰을 동일하게 처리해 접수번호 존재 여부를 숨긴다.
      if (!validateStatusLookup(receiptNo, token)) {
        return json(res, 403, { success: false, errors: [{ field: 'token', message: '유효한 조회 토큰이 필요합니다.' }] });
      }

      const report = getReportByReceiptNo(receiptNo);
      if (!report || !matchesViewToken(report.viewTokenHash, token)) {
        return json(res, 403, { success: false, errors: [{ field: 'token', message: '유효한 조회 토큰이 필요합니다.' }] });
      }

      // 시민 상태 화면에 필요한 최소 필드만 반환한다. 사진·위치·연락처·토큰은 제외한다.
      return json(res, 200, {
        success: true,
        data: {
          report: {
            receiptNo: report.receiptNo,
            status: report.status,
            createdAt: report.createdAt,
          },
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
    return respondToRouterError(err, method, res);
  }
}
