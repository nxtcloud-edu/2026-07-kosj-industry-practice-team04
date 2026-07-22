import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { handleRequest } from '../src/router.js';
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
          body: raw ? JSON.parse(raw) : null,
        });
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
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
  assert.ok(res.body.data.uploadUrl.includes('s3'));
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

// ─── 신고 조회 (GET /api/status/:receiptNo) ───────────

test('GET /api/status/:receiptNo — 올바른 토큰으로 조회 시 200', async () => {
  const create = await request('POST', '/api/reports', {
    photos: ['https://example.com/photo.jpg'],
    latitude: 37.5665,
    longitude: 126.978,
    address: '서울시 중구',
    locationConsent: true,
  });
  const { receiptNo, viewToken } = create.body.data;

  const res = await request('GET', `/api/status/${receiptNo}?token=${viewToken}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.data.receiptNo, receiptNo);
  assert.deepEqual(res.body.data.photos, ['https://example.com/photo.jpg']);
  assert.equal(res.body.data.location.latitude, 37.5665);
  assert.equal(res.body.data.status, '접수');
});

test('GET /api/status/:receiptNo — 없는 접수번호 시 404', async () => {
  const res = await request('GET', '/api/status/MOA-00000000-00000?token=sometoken');
  assert.equal(res.status, 404);
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

// ─── 404 ──────────────────────────────────────────────

test('없는 경로 접근 시 404', async () => {
  const res = await request('GET', '/api/unknown');
  assert.equal(res.status, 404);
});
