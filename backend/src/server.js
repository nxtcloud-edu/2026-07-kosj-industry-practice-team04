import http from 'node:http';
import { handleRequest } from './router.js';

/**
 * HTTP 서버 엔트리포인트 (Issue #9)
 * ─────────────────────────────────────────────────────
 * 순수 node:http 기반. 향후 Express/Fastify 전환 시 이 파일만 교체.
 */

const PORT = Number(process.env.PORT || 4000);

const server = http.createServer(handleRequest);

server.listen(PORT, () => {
  console.log(`[moa-backend] 서버 시작 — http://localhost:${PORT}`);
  console.log(`  POST /api/uploads/presign     — presigned URL 발급`);
  console.log(`  POST /api/reports             — 신고 접수`);
  console.log(`  GET  /api/status/:id?token=   — 신고 조회`);
  console.log(`  GET  /api/health              — 헬스체크`);
});

export default server;
