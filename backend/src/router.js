import crypto from 'node:crypto';
import { validateStatusLookup, validateUploadRequest, validateReportRequest } from './schema.js';
import { generatePresignedUrl, verifyUploadSignature } from './upload.js';
import { saveUpload, readUpload, isValidFileKey } from './upload-store.js';
import { submitReport } from './report-service.js';
import { consumeReportSlot, consumeGeocodeSlot, consumeAnalyzeSlot, consumeUploadSlot } from './report-limit.js';
import { reverseGeocode } from './geocode.js';
import { getReportByReceiptNo } from './store.js';
import { matchesViewToken } from './view-token.js';
import { TYPES, STATUS_FLOW, MERGE_PARAMS, summarizeIssue } from './domain.js';
import { classify } from './classifier.js';
import {
  addEmpathy, changeStatus, findIssueByReceiptNo, issueDetail, issuesAround, listIssues,
  markSpam, nearbyCandidates, reclassifyReport, splitReport, stats,
} from './issue-service.js';

class InvalidJsonError extends Error {
  constructor() {
    super('잘못된 JSON 형식입니다.');
    this.name = 'InvalidJsonError';
  }
}

class BodyTooLargeError extends Error {
  constructor(limit) {
    super(`요청 본문이 허용 크기(${Math.round(limit / 1024 / 1024)}MB)를 초과했습니다.`);
    this.name = 'BodyTooLargeError';
  }
}

/**
 * HTTP 라우터 (Issue #9 · #55~#58)
 * ─────────────────────────────────────────────────────
 * node:http 기반 최소 라우터. 향후 Express/Fastify 도입 시 교체 가능.
 *
 * API 경로 (docs/API_CONTRACT.md 기준):
 *   [시민]  POST /api/uploads/presign · PUT|GET /uploads/:fileKey
 *           POST /api/reports · POST /api/analyze
 *           GET  /api/issues/nearby · GET /api/issues/map · POST /api/issues/:id/empathy
 *           GET  /api/status/:receiptNo?token=
 *   [관리자] /api/admin/* — MOA_ADMIN_TOKEN 설정 시 Bearer 인증 필수 (#56)
 */

/** 요청 본문 상한 (#57) — /api/analyze의 base64 사진까지 감안한 기본값 15MB */
function maxBodyBytes() {
  return Number(process.env.MOA_MAX_BODY_BYTES ?? 15 * 1024 * 1024);
}

/**
 * 요청 본문을 크기 상한과 함께 버퍼로 읽는다 (#57).
 * Content-Length가 상한을 넘으면 읽기 전에 끊고, 스트리밍 중 초과해도 즉시 중단한다.
 */
function readRawBody(req, limit = maxBodyBytes()) {
  return new Promise((resolve, reject) => {
    const declared = Number(req.headers['content-length']);
    if (Number.isFinite(declared) && declared > limit) {
      reject(new BodyTooLargeError(limit));
      return;
    }

    const chunks = [];
    let received = 0;
    req.on('data', (chunk) => {
      received += chunk.length;
      if (received > limit) {
        req.destroy();
        reject(new BodyTooLargeError(limit));
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

/** 요청 본문을 JSON으로 파싱 */
async function parseBody(req) {
  const raw = (await readRawBody(req)).toString('utf8');
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    throw new InvalidJsonError();
  }
}

/** JSON 응답 전송 헬퍼 */
function json(res, statusCode, data) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

/**
 * 클라이언트 IP — 레이트리밋의 버킷 키.
 * X-Forwarded-For는 발신자가 위조할 수 있으므로 **신뢰 프록시 뒤일 때만** 파싱한다
 * (MOA_TRUST_PROXY=1). 이때도 신뢰 프록시가 덧붙인 맨 오른쪽 값을 취해야
 * 공격자가 앞에 끼워넣은 값에 속지 않는다. 미설정(직접 노출)이면 항상 소켓 IP.
 */
function clientIp(req) {
  const socketIp = req.socket?.remoteAddress || 'unknown';
  if (process.env.MOA_TRUST_PROXY !== '1') return socketIp;

  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd !== 'string' || fwd.length === 0) return socketIp;
  const parts = fwd.split(',').map((s) => s.trim()).filter(Boolean);
  // 신뢰 프록시가 append하므로 맨 오른쪽이 프록시가 본 실제 원 IP.
  return parts[parts.length - 1] || socketIp;
}

/**
 * 관리자 인증 (#56) — 언제나 잠겨 있다.
 * MOA_ADMIN_TOKEN이 없으면 부팅 때 만든 임시 토큰을 쓰고 콘솔에 출력한다
 * (server.js). "설정을 깜빡해서 콘솔이 공개되는" 사고를 원천 차단한다.
 */
export const BOOT_ADMIN_TOKEN = crypto.randomBytes(8).toString('hex');

function isAdminAuthorized(req) {
  const required = process.env.MOA_ADMIN_TOKEN || BOOT_ADMIN_TOKEN;

  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return false;

  // 길이가 달라도 비교 시간이 같도록 해시끼리 비교한다.
  const a = crypto.createHash('sha256').update(token).digest();
  const b = crypto.createHash('sha256').update(required).digest();
  return crypto.timingSafeEqual(a, b);
}

/** 라우터 오류를 공개 가능한 HTTP 응답과 최소 로그로 변환한다. */
export function respondToRouterError(err, method, res, logError = console.error) {
  if (err instanceof InvalidJsonError) {
    return json(res, 400, {
      success: false,
      errors: [{ field: 'body', message: '잘못된 JSON 형식입니다.' }],
    });
  }
  if (err instanceof BodyTooLargeError) {
    return json(res, 413, {
      success: false,
      errors: [{ field: 'body', message: err.message }],
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

  // CORS (#56) — MOA_ALLOWED_ORIGIN 설정 시 그 origin만, 미설정 시 개발용 전체 허용
  const allowedOrigin = process.env.MOA_ALLOWED_ORIGIN || '*';
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  if (allowedOrigin !== '*') res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  try {
    // ─── 업로드 실저장 (Issue #55) ───────────────────────
    // PUT: presign 서명이 있어야만 저장 가능. GET: 키(UUID)를 아는 쪽만 접근.
    if (pathname.startsWith('/uploads/')) {
      const fileKey = decodeURIComponent(pathname.slice('/uploads/'.length));

      if (method === 'PUT') {
        // 디스크 소진 방지 — IP 분당 업로드 건수 제한 (서명 검증 전에 값싸게 거른다)
        if (!consumeUploadSlot(clientIp(req)).allowed) {
          return json(res, 429, { success: false, errors: [{ field: 'upload', message: '업로드가 너무 잦습니다. 잠시 후 다시 시도해 주세요.' }] });
        }
        if (!isValidFileKey(fileKey)
          || !verifyUploadSignature(fileKey, url.searchParams.get('exp'), url.searchParams.get('sig'))) {
          return json(res, 403, { success: false, errors: [{ field: 'sig', message: '유효한 업로드 서명이 필요합니다. presign을 다시 발급받아 주세요.' }] });
        }
        const buffer = await readRawBody(req, 10 * 1024 * 1024); // presign 검증과 같은 10MB 상한
        if (buffer.length === 0) {
          return json(res, 400, { success: false, errors: [{ field: 'body', message: '업로드할 이미지 데이터가 없습니다.' }] });
        }
        const saved = saveUpload(fileKey, buffer);
        if (!saved.ok) {
          const status = saved.reason === 'exists' ? 409 : 400;
          return json(res, status, { success: false, errors: [{ field: 'fileKey', message: saved.reason === 'exists' ? '이미 업로드된 파일입니다.' : '파일 키가 올바르지 않습니다.' }] });
        }
        return json(res, 201, { success: true, data: { publicUrl: `/uploads/${fileKey}` } });
      }

      if (method === 'GET') {
        const found = readUpload(fileKey);
        if (!found) {
          return json(res, 404, { success: false, errors: [{ field: 'fileKey', message: '파일을 찾을 수 없습니다.' }] });
        }
        // 키에 UUID가 들어 있어 내용이 바뀌지 않는다 — 캐시를 길게 준다.
        res.writeHead(200, {
          'Content-Type': found.contentType,
          'Content-Length': found.buffer.length,
          'Cache-Control': 'public, max-age=31536000, immutable',
        });
        res.end(found.buffer);
        return;
      }
    }

    // ─── POST /api/uploads/presign ───────────────────────
    if (method === 'POST' && pathname === '/api/uploads/presign') {
      if (!consumeUploadSlot(clientIp(req)).allowed) {
        return json(res, 429, { success: false, errors: [{ field: 'upload', message: '업로드 준비 요청이 너무 잦습니다. 잠시 후 다시 시도해 주세요.' }] });
      }
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

      // 익명 신고 남발 방지 — 같은 IP 시간당 5건 (계약 보안 규칙 3)
      if (!consumeReportSlot(clientIp(req)).allowed) {
        return json(res, 429, {
          success: false,
          errors: [{ field: 'reports', message: '신고가 너무 잦습니다. 잠시 후 다시 접수해 주세요.' }],
        });
      }

      const { receiptNo, viewToken, issue, merged } = submitReport(body);

      return json(res, 201, {
        success: true,
        data: {
          receiptNo,
          viewToken,
          statusPath: `/status/${receiptNo}?token=${viewToken}`,
          issue: summarizeIssue(issue),
          merged,
        },
      });
    }

    // ─── POST /api/analyze (Issue #10·#11 · Gemini 연동) ─────────
    // 사진 유형을 분류하고 검수 필요 여부를 함께 알려준다.
    if (method === 'POST' && pathname === '/api/analyze') {
      // 가장 비싼 자원(외부 유료 호출·CPU) — 인증 없는 익명 반복을 IP 분당 건수로 막는다.
      if (!consumeAnalyzeSlot(clientIp(req)).allowed) {
        return json(res, 429, { success: false, errors: [{ field: 'analyze', message: 'AI 분석 요청이 너무 잦습니다. 잠시 후 다시 시도해 주세요.' }] });
      }
      const body = await parseBody(req);
      const source = body?.photo || body?.photoUrl || body?.filename;
      if (!source) {
        return json(res, 400, {
          success: false,
          errors: [{ field: 'photo', message: '분류할 사진(photo 또는 photoUrl)이 필요합니다.' }],
        });
      }

      // dataURL이면 바이트와 MIME을, URL이면 경로 문자열을 분류 입력으로 쓴다.
      const dataUrlMatch = typeof body.photo === 'string'
        ? body.photo.match(/^data:([^;,]+);base64,(.+)$/)
        : null;
      const buffer = dataUrlMatch
        ? Buffer.from(dataUrlMatch[2], 'base64')
        : Buffer.from(String(source), 'utf8');
      const mimeType = dataUrlMatch?.[1];
      const filename = body.filename || String(body.photoUrl || '');

      const result = await classify({ buffer, filename, mimeType });
      return json(res, 200, { success: true, data: result });
    }

    // ─── GET /api/issues/nearby?lat=&lng=&type= (Issue #13·#14) ──
    if (method === 'GET' && pathname === '/api/issues/nearby') {
      const lat = Number(url.searchParams.get('lat'));
      const lng = Number(url.searchParams.get('lng'));
      const type = url.searchParams.get('type') || '';

      if (!Number.isFinite(lat) || !Number.isFinite(lng) || !TYPES.includes(type)) {
        return json(res, 400, {
          success: false,
          errors: [{ field: 'query', message: 'lat, lng, type(유효한 유형)이 필요합니다.' }],
        });
      }

      const candidates = nearbyCandidates({ lat, lng, type, confidence: 1 });
      return json(res, 200, { success: true, data: { params: MERGE_PARAMS, candidates } });
    }

    // ─── GET /api/geocode/reverse?lat=&lng= (실주소 표시) ───────
    if (method === 'GET' && pathname === '/api/geocode/reverse') {
      const lat = Number(url.searchParams.get('lat'));
      const lng = Number(url.searchParams.get('lng'));
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return json(res, 400, {
          success: false,
          errors: [{ field: 'query', message: 'lat, lng가 필요합니다.' }],
        });
      }
      // 외부 지오코딩 API의 중계 창구로 악용되지 않게 IP당 횟수를 막는다.
      if (!consumeGeocodeSlot(clientIp(req)).allowed) {
        return json(res, 429, {
          success: false,
          errors: [{ field: 'geocode', message: '주소 조회가 너무 잦습니다. 잠시 후 다시 시도해 주세요.' }],
        });
      }
      const { address } = await reverseGeocode(lat, lng);
      return json(res, 200, { success: true, data: { address } });
    }

    // ─── GET /api/issues/map?lat=&lng=&radiusM= ('내 주변' 탭) ───
    if (method === 'GET' && pathname === '/api/issues/map') {
      const lat = Number(url.searchParams.get('lat'));
      const lng = Number(url.searchParams.get('lng'));
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return json(res, 400, {
          success: false,
          errors: [{ field: 'query', message: 'lat, lng가 필요합니다.' }],
        });
      }
      const issues = issuesAround({ lat, lng, radiusM: url.searchParams.get('radiusM') });
      return json(res, 200, { success: true, data: { issues } });
    }

    // ─── POST /api/issues/:id/empathy (Issue #15·#58) ────────────
    if (method === 'POST' && /^\/api\/issues\/[^/]+\/empathy$/.test(pathname)) {
      const issueId = pathname.split('/')[3];
      const body = await parseBody(req);
      // deviceId는 저장·영속화되므로 형식을 강제해 대용량·임의 타입 주입을 막는다.
      if (typeof body?.deviceId !== 'string' || !/^[A-Za-z0-9_-]{8,64}$/.test(body.deviceId)) {
        return json(res, 400, { success: false, errors: [{ field: 'deviceId', message: '유효한 deviceId(영문·숫자 8~64자)가 필요합니다.' }] });
      }

      const result = addEmpathy(issueId, body.deviceId, { ip: clientIp(req) });
      if (!result) return json(res, 404, { success: false, errors: [{ field: 'id', message: '문제를 찾을 수 없습니다.' }] });
      if (result.limited) {
        return json(res, 429, { success: false, errors: [{ field: 'empathy', message: '잠시 후 다시 공감할 수 있습니다.' }] });
      }
      return json(res, 200, { success: true, data: result });
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
      // 대표 문제가 있으면 담당자가 바꾼 상태·이력을 함께 내려준다 (Issue #22).
      const issue = findIssueByReceiptNo(receiptNo);
      return json(res, 200, {
        success: true,
        data: {
          report: {
            receiptNo: report.receiptNo,
            status: issue?.status ?? report.status,
            createdAt: report.createdAt,
          },
          ...(issue ? {
            issue: {
              status: issue.status,
              statusFlow: STATUS_FLOW,
              dept: issue.dept,
              // 상태 변경 이력만 내려준다 — 통합된 다른 신고의 접수번호가
              // 담긴 이벤트(신고 접수/통합/공감)는 타인 정보라 제외한다.
              history: issue.history.filter((h) => h.event?.startsWith('상태 변경')),
            },
          } : {}),
        },
      });
    }

    // ─── 관리자 API (Issue #22 · #56 인증) ────────────────────────
    if (pathname.startsWith('/api/admin/')) {
      if (!isAdminAuthorized(req)) {
        return json(res, 401, {
          success: false,
          errors: [{ field: 'authorization', message: '관리자 토큰이 필요합니다.' }],
        });
      }
    }

    if (method === 'GET' && pathname === '/api/admin/stats') {
      return json(res, 200, { success: true, data: stats() });
    }

    if (method === 'GET' && pathname === '/api/admin/issues') {
      return json(res, 200, {
        success: true,
        data: listIssues({
          sort: url.searchParams.get('sort') || 'priority',
          queue: url.searchParams.get('queue'),
          status: url.searchParams.get('status'),
        }),
      });
    }

    if (method === 'GET' && pathname.startsWith('/api/admin/issues/')) {
      const detail = issueDetail(pathname.split('/')[4]);
      if (!detail) return json(res, 404, { success: false, errors: [{ field: 'id', message: '문제를 찾을 수 없습니다.' }] });
      return json(res, 200, { success: true, data: detail });
    }

    // 오통합 분리
    if (method === 'POST' && /^\/api\/admin\/issues\/[^/]+\/split$/.test(pathname)) {
      const body = await parseBody(req);
      const result = splitReport(pathname.split('/')[4], body?.reportId, body?.reason);
      if (result.error) return json(res, 400, { success: false, errors: [{ field: 'reportId', message: result.error }] });
      return json(res, 200, { success: true, data: result });
    }

    // 상태 변경
    if (method === 'PATCH' && pathname.startsWith('/api/admin/issues/')) {
      const body = await parseBody(req);
      const result = changeStatus(pathname.split('/')[4], body?.status);
      if (result.error) return json(res, 400, { success: false, errors: [{ field: 'status', message: result.error }] });
      return json(res, 200, { success: true, data: result.issue });
    }

    // 재분류 / 스팸 처리
    if (method === 'PATCH' && pathname.startsWith('/api/admin/reports/')) {
      const reportId = pathname.split('/')[4];
      const body = await parseBody(req);
      const result = body?.type !== undefined
        ? reclassifyReport(reportId, body.type)
        : markSpam(reportId, body?.spam);
      if (result.error) return json(res, 400, { success: false, errors: [{ field: 'report', message: result.error }] });
      return json(res, 200, { success: true, data: result });
    }

    // ─── 헬스체크 ────────────────────────────────────────
    if (method === 'GET' && pathname === '/api/health') {
      return json(res, 200, {
        status: 'ok',
        classifier: process.env.MOA_GEMINI_API_KEY ? 'gemini' : 'mock',
        adminAuth: process.env.MOA_ADMIN_TOKEN ? 'env' : 'boot-token',
        timestamp: new Date().toISOString(),
      });
    }

    // ─── 404 ─────────────────────────────────────────────
    json(res, 404, { success: false, errors: [{ field: 'path', message: `${method} ${pathname} 를 찾을 수 없습니다.` }] });
  } catch (err) {
    return respondToRouterError(err, method, res);
  }
}
