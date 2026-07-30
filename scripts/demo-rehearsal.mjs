/**
 * E2E 시연 리허설 (Issue #26)
 * ─────────────────────────────────────────────────────
 * docs/DEMO_SCENARIO.md의 전 단계를 실제 브라우저로 완주해
 * 발표 당일에 막힐 지점을 미리 찾는다.
 *
 * 사용법 (백엔드 :4000 · 프론트 :5173 가 떠 있는 상태에서)
 *   node scripts/demo-rehearsal.mjs
 *   node scripts/demo-rehearsal.mjs --keep   # 리허설 데이터 유지(시연 직전용)
 *
 * 종료 코드 0 = 전 단계 통과. 실패 단계는 이유와 함께 출력된다.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const API = process.env.MOA_API ?? 'http://localhost:4000';
const APP = process.env.MOA_APP ?? 'http://localhost:5173';
const ADMIN_TOKEN = process.env.MOA_ADMIN_TOKEN ?? 'demo-team04';
const SITE = { latitude: 36.60122, longitude: 127.29655 };

// puppeteer-core는 frontend의 devDependency로 둔다 (브라우저 관련 도구를 한곳에).
let puppeteer;
let CHROME = process.env.MOA_CHROME;
for (const from of [import.meta.url, new URL('../frontend/package.json', import.meta.url)]) {
  try { puppeteer = createRequire(from)('puppeteer-core'); break; } catch { /* 다음 경로 시도 */ }
}
if (!puppeteer) {
  console.error('puppeteer-core를 찾지 못했습니다.  cd frontend && npm install  후 다시 실행하세요.');
  process.exit(2);
}
if (!CHROME) {
  const candidates = [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    '/usr/bin/google-chrome',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ];
  CHROME = candidates.find((p) => fs.existsSync(p));
}
if (!CHROME) {
  console.error('Chrome을 찾지 못했습니다. MOA_CHROME 환경변수로 경로를 지정하세요.');
  process.exit(2);
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const J = { 'Content-Type': 'application/json' };
const post = (u, b, h = {}) => fetch(API + u, { method: 'POST', headers: { ...J, ...h }, body: JSON.stringify(b) });
const results = [];
let failed = 0;

function step(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log(`  ${ok ? '✓' : '✗'} ${name}${detail ? '  — ' + detail : ''}`);
  if (!ok) failed += 1;
}

/** 리허설용 도로 사진 (외부 파일 없이 생성) */
function demoPhoto() {
  const w = 640, h = 420;
  const crcT = [];
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; crcT[n] = c >>> 0; }
  const crc = (b) => { let c = 0xFFFFFFFF; for (const x of b) c = crcT[(c ^ x) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
  const chunk = (t, d) => {
    const l = Buffer.alloc(4); l.writeUInt32BE(d.length);
    const tt = Buffer.from(t); const c = Buffer.alloc(4); c.writeUInt32BE(crc(Buffer.concat([tt, d])));
    return Buffer.concat([l, tt, d, c]);
  };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  const raw = Buffer.alloc(h * (1 + w * 3));
  for (let y = 0; y < h; y++) {
    raw[y * (1 + w * 3)] = 0;
    for (let x = 0; x < w; x++) {
      const d = Math.hypot(x - 320, y - 250);
      let px;
      if (d < 95) px = [24 + d / 8, 22 + d / 8, 20 + d / 8];
      else if (d < 120) px = [76, 69, 62];
      else { const g = 126 + ((x * 7 + y * 13) % 22); px = [g, g - 4, g - 11]; }
      const o = y * (1 + w * 3) + 1 + x * 3;
      raw[o] = px[0]; raw[o + 1] = px[1]; raw[o + 2] = px[2];
    }
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
  ]);
}

(async () => {
  console.log('═'.repeat(60));
  console.log('  「모아」 E2E 시연 리허설');
  console.log('═'.repeat(60));

  // ── 0. 준비 상태 ──
  console.log('\n[0] 준비 상태');
  let health;
  try {
    health = await fetch(API + '/api/health').then((r) => r.json());
    step('백엔드 응답', health.status === 'ok', `분류 엔진 ${health.classifier}`);
  } catch (e) {
    step('백엔드 응답', false, e.message);
    console.log('\n백엔드(:4000)를 먼저 띄우세요. 리허설 중단.');
    process.exit(1);
  }
  if (health.classifier !== 'gemini') {
    console.log('  ⚠ 분류 엔진이 mock입니다 — 시연 시 유형이 부정확할 수 있습니다 (backend/.env의 MOA_GEMINI_API_KEY 확인)');
  }
  step('프론트 응답', (await fetch(APP).then((r) => r.status).catch(() => 0)) === 200);

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'moa-rehearsal-'));
  const photo = path.join(tmp, 'road.png');
  fs.writeFileSync(photo, demoPhoto());

  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--hide-scrollbars'],
    defaultViewport: { width: 390, height: 844 },
  });
  await browser.defaultBrowserContext().overridePermissions(APP, ['geolocation']);
  const errors = [];

  async function citizenPage(opts = {}) {
    const p = await browser.newPage();
    await p.setGeolocation(opts.geo ?? SITE);
    await p.evaluateOnNewDocument((t, s) => {
      localStorage.setItem('moa-accessibility-settings', JSON.stringify({ fontScale: s, theme: t }));
    }, opts.theme ?? 'light', opts.scale ?? 100);
    p.on('pageerror', (e) => errors.push(e.message.slice(0, 120)));
    return p;
  }

  /** 촬영 → 위치 → 접수까지 완주. attach=true면 유사 신고에 통합 */
  async function fileReport(p, { attach = false } = {}) {
    await p.goto(`${APP}/report/camera`, { waitUntil: 'networkidle2' });
    const input = await p.waitForSelector('input[type=file]', { timeout: 15000 });
    await input.uploadFile(photo);
    await p.waitForSelector('.camera-analysis', { timeout: 45000 });
    await p.waitForFunction(() => !document.querySelector('.camera-analyzing'), { timeout: 45000 });
    const ai = await p.$eval('.camera-analysis', (el) => el.innerText.replace(/\s+/g, ' ').trim());

    await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await wait(300);
    await p.click('.camera-next-btn');
    await p.waitForSelector('.location-agree__checkbox', { timeout: 15000 });
    await p.click('.location-agree__checkbox');
    await p.click('.location-btn');
    await p.waitForSelector('.location-map-card .leaflet-tile-loaded', { timeout: 30000 });
    const address = await p.waitForFunction(() => {
      const dd = document.querySelectorAll('.location-info-card__row dd');
      return dd.length > 1 && !/핀 위치 기준/.test(dd[1].textContent) ? dd[1].textContent.trim() : false;
    }, { timeout: 20000 }).then((h) => h.jsonValue()).catch(() => null);

    await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await wait(300);
    await p.click('.location-next-btn');
    await p.waitForSelector('.similar-choice', { timeout: 45000 });
    const candidate = await p.$eval('.similar-choice', (el) => el.innerText).catch(() => '');
    const attachBtn = await p.$('.similar-choice__attach');
    await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await wait(300);
    await (attach && attachBtn ? p.click('.similar-choice__attach') : p.click('.similar-choice__new'));
    await p.waitForSelector('.ticket', { timeout: 30000 });
    const receiptNo = await p.$eval('.ticket__number', (el) => el.textContent.trim());
    const token = await p.$eval('.ticket__token-value', (el) => el.textContent.trim()).catch(() => null);
    return { ai, address, receiptNo, token, hadCandidate: Boolean(attachBtn), candidateText: candidate };
  }

  try {
    // ── 1. 시민 3단계 신고 ──
    console.log('\n[1] 시민 — 3단계 신고');
    const p1 = await citizenPage();
    const r1 = await fileReport(p1);
    step('촬영 → AI 유형 판정', /유형/.test(r1.ai), r1.ai);
    step('위치 확인 — 실주소 표시', Boolean(r1.address), r1.address ?? '(좌표 표기로 폴백)');
    step('접수증 발급', /^MOA-\d{8}-\d{5}$/.test(r1.receiptNo), r1.receiptNo);
    step('접수증에 조회 토큰 노출', /^[a-f0-9]{32}$/.test(r1.token ?? ''), r1.token ? '32자리' : '없음');
    await p1.close();

    // ── 2. 유사 신고 통합 ──
    console.log('\n[2] 핵심 차별점 — 유사 신고 통합');
    const p2 = await citizenPage({ geo: { latitude: SITE.latitude + 0.00008, longitude: SITE.longitude + 0.00004 } });
    const r2 = await fileReport(p2, { attach: true });
    step('같은 지점 재신고 시 후보 제시', r2.hadCandidate, r2.hadCandidate ? '후보 카드 표시됨' : '후보 없음');
    await p2.close();

    const list1 = await fetch(`${API}/api/admin/issues`, { headers: { Authorization: `Bearer ${ADMIN_TOKEN}` } }).then((r) => r.json());
    const merged = list1.data.issues.find((i) => i.reportCount >= 2);
    step('두 신고가 하나의 대표 문제로 통합', Boolean(merged), merged ? `신고 ${merged.reportCount}건 · 우선순위 ${merged.priority}` : '통합 안 됨');

    // ── 3. 내 주변 · 공감 ──
    console.log('\n[3] 내 주변 — 지도와 공감');
    const p3 = await citizenPage();
    await p3.goto(`${APP}/nearby`, { waitUntil: 'networkidle2' });
    await p3.waitForSelector('.nearby-card', { timeout: 25000 }).catch(() => {});
    const cards = await p3.$$eval('.nearby-card', (els) => els.length).catch(() => 0);
    step('주변 신고 목록 표시', cards > 0, `${cards}건`);
    const tiles = await p3.$$eval('.leaflet-tile-loaded', (els) => els.length).catch(() => 0);
    step('지도 타일 로드', tiles > 0, `${tiles}장`);
    if (cards > 0) {
      await p3.click('.nearby-card');
      await p3.waitForSelector('.empathy-btn', { timeout: 10000 });
      await p3.click('.empathy-btn');
      await p3.waitForFunction(() => {
        const b = document.querySelector('.empathy-btn');
        return b && (b.disabled || b.getAttribute('aria-pressed') === 'true');
      }, { timeout: 15000 }).catch(() => {});
      const pressed = await p3.$eval('.empathy-btn', (b) => b.disabled || b.getAttribute('aria-pressed') === 'true');
      step('공감 반영', pressed);
    }
    await p3.close();

    // ── 4. 관리자 ──
    console.log('\n[4] 관리자 — 인증·정렬·상세·상태 변경');
    const admin = await browser.newPage();
    await admin.setViewport({ width: 1200, height: 900 });
    admin.on('pageerror', (e) => errors.push(e.message.slice(0, 120)));
    await admin.goto(`${APP}/admin`, { waitUntil: 'networkidle2' });
    const gated = await admin.$('.admin-gate__card');
    step('토큰 없이는 콘솔이 잠김', Boolean(gated));
    if (gated) {
      await admin.type('#admin-token', ADMIN_TOKEN);
      await admin.click('.admin-gate__submit');
    }
    await admin.waitForSelector('.admin-card', { timeout: 20000 });
    const sorted = await admin.$$eval('.admin-card .admin-badge', (els) =>
      els.map((e) => parseInt(e.textContent, 10)).filter(Number.isFinite));
    step('토큰 입력 후 목록 진입', true, `카드 ${await admin.$$eval('.admin-card', (e) => e.length)}건`);
    step('우선순위 내림차순 정렬', sorted.every((v, i, a) => i === 0 || a[i - 1] >= v), sorted.join(' ≥ '));
    const thumbsOk = await admin.evaluate(async () => {
      const imgs = [...document.querySelectorAll('.admin-card-thumb img')];
      imgs.forEach((i) => { i.loading = 'eager'; });
      await Promise.all(imgs.map((i) => i.decode().catch(() => {})));
      return { total: imgs.length, ok: imgs.filter((i) => i.naturalWidth > 0).length };
    });
    step('카드 썸네일 로드', thumbsOk.total > 0 && thumbsOk.ok === thumbsOk.total, `${thumbsOk.ok}/${thumbsOk.total}`);

    await admin.click('.admin-card');
    await admin.waitForSelector('.admin-report-card', { timeout: 20000 });
    const photos = await admin.evaluate(async () => {
      const imgs = [...document.querySelectorAll('img.admin-report-photo')];
      await Promise.all(imgs.map((i) => i.decode().catch(() => {})));
      return { total: document.querySelectorAll('.admin-report-card').length, ok: imgs.filter((i) => i.naturalWidth > 0).length };
    });
    step('상세 — 통합 신고 사진 비교', photos.ok === photos.total && photos.total >= 2, `사진 ${photos.ok}/${photos.total}`);

    const before = await admin.$eval('.admin-detail-sub', (el) => el.textContent);
    const btns = await admin.$$('.admin-status-btn');
    await btns[2].click();  // 처리중
    await admin.waitForFunction(() => /처리중/.test(document.querySelector('.admin-detail-sub')?.textContent ?? ''), { timeout: 15000 }).catch(() => {});
    const after = await admin.$eval('.admin-detail-sub', (el) => el.textContent);
    step('상태 변경 반영', /처리중/.test(after) && before !== after, after.replace(/\s+/g, ' ').slice(0, 50));
    await admin.close();

    // ── 5. 시민 화면 즉시 반영 ──
    console.log('\n[5] 시민 조회 — 담당자 변경 즉시 반영');
    const p5 = await citizenPage();
    await p5.goto(`${APP}/status/${r1.receiptNo}?token=${r1.token}`, { waitUntil: 'networkidle2' });
    await p5.waitForSelector('.status-current__badge', { timeout: 20000 });
    const shown = await p5.$eval('.status-current__badge', (el) => el.textContent.trim());
    step('시민 화면에 바뀐 상태 표시', shown === '처리중', shown);
    const history = await p5.$$eval('.status-history__item', (els) => els.length).catch(() => 0);
    step('처리 기록 표시', history > 0, `${history}건`);
    await p5.close();

    // ── 6. 접근성 ──
    console.log('\n[6] 접근성 — 화면 모드·큰 글자');
    for (const theme of ['light', 'dark', 'contrast']) {
      const pa = await citizenPage({ theme });
      await pa.goto(APP, { waitUntil: 'networkidle2' });
      await wait(400);
      const applied = await pa.evaluate(() => document.documentElement.dataset.theme || 'light');
      const noScroll = await pa.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
      step(`화면 모드 ${theme}`, applied === theme && noScroll, applied);
      await pa.close();
    }
    const pb = await citizenPage({ scale: 160 });
    await pb.goto(`${APP}/report/camera`, { waitUntil: 'networkidle2' });
    await wait(500);
    const big = await pb.evaluate(() => {
      const bar = document.querySelector('.tab-bar').getBoundingClientRect().height;
      const pad = parseFloat(getComputedStyle(document.querySelector('.app-main')).paddingBottom);
      return { noScroll: document.documentElement.scrollWidth <= window.innerWidth + 1, clears: pad > bar };
    });
    step('글자 160% — 가로 스크롤 없음', big.noScroll);
    step('글자 160% — 탭바가 본문을 가리지 않음', big.clears);
    await pb.close();

    // ── 7. 오류 경로 ──
    console.log('\n[7] 오류 경로 — 시연 중 흔한 상황');
    const wrongToken = await fetch(`${API}/api/status/${r1.receiptNo}?token=${'0'.repeat(32)}`).then((r) => r.status);
    step('잘못된 조회 토큰 → 403', wrongToken === 403, String(wrongToken));
    const noAuth = await fetch(`${API}/api/admin/issues`).then((r) => r.status);
    step('토큰 없는 관리자 API → 401', noAuth === 401, String(noAuth));
    const denied = await citizenPage();
    await browser.defaultBrowserContext().clearPermissionOverrides();
    await denied.goto(`${APP}/nearby`, { waitUntil: 'networkidle2' });
    await denied.waitForSelector('.nearby-card, .nearby-empty, .notice', { timeout: 20000 }).catch(() => {});
    const fellBack = await denied.evaluate(() => Boolean(document.querySelector('.moa-map')));
    step('위치 권한 거부 시 기본 위치로 폴백', fellBack);
    await denied.close();
    await browser.defaultBrowserContext().overridePermissions(APP, ['geolocation']);

    step('브라우저 콘솔 오류 없음', errors.length === 0, errors.length ? errors.slice(0, 2).join(' | ') : '');
  } finally {
    await browser.close();
    fs.rmSync(tmp, { recursive: true, force: true });
  }

  console.log('\n' + '═'.repeat(60));
  console.log(`  ${results.length - failed}/${results.length} 단계 통과${failed ? ` · 실패 ${failed}건` : ' — 시연 준비 완료'}`);
  console.log('═'.repeat(60) + '\n');
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error('\n리허설 중단:', e.message); process.exit(1); });
