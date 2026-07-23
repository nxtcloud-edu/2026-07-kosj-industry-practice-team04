import http from 'node:http';
import { handleRequest } from './router.js';
import { initPersistence } from './store.js';
import { sweepRetention } from './retention.js';

/**
 * HTTP 서버 엔트리포인트 (Issue #9 · #59 · #60)
 * ─────────────────────────────────────────────────────
 * 순수 node:http 기반. 향후 Express/Fastify 전환 시 이 파일만 교체.
 *
 * 환경변수:
 *  - MOA_PORT (기본 4000)           — PORT보다 우선. 개발 도구가 PORT를 주입해
 *                                     엉뚱한 포트에 붙던 사고 방지 (#60)
 *  - MOA_DATA_FILE (기본 ./data/moa-data.json, 'off'면 비활성)
 *                                   — 재시작해도 데이터가 남는 JSON 스냅숏 (#59)
 *  - MOA_RETENTION_SWEEP_MS (기본 1시간) — 보관기간 만료 스윕 주기, 0이면 끔
 *  - MOA_ADMIN_TOKEN               — 설정 시 /api/admin/* Bearer 인증 (#56)
 *  - MOA_ALLOWED_ORIGIN            — 설정 시 CORS를 해당 origin으로 제한 (#56)
 *  - MOA_MAX_BODY_BYTES (기본 15MB) — 요청 본문 상한 (#57)
 *  - MOA_GEMINI_API_KEY            — 설정 시 Gemini 실분류, 없으면 mock
 */

const PORT = Number(process.env.MOA_PORT || process.env.PORT || 4000);

// 데이터 영속화 — 테스트는 이 파일을 import하지 않으므로 인메모리 그대로다.
const dataFile = process.env.MOA_DATA_FILE || './data/moa-data.json';
if (dataFile !== 'off') initPersistence(dataFile);

// 보관기간 만료 스윕 (#59) — 기동 직후 1회 + 주기 실행
const sweepMs = Number(process.env.MOA_RETENTION_SWEEP_MS ?? 60 * 60 * 1000);
if (sweepMs > 0) {
  sweepRetention();
  setInterval(sweepRetention, sweepMs).unref();
}

const server = http.createServer(handleRequest);

server.listen(PORT, () => {
  console.log(`[moa-backend] 서버 시작 — http://localhost:${PORT}`);
  console.log(`  분류 엔진: ${process.env.MOA_GEMINI_API_KEY ? 'Gemini' : 'mock (MOA_GEMINI_API_KEY 미설정)'}`);
  console.log(`  관리자 인증: ${process.env.MOA_ADMIN_TOKEN ? 'Bearer 토큰 필수' : '꺼짐 (MOA_ADMIN_TOKEN 미설정)'}`);
  console.log(`  데이터 파일: ${dataFile === 'off' ? '인메모리 전용' : dataFile}`);
});

export default server;
