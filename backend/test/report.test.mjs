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

// ─── Presigned URL ────────────────────────────────────

test('POST /api/upload/presigned 정상 발급', async () => {
  const res = await request('POST', '/api/upload/presigned', {
    filename: 'photo.jpg',
    contentType: 'image/jpeg',
  });
  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.ok(res.body.data.uploadUrl.includes('s3'));
  assert.ok(res.body.data.fileKey.startsWith('reports/'));
  assert.equal(res.body.data.expiresIn, 600);
});

test('POST /api/upload/presigned — filename 누락 시 400', async () => {
  const res = await request('POST', '/api/upload/presigned', {
    contentType: 'image/jpeg',
  });
  assert.equal(res.status, 400);
  assert.equal(res.body.success, false);
  assert.ok(res.body.errors.some((e) => e.field === 'filename'));
});

test('POST /api/upload/presigned — 지원하지 않는 형식', async () => {
  const res = await request('POST', '/api/upload/presigned', {
    filename: 'doc.pdf',
    contentType: 'application/pdf',
  });
  assert.equal(res.status, 400);
  assert.ok(res.body.errors.some((e) => e.field === 'filename'));
});

test('POST /api/upload/presigned — 10MB 초과', async () => {
  const res = await request('POST', '/api/upload/presigned', {
    filename: 'big.jpg',
    contentType: 'image/jpeg',
    fileSize: 11 * 1024 * 1024,
  });
  assert.equal(res.status, 400);
  assert.ok(res.body.errors.some((e) => e.field === 'fileSize'));
});

// ─── 신고 접수 ────────────────────────────────────────

test('POST /api/reports 정상 접수', async () => {
  const res = await request('POST', '/api/reports', {
    photos: ['https://example.com/photo1.jpg', 'https://example.com/photo2.jpg'],
    latitude: 37.5665,
    longitude: 126.978,
    address: '서울특별시 중구 세종대로 110',
  });
  assert.equal(res.status, 201);
  assert.equal(res.body.success, true);
  assert.ok(res.body.data.receiptNo.startsWith('MOA-'));
  assert.ok(res.body.data.viewToken.length === 32); // hex 16 bytes = 32 chars
});

test('POST /api/reports — photos 누락 시 400', async () => {
  const res = await request('POST', '/api/reports', {
    latitude: 37.5665,
    longitude: 126.978,
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
  });
  assert.equal(res.status, 400);
  assert.ok(res.body.errors.some((e) => e.field === 'photos'));
});

test('POST /api/reports — 위도 범위 초과 시 400', async () => {
  const res = await request('POST', '/api/reports', {
    photos: ['https://example.com/a.jpg'],
    latitude: 91,
    longitude: 126.978,
  });
  assert.equal(res.status, 400);
  assert.ok(res.body.errors.some((e) => e.field === 'latitude'));
});

test('POST /api/reports — 경도 누락 시 400', async () => {
  const res = await request('POST', '/api/reports', {
    photos: ['https://example.com/a.jpg'],
    latitude: 37.5665,
  });
  assert.equal(res.status, 400);
  assert.ok(res.body.errors.some((e) => e.field === 'longitude'));
});

// ─── 신고 조회 ────────────────────────────────────────

test('GET /api/reports/:receiptNo — 정상 조회', async () => {
  // 먼저 접수
  const create = await request('POST', '/api/reports', {
    photos: ['https://example.com/photo.jpg'],
    latitude: 37.5665,
    longitude: 126.978,
    address: '서울시 중구',
  });
  const { receiptNo, viewToken } = create.body.data;

  // 조회
  const res = await request('GET', `/api/reports/${receiptNo}?token=${viewToken}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.data.receiptNo, receiptNo);
  assert.deepEqual(res.body.data.photos, ['https://example.com/photo.jpg']);
  assert.equal(res.body.data.location.latitude, 37.5665);
  assert.equal(res.body.data.status, 'received');
});

test('GET /api/reports/:receiptNo — 없는 접수번호 시 404', async () => {
  const res = await request('GET', '/api/reports/MOA-00000000-00000');
  assert.equal(res.status, 404);
});

test('GET /api/reports/:receiptNo — 잘못된 토큰 시 403', async () => {
  const create = await request('POST', '/api/reports', {
    photos: ['https://example.com/photo.jpg'],
    latitude: 37.5665,
    longitude: 126.978,
  });
  const { receiptNo } = create.body.data;

  const res = await request('GET', `/api/reports/${receiptNo}?token=wrong-token`);
  assert.equal(res.status, 403);
});

// ─── 404 ──────────────────────────────────────────────

test('없는 경로 접근 시 404', async () => {
  const res = await request('GET', '/api/unknown');
  assert.equal(res.status, 404);
});
