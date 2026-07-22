import http from 'node:http';
import {
  STATUS_FLOW, TYPES, deptFor, isValidStatus, selectReviewQueue, summarizeIssue,
} from '../src/domain.js';

/**
 * 데모용 목(mock) API 서버 — main을 "시연 가능한 상태"로 유지하기 위한 임시 도구 (Issue #26)
 * ────────────────────────────────────────────────────────────────────────
 * 실제 신고 접수 API(#9)가 머지되면 이 파일은 필요 없어집니다. 그때 삭제하세요.
 *
 *   node dev/mock-server.js       (backend 폴더에서)
 *
 * - 저장은 메모리에만 (재시작하면 초기 데이터로 돌아감)
 * - 판정 로직은 실제 코드(src/domain.js)를 그대로 사용 — 우선순위·부서 배정이 진짜로 계산됩니다
 * - 응답 형태는 docs/API_CONTRACT.md 규약({ success, data } / { success, errors })
 */

const PORT = Number(process.env.MOA_PORT || 4000);

// ─────────────────── 데모 데이터 (세종 도움6로 인근) ───────────────────

const hoursAgo = (h) => new Date(Date.now() - h * 3600 * 1000).toISOString();

const PHOTOS = {
  'road-1.svg': ['#4a4a52', '도로 파손', '🕳️'],
  'road-2.svg': ['#565660', '도로 파손 (다른 각도)', '🕳️'],
  'lamp-1.svg': ['#2d3a55', '가로등 고장', '💡'],
  'trash-1.svg': ['#4d5c48', '쓰레기 무단투기', '🗑️'],
};

let seq = 1;
const receiptNo = () => `SJ-2026-0722-${String(seq++).padStart(4, '0')}`;

function makeReport(photo, type, confidence, address, lat, lng, h) {
  return {
    id: `rp_${photo.split('.')[0]}`,
    receiptNo: receiptNo(),
    photoUrl: `/uploads/${photo}`,
    address, lat, lng, type, confidence,
    spam: false,
    createdAt: hoursAgo(h),
  };
}

function buildData() {
  seq = 1;
  const r1 = makeReport('road-1.svg', '도로 파손', 0.91, '세종특별자치시 도움6로 24 인근', 36.48012, 127.28901, 26);
  const r2 = makeReport('road-2.svg', '도로 파손', 0.87, '세종특별자치시 도움6로 26 인근', 36.48035, 127.28921, 20);
  const r3 = makeReport('lamp-1.svg', '가로등 고장', 0.82, '세종특별자치시 도움6로 52 인근', 36.47895, 127.29102, 9);
  const r4 = makeReport('trash-1.svg', '쓰레기 무단투기', 0.58, '세종특별자치시 도움5로 11 인근', 36.48151, 127.28740, 3);

  const mk = (id, reports, extra = {}) => {
    const f = reports[0];
    return {
      id, type: f.type, lat: f.lat, lng: f.lng, address: f.address,
      dept: deptFor(f.type), status: '접수', reports,
      empathyDevices: [], needsReview: false,
      history: reports.map((r) => ({ at: r.createdAt, event: `신고 접수 (${r.receiptNo})` })),
      createdAt: f.createdAt, lastReportAt: reports[reports.length - 1].createdAt,
      ...extra,
    };
  };

  // 통합 2건 + 공감 3 → 우선순위 5+2+3 = 10 (높음)
  const i1 = mk('is_road', [r1, r2], { empathyDevices: ['d1', 'd2', 'd3'] });
  i1.history.splice(1, 0, { at: r2.createdAt, event: `신고 통합 (${r2.receiptNo})` });
  const i2 = mk('is_lamp', [r3], { status: '배정' });
  i2.history.push({ at: hoursAgo(5), event: '상태 변경 → 배정' });
  // 신뢰도 0.58 → 검수 큐
  const i3 = mk('is_trash', [r4], { needsReview: true });

  return { issues: [i1, i2, i3], splits: 0 };
}

let db = buildData();

// ─────────────────────────── 헬퍼 ───────────────────────────

const json = (res, code, body) => {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
};
const ok = (res, data) => json(res, 200, { success: true, data });
const fail = (res, code, field, message) =>
  json(res, code, { success: false, errors: [{ field, message }] });

const parseBody = (req) =>
  new Promise((resolve) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); }
      catch { resolve({}); }
    });
  });

const findIssue = (id) => db.issues.find((i) => i.id === id);
const findReport = (id) => {
  for (const issue of db.issues) {
    const r = issue.reports.find((x) => x.id === id);
    if (r) return { issue, report: r };
  }
  return null;
};

// ─────────────────────────── 라우팅 ───────────────────────────

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const p = url.pathname;
  const method = req.method?.toUpperCase();

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (method === 'OPTIONS') { res.writeHead(204); return res.end(); }

  // 데모 사진 (SVG 즉석 생성)
  if (p.startsWith('/uploads/')) {
    const meta = PHOTOS[p.replace('/uploads/', '')];
    if (!meta) { res.writeHead(404); return res.end(); }
    const [bg, label, emoji] = meta;
    res.writeHead(200, { 'Content-Type': 'image/svg+xml; charset=utf-8' });
    return res.end(`<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480"><rect width="640" height="480" fill="${bg}"/><text x="320" y="230" font-size="110" text-anchor="middle">${emoji}</text><text x="320" y="310" font-size="26" fill="rgba(255,255,255,.9)" text-anchor="middle" font-family="sans-serif">${label} · 데모</text></svg>`);
  }

  // GET /api/admin/stats
  if (method === 'GET' && p === '/api/admin/stats') {
    return ok(res, {
      total: db.issues.length,
      byStatus: Object.fromEntries(STATUS_FLOW.map((s) => [s, db.issues.filter((i) => i.status === s).length])),
      reviewQueue: selectReviewQueue(db.issues).length,
      reports: db.issues.reduce((n, i) => n + i.reports.filter((r) => !r.spam).length, 0),
      splits: db.splits,
    });
  }

  // GET /api/admin/issues
  if (method === 'GET' && p === '/api/admin/issues') {
    let list = db.issues;
    if (url.searchParams.get('queue') === 'review') list = selectReviewQueue(list);
    const status = url.searchParams.get('status');
    if (status) list = list.filter((i) => i.status === status);

    const summaries = list.map(summarizeIssue);
    summaries.sort((a, b) =>
      url.searchParams.get('sort') === 'recent'
        ? new Date(b.lastReportAt) - new Date(a.lastReportAt)
        : b.priority - a.priority);

    return ok(res, { params: { radiusM: 50, windowHours: 72 }, issues: summaries });
  }

  // GET /api/admin/issues/:id
  if (method === 'GET' && p.startsWith('/api/admin/issues/')) {
    const issue = findIssue(p.split('/').pop());
    if (!issue) return fail(res, 404, 'id', '문제를 찾을 수 없습니다.');
    return ok(res, { ...summarizeIssue(issue), history: issue.history, statusFlow: STATUS_FLOW, reports: issue.reports });
  }

  // PATCH /api/admin/issues/:id  (상태 변경)
  if (method === 'PATCH' && p.startsWith('/api/admin/issues/')) {
    const issue = findIssue(p.split('/').pop());
    if (!issue) return fail(res, 404, 'id', '문제를 찾을 수 없습니다.');
    const { status } = await parseBody(req);
    if (!isValidStatus(status)) return fail(res, 400, 'status', `상태는 ${STATUS_FLOW.join(' / ')} 중 하나여야 합니다.`);
    issue.status = status;
    issue.history.push({ at: new Date().toISOString(), event: `상태 변경 → ${status}` });
    return ok(res, summarizeIssue(issue));
  }

  // POST /api/admin/issues/:id/split  (오통합 분리)
  if (method === 'POST' && /\/api\/admin\/issues\/.+\/split$/.test(p)) {
    const issue = findIssue(p.split('/')[4]);
    if (!issue) return fail(res, 404, 'id', '문제를 찾을 수 없습니다.');
    const { reportId, reason } = await parseBody(req);
    const idx = issue.reports.findIndex((r) => r.id === reportId);
    if (idx < 0) return fail(res, 404, 'reportId', '해당 신고가 이 문제에 없습니다.');
    if (issue.reports.length < 2) return fail(res, 400, 'reportId', '신고가 1건뿐인 문제는 분리할 수 없습니다.');

    const [moved] = issue.reports.splice(idx, 1);
    issue.history.push({ at: new Date().toISOString(), event: `신고 분리 (${moved.receiptNo}) — 사유: ${reason || '미기재'}` });
    const created = {
      id: `is_split_${db.splits + 1}`, type: moved.type, lat: moved.lat, lng: moved.lng,
      address: moved.address, dept: deptFor(moved.type), status: '접수',
      reports: [moved], empathyDevices: [], needsReview: false,
      history: [{ at: new Date().toISOString(), event: `분리로 생성 (원 문제 ${issue.id}, 사유: ${reason || '미기재'})` }],
      createdAt: moved.createdAt, lastReportAt: moved.createdAt,
    };
    db.issues.push(created);
    db.splits += 1;
    return ok(res, { original: summarizeIssue(issue), created: summarizeIssue(created) });
  }

  // PATCH /api/admin/reports/:id  (재분류 / 스팸)
  if (method === 'PATCH' && p.startsWith('/api/admin/reports/')) {
    const found = findReport(p.split('/').pop());
    if (!found) return fail(res, 404, 'id', '신고를 찾을 수 없습니다.');
    const { issue, report } = found;
    const body = await parseBody(req);
    let warning = null;

    if (body.type) {
      if (!TYPES.includes(body.type)) return fail(res, 400, 'type', '유형이 올바르지 않습니다.');
      report.type = body.type;
      const active = issue.reports.filter((r) => !r.spam);
      if (active.length === 1) {
        issue.type = body.type;
        issue.dept = deptFor(body.type);
        issue.history.push({ at: new Date().toISOString(), event: `유형 재분류 → ${body.type} (담당: ${issue.dept})` });
      } else {
        warning = '통합된 신고 중 1건만 유형이 변경되었습니다. 별개 문제라면 분리를 진행하세요.';
      }
      issue.needsReview = false; // 사람이 확인함
    }
    if (typeof body.spam === 'boolean') {
      report.spam = body.spam;
      issue.history.push({ at: new Date().toISOString(), event: body.spam ? `스팸 처리 (${report.receiptNo})` : `스팸 해제 (${report.receiptNo})` });
    }
    return ok(res, { report, issue: summarizeIssue(issue), warning });
  }

  // 데모 데이터 초기화
  if (method === 'POST' && p === '/api/dev/reset') { db = buildData(); return ok(res, { reset: true }); }

  fail(res, 404, 'path', `${method} ${p} 를 찾을 수 없습니다.`);
});

server.listen(PORT, () => {
  console.log(`[moa-mock] 데모 API — http://localhost:${PORT}`);
  console.log(`  관리자 콘솔: http://localhost:5173/admin  (frontend에서 npm run dev)`);
  console.log(`  데이터 초기화: POST /api/dev/reset`);
  console.log(`  ※ 실제 신고 접수 API(#9)가 머지되면 이 목 서버는 삭제하세요.`);
});
