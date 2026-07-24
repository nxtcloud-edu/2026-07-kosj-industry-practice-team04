import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { handleRequest } from '../src/router.js';
import { clearReportLimits } from '../src/report-limit.js';
import { validateReportRequest } from '../src/schema.js';
import { kstDateCompact } from '../src/kst.js';
import { sweepRetention, ORPHAN_UPLOAD_MS } from '../src/retention.js';
import { saveUpload } from '../src/upload-store.js';
import { clearReports, clearIssues } from '../src/store.js';

/**
 * 전방위 감사(95 에이전트) 후속 수정 검증
 */

let server;
let base;

test.before(async () => {
  server = http.createServer(handleRequest);
  await new Promise((resolve) => server.listen(0, resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

test.after(() => new Promise((resolve) => server.close(resolve)));

test.beforeEach(() => clearReportLimits());

// ── XFF 신뢰 게이트 ──
test('X-Forwarded-For는 MOA_TRUST_PROXY 미설정 시 무시된다 (레이트리밋 우회 차단)', async () => {
  process.env.MOA_ANALYZE_LIMIT = '2';
  delete process.env.MOA_TRUST_PROXY;
  clearReportLimits();
  try {
    // 매 요청 다른 위조 XFF를 보내도 소켓 IP 하나로 묶여 3번째가 429여야 한다.
    const call = (ip) => fetch(`${base}/api/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': ip },
      body: JSON.stringify({ filename: 'x.jpg' }),
    });
    assert.equal((await call('1.1.1.1')).status, 200);
    assert.equal((await call('2.2.2.2')).status, 200);
    assert.equal((await call('3.3.3.3')).status, 429, '위조 XFF로 한도를 우회할 수 없어야 한다');
  } finally {
    delete process.env.MOA_ANALYZE_LIMIT;
    clearReportLimits();
  }
});

test('MOA_TRUST_PROXY=1이면 XFF 맨 오른쪽(신뢰 프록시가 본 IP)으로 구분한다', async () => {
  process.env.MOA_ANALYZE_LIMIT = '1';
  process.env.MOA_TRUST_PROXY = '1';
  clearReportLimits();
  try {
    const call = (xff) => fetch(`${base}/api/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': xff },
      body: JSON.stringify({ filename: 'x.jpg' }),
    });
    // 맨 오른쪽이 다르면 다른 클라이언트로 취급 → 둘 다 통과
    assert.equal((await call('9.9.9.9, 10.0.0.1')).status, 200);
    assert.equal((await call('9.9.9.9, 10.0.0.2')).status, 200);
    // 맨 오른쪽이 같으면 같은 클라이언트 → 두 번째는 429
    assert.equal((await call('1.1.1.1, 10.0.0.1')).status, 429);
  } finally {
    delete process.env.MOA_ANALYZE_LIMIT;
    delete process.env.MOA_TRUST_PROXY;
    clearReportLimits();
  }
});

// ── analyze 레이트리밋 ──
test('POST /api/analyze는 IP 분당 한도를 넘으면 429', async () => {
  process.env.MOA_ANALYZE_LIMIT = '1';
  clearReportLimits();
  try {
    const call = () => fetch(`${base}/api/analyze`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename: 'pothole.jpg' }),
    });
    assert.equal((await call()).status, 200);
    assert.equal((await call()).status, 429);
  } finally {
    delete process.env.MOA_ANALYZE_LIMIT;
    clearReportLimits();
  }
});

// ── photos 입력 검증 ──
test('photos에 임의 문자열/외부 스킴은 거부, 업로드 경로·https만 허용', () => {
  const base0 = { latitude: 36.48, longitude: 127.28, locationConsent: true };
  const bad = validateReportRequest({ ...base0, photos: ['javascript:alert(1)'] });
  assert.equal(bad.valid, false);
  assert.ok(bad.errors.some((e) => e.field === 'photos[0]'));

  const okUpload = validateReportRequest({ ...base0, photos: ['/uploads/reports/2026/07/24/11111111-2222-3333-4444-555555555555.jpg'] });
  assert.equal(okUpload.valid, true);

  const okHttps = validateReportRequest({ ...base0, photos: ['https://cdn.example.com/a.jpg'] });
  assert.equal(okHttps.valid, true);
});

// ── deviceId 검증 ──
test('공감 deviceId는 형식 위반 시 400 (대용량·임의 타입 주입 차단)', async () => {
  const call = (deviceId) => fetch(`${base}/api/issues/none/empathy`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deviceId }),
  });
  assert.equal((await call('x'.repeat(5000))).status, 400);
  assert.equal((await call('ab')).status, 400); // 너무 짧음
  // 형식은 통과하되 존재하지 않는 이슈라 404 (400 아님 = 검증 통과 확인)
  assert.equal((await call('valid-device-123')).status, 404);
});

// ── KST 접수번호 ──
test('접수번호 날짜는 KST 기준으로 생성된다', () => {
  // UTC 2026-07-23 22:00 = KST 2026-07-24 07:00 → 접수번호는 24가 찍혀야 한다
  const utcLateNight = new Date('2026-07-23T22:00:00Z');
  assert.equal(kstDateCompact(utcLateNight), '20260724');
});

// ── 고아 업로드 정리 ──
test('신고에 연결 안 된 업로드 파일은 유예 후 스윕에서 삭제된다', () => {
  clearReports();
  clearIssues();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'moa-orphan-'));
  process.env.MOA_UPLOAD_DIR = dir;
  try {
    const key = 'reports/2026/07/24/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee.jpg';
    saveUpload(key, Buffer.from('orphan'));
    const full = path.join(dir, key);
    assert.ok(fs.existsSync(full));

    // 유예 시간 전에는 남는다
    sweepRetention(Date.now());
    assert.ok(fs.existsSync(full), '유예 시간 내에는 삭제하지 않는다');

    // 유예 시간이 지나면 삭제된다
    const result = sweepRetention(Date.now() + ORPHAN_UPLOAD_MS + 1000);
    assert.equal(result.orphansRemoved, 1);
    assert.equal(fs.existsSync(full), false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
    delete process.env.MOA_UPLOAD_DIR;
  }
});
