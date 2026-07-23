import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { handleRequest } from '../src/router.js';

/**
 * 프로덕션 하드닝 (Issue #56 · #57)
 * 요청 본문 상한(413)과 관리자 API 인증을 실제 HTTP 서버로 검증한다.
 */

let server;
let base;

test.before(async () => {
  server = http.createServer(handleRequest);
  await new Promise((resolve) => server.listen(0, resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

test.after(() => new Promise((resolve) => server.close(resolve)));

test('#57 본문이 상한을 넘으면 413으로 거절된다', async () => {
  process.env.MOA_MAX_BODY_BYTES = String(1024); // 1KB로 낮춰 시험
  try {
    const res = await fetch(`${base}/api/reports`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ padding: 'x'.repeat(5000) }),
    });
    assert.equal(res.status, 413);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.ok(body.errors[0].message.includes('초과'));
  } finally {
    delete process.env.MOA_MAX_BODY_BYTES;
  }
});

test('#57 Content-Length가 상한 초과를 선언하면 본문을 읽기 전에 끊는다', async () => {
  process.env.MOA_MAX_BODY_BYTES = String(1024);
  try {
    const res = await fetch(`${base}/api/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': '99999999' },
      body: 'x'.repeat(2000),
    }).catch(() => null);
    // 서버가 연결을 끊거나 413을 주거나 — 어느 쪽이든 200이어서는 안 된다.
    if (res) assert.equal(res.status, 413);
  } finally {
    delete process.env.MOA_MAX_BODY_BYTES;
  }
});

test('#57 상한 이내 요청은 정상 처리된다', async () => {
  const res = await fetch(`${base}/api/health`);
  assert.equal(res.status, 200);
});

test('#56 MOA_ADMIN_TOKEN 미설정이면 관리자 API가 열려 있다 (로컬 데모)', async () => {
  delete process.env.MOA_ADMIN_TOKEN;
  const res = await fetch(`${base}/api/admin/stats`);
  assert.equal(res.status, 200);
});

test('#56 토큰 설정 시 Authorization 없는 관리자 요청은 401', async () => {
  process.env.MOA_ADMIN_TOKEN = 'team04-secret';
  try {
    const res = await fetch(`${base}/api/admin/stats`);
    assert.equal(res.status, 401);
    const body = await res.json();
    assert.equal(body.errors[0].field, 'authorization');
  } finally {
    delete process.env.MOA_ADMIN_TOKEN;
  }
});

test('#56 잘못된 토큰은 401, 올바른 Bearer 토큰은 200', async () => {
  process.env.MOA_ADMIN_TOKEN = 'team04-secret';
  try {
    const wrong = await fetch(`${base}/api/admin/stats`, {
      headers: { Authorization: 'Bearer nope' },
    });
    assert.equal(wrong.status, 401);

    const ok = await fetch(`${base}/api/admin/stats`, {
      headers: { Authorization: 'Bearer team04-secret' },
    });
    assert.equal(ok.status, 200);
  } finally {
    delete process.env.MOA_ADMIN_TOKEN;
  }
});

test('#56 시민 API는 관리자 토큰 설정과 무관하게 동작한다', async () => {
  process.env.MOA_ADMIN_TOKEN = 'team04-secret';
  try {
    const res = await fetch(`${base}/api/health`);
    assert.equal(res.status, 200);
  } finally {
    delete process.env.MOA_ADMIN_TOKEN;
  }
});

test('#56 MOA_ALLOWED_ORIGIN 설정 시 CORS가 해당 origin으로 제한된다', async () => {
  process.env.MOA_ALLOWED_ORIGIN = 'https://moa.example.com';
  try {
    const res = await fetch(`${base}/api/health`);
    assert.equal(res.headers.get('access-control-allow-origin'), 'https://moa.example.com');
    assert.equal(res.headers.get('vary'), 'Origin');
  } finally {
    delete process.env.MOA_ALLOWED_ORIGIN;
  }
});
