import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { handleRequest, respondToRouterError } from '../src/router.js';
import { clearReports } from '../src/store.js';

// 테스트용 HTTP 서버 (포트 0 = 랜덤 할당)
let server;
let baseUrl;

test.before(async () => {
  server = http.createServer(handleRequest);
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();
  baseUrl = `http://localhost:${port}`;
});

test.after(async () => {
  server.close();
});

test.beforeEach(() => {
  clearReports();
});

// ─── 헬퍼 ─────────────────────────────────────────────

async function request(method, path, body) {
  const url = `${baseUrl}${path}`;
  const options = { method, headers: { 'Content-Type': 'application/json' } };
  const payload = body ? JSON.stringify(body) : undefined;

  return new Promise((resolve, reject) => {
    const req = http.request(url, options, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString();
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: raw ? JSON.parse(raw) : null,
        });
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function rawRequest(method, path, payload) {
  const url = `${baseUrl}${path}`;
  const options = { method, headers: { 'Content-Type': 'application/json' } };

  return new Promise((resolve, reject) => {
    const req = http.request(url, options, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString();
        resolve({
          status: res.statusCode,
          headers: res.headers,
          raw,
          body: raw ? JSON.parse(raw) : null,
        });
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function createResponseRecorder() {
  const result = { status: null, headers: null, raw: '' };
  const response = {
    writeHead(status, headers) {
      result.status = status;
      result.headers = headers;
    },
    end(raw) {
      result.raw = raw;
    },
  };

  return { response, result };
}

// ─── 헬스체크 ─────────────────────────────────────────

test('GET /api/health 정상 응답', async () => {
  const res = await request('GET', '/api/health');
  assert.equal(res.status, 200);
  assert.equal(res.body.status, 'ok');
});

// ─── Presigned URL (POST /api/uploads/presign) ────────

test('POST /api/uploads/presign 정상 발급', async () => {
  const res = await request('POST', '/api/uploads/presign', {
    filename: 'photo.jpg',
    contentType: 'image/jpeg',
  });
  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  // #55: mock S3 URL 대신 이 서버의 실제 업로드 엔드포인트(서명 포함)를 발급한다.
  assert.ok(res.body.data.uploadUrl.startsWith('/uploads/reports/'));
  assert.ok(res.body.data.uploadUrl.includes('sig='));
  assert.ok(res.body.data.fileKey.startsWith('reports/'));
  assert.equal(res.body.data.expiresIn, 600);
});

test('POST /api/uploads/presign — filename 누락 시 400', async () => {
  const res = await request('POST', '/api/uploads/presign', {
    contentType: 'image/jpeg',
  });
  assert.equal(res.status, 400);
  assert.equal(res.body.success, false);
  assert.ok(res.body.errors.some((e) => e.field === 'filename'));
});

test('POST /api/uploads/presign — 지원하지 않는 형식', async () => {
  const res = await request('POST', '/api/uploads/presign', {
    filename: 'doc.pdf',
    contentType: 'application/pdf',
  });
  assert.equal(res.status, 400);
  assert.ok(res.body.errors.some((e) => e.field === 'filename'));
});

test('POST /api/uploads/presign — 10MB 초과', async () => {
  const res = await request('POST', '/api/uploads/presign', {
    filename: 'big.jpg',
    contentType: 'image/jpeg',
    fileSize: 11 * 1024 * 1024,
  });
  assert.equal(res.status, 400);
  assert.ok(res.body.errors.some((e) => e.field === 'fileSize'));
});

test('POST /api/uploads/presign — 잘못된 JSON은 로그 없이 400을 반환한다', async () => {
  const originalConsoleError = console.error;
  const errorLogs = [];
  let res;

  console.error = (...args) => errorLogs.push(args);
  try {
    res = await rawRequest('POST', '/api/uploads/presign', '{invalid-json');
  } finally {
    console.error = originalConsoleError;
  }

  assert.equal(res.status, 400);
  assert.equal(res.headers['content-type'], 'application/json; charset=utf-8');
  assert.deepEqual(res.body, {
    success: false,
    errors: [{ field: 'body', message: '잘못된 JSON 형식입니다.' }],
  });
  assert.doesNotMatch(res.raw, /SyntaxError|Error|router\.js|file:\/\//);
  assert.equal(errorLogs.length, 0);
});

test('POST /api/uploads/presign — 빈 본문은 스키마 검증 400을 반환한다', async () => {
  const res = await rawRequest('POST', '/api/uploads/presign', '');

  assert.equal(res.status, 400);
  assert.ok(res.body.errors.some((error) => error.field === 'filename'));
  assert.ok(res.body.errors.some((error) => error.field === 'contentType'));
  assert.doesNotMatch(res.raw, /잘못된 JSON 형식입니다\./);
});

// ─── 신고 접수 (POST /api/reports) ────────────────────

test('POST /api/reports 정상 접수', async () => {
  const res = await request('POST', '/api/reports', {
    photos: ['https://example.com/photo1.jpg', 'https://example.com/photo2.jpg'],
    latitude: 37.5665,
    longitude: 126.978,
    address: '서울특별시 중구 세종대로 110',
    locationConsent: true,
  });
  assert.equal(res.status, 201);
  assert.equal(res.body.success, true);
  assert.ok(res.body.data.receiptNo.startsWith('MOA-'));
  assert.equal(res.body.data.viewToken.length, 32);
});

test('POST /api/reports — photos 누락 시 400', async () => {
  const res = await request('POST', '/api/reports', {
    latitude: 37.5665,
    longitude: 126.978,
    locationConsent: true,
  });
  assert.equal(res.status, 400);
  assert.ok(res.body.errors.some((e) => e.field === 'photos'));
});

test('POST /api/reports — 사진 11장 초과 시 400', async () => {
  const photos = Array.from({ length: 11 }, (_, i) => `https://example.com/${i}.jpg`);
  const res = await request('POST', '/api/reports', {
    photos,
    latitude: 37.5665,
    longitude: 126.978,
    locationConsent: true,
  });
  assert.equal(res.status, 400);
  assert.ok(res.body.errors.some((e) => e.field === 'photos'));
});

test('POST /api/reports — 위도 범위 초과 시 400', async () => {
  const res = await request('POST', '/api/reports', {
    photos: ['https://example.com/a.jpg'],
    latitude: 91,
    longitude: 126.978,
    locationConsent: true,
  });
  assert.equal(res.status, 400);
  assert.ok(res.body.errors.some((e) => e.field === 'latitude'));
});

test('POST /api/reports — 경도 누락 시 400', async () => {
  const res = await request('POST', '/api/reports', {
    photos: ['https://example.com/a.jpg'],
    latitude: 37.5665,
    locationConsent: true,
  });
  assert.equal(res.status, 400);
  assert.ok(res.body.errors.some((e) => e.field === 'longitude'));
});

test('POST /api/reports — locationConsent 없으면 400', async () => {
  const res = await request('POST', '/api/reports', {
    photos: ['https://example.com/a.jpg'],
    latitude: 37.5665,
    longitude: 126.978,
  });
  assert.equal(res.status, 400);
  assert.ok(res.body.errors.some((e) => e.field === 'locationConsent'));
});

test('POST /api/reports — locationConsent: false이면 400', async () => {
  const res = await request('POST', '/api/reports', {
    photos: ['https://example.com/a.jpg'],
    latitude: 37.5665,
    longitude: 126.978,
    locationConsent: false,
  });
  assert.equal(res.status, 400);
  assert.ok(res.body.errors.some((e) => e.field === 'locationConsent'));
});

test('POST /api/reports — 잘못된 JSON은 로그 없이 400을 반환한다', async () => {
  const originalConsoleError = console.error;
  const errorLogs = [];
  let res;

  console.error = (...args) => errorLogs.push(args);
  try {
    res = await rawRequest('POST', '/api/reports', '{invalid-json');
  } finally {
    console.error = originalConsoleError;
  }

  assert.equal(res.status, 400);
  assert.equal(res.headers['content-type'], 'application/json; charset=utf-8');
  assert.deepEqual(res.body, {
    success: false,
    errors: [{ field: 'body', message: '잘못된 JSON 형식입니다.' }],
  });
  assert.doesNotMatch(res.raw, /SyntaxError|Error|router\.js|file:\/\//);
  assert.equal(errorLogs.length, 0);
});

test('POST /api/reports — 빈 본문은 스키마 검증 400을 반환한다', async () => {
  const res = await rawRequest('POST', '/api/reports', '');

  assert.equal(res.status, 400);
  assert.ok(res.body.errors.some((error) => error.field === 'photos'));
  assert.ok(res.body.errors.some((error) => error.field === 'latitude'));
  assert.ok(res.body.errors.some((error) => error.field === 'longitude'));
  assert.ok(res.body.errors.some((error) => error.field === 'locationConsent'));
  assert.doesNotMatch(res.raw, /잘못된 JSON 형식입니다\./);
});

test('예상하지 못한 오류는 내부 정보를 숨기고 안전한 최소 로그만 남긴다', () => {
  const { response, result } = createResponseRecorder();
  const logCalls = [];

  respondToRouterError(
    new Error('sensitive-internal-detail'),
    'POST',
    response,
    (...args) => logCalls.push(args),
  );

  assert.equal(result.status, 500);
  assert.equal(result.headers['Content-Type'], 'application/json; charset=utf-8');
  assert.deepEqual(JSON.parse(result.raw), {
    success: false,
    errors: [{ field: 'server', message: '서버 내부 오류' }],
  });
  assert.doesNotMatch(result.raw, /sensitive-internal-detail|Error|router\.js|file:\/\//);
  assert.deepEqual(logCalls, [[{ event: 'UNEXPECTED_ERROR', method: 'POST' }]]);
});

// ─── 신고 조회 (GET /api/status/:receiptNo) ───────────

test('GET /api/status/:receiptNo — 올바른 토큰으로 조회 시 200', async () => {
  const create = await request('POST', '/api/reports', {
    photos: ['https://example.com/photo.jpg'],
    latitude: 37.5665,
    longitude: 126.978,
    address: '서울시 중구',
    locationConsent: true,
    contact: ' 010-1234-5678 ',
  });
  const { receiptNo, viewToken } = create.body.data;

  const res = await request('GET', `/api/status/${receiptNo}?token=${viewToken}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.data.report.receiptNo, receiptNo);
  assert.equal(res.body.data.report.status, '접수');
  assert.equal(res.body.data.report.createdAt.length > 0, true);
  assert.equal('photos' in res.body.data.report, false);
  assert.equal('location' in res.body.data.report, false);
  assert.equal('contact' in res.body.data.report, false);
  assert.equal('viewToken' in res.body.data.report, false);
  assert.equal('viewTokenHash' in res.body.data.report, false);
  assert.equal(res.headers['cache-control'], 'no-store');
  assert.equal(res.headers['referrer-policy'], 'no-referrer');
});

test('GET /api/status/:receiptNo — 없는 접수번호도 존재 여부를 숨기고 403', async () => {
  const res = await request('GET', '/api/status/MOA-00000000-00000?token=sometoken');
  assert.equal(res.status, 403);
  assert.equal(res.body.success, false);
  assert.equal(res.body.errors[0].field, 'token');
});

test('GET /api/status/:receiptNo — 토큰 없이 조회 시 403', async () => {
  const create = await request('POST', '/api/reports', {
    photos: ['https://example.com/photo.jpg'],
    latitude: 37.5665,
    longitude: 126.978,
    locationConsent: true,
  });
  const { receiptNo } = create.body.data;

  const res = await request('GET', `/api/status/${receiptNo}`);
  assert.equal(res.status, 403);
  assert.equal(res.body.success, false);
  assert.ok(res.body.errors.some((e) => e.field === 'token'));
});

test('GET /api/status/:receiptNo — 잘못된 토큰 시 403', async () => {
  const create = await request('POST', '/api/reports', {
    photos: ['https://example.com/photo.jpg'],
    latitude: 37.5665,
    longitude: 126.978,
    locationConsent: true,
  });
  const { receiptNo } = create.body.data;

  const res = await request('GET', `/api/status/${receiptNo}?token=wrong-token`);
  assert.equal(res.status, 403);
  assert.equal(res.body.success, false);
  assert.ok(res.body.errors.some((e) => e.field === 'token'));
});

test('GET /api/status/:receiptNo — 형식이 잘못된 접수번호·토큰도 403', async () => {
  const create = await request('POST', '/api/reports', {
    photos: ['https://example.com/photo.jpg'],
    latitude: 37.5665,
    longitude: 126.978,
    locationConsent: true,
  });
  const { receiptNo, viewToken } = create.body.data;

  const malformedReceipt = await request('GET', `/api/status/not-a-receipt?token=${viewToken}`);
  const malformedToken = await request('GET', `/api/status/${receiptNo}?token=${'z'.repeat(32)}`);

  assert.equal(malformedReceipt.status, 403);
  assert.equal(malformedToken.status, 403);
  assert.equal(malformedReceipt.body.errors[0].field, 'token');
  assert.equal(malformedToken.body.errors[0].field, 'token');
});

// ─── 404 ──────────────────────────────────────────────

test('없는 경로 접근 시 404', async () => {
  const res = await request('GET', '/api/unknown');
  assert.equal(res.status, 404);
});
