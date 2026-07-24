/**
 * IP 기준 레이트리밋 (API 계약 보안 규칙 3 · #58과 같은 원칙)
 * ─────────────────────────────────────────────────────
 * deviceId는 위조 가능하므로 IP 시간창으로 남용을 막는다.
 *  - 신고 접수: 기본 1시간 5건 (계약 "시간당 신고 5건 초과 시 429")
 *  - 역지오코딩: 기본 1분 30건 — 우리 서버가 Nominatim 중계 창구로
 *    악용되지 않게 막는다 (100m 격자 캐시와 이중 방어)
 */

function makeLimiter({ limit, windowMs }) {
  const hits = new Map(); // ip → number[] (요청 시각 ms)

  function prune(now, windowNow) {
    if (hits.size < 5000) return;
    for (const [ip, times] of hits) {
      const alive = times.filter((t) => now - t < windowNow);
      if (alive.length === 0) hits.delete(ip);
      else hits.set(ip, alive);
    }
  }

  return {
    /** 이 IP가 지금 요청할 수 있는지 판정하고, 가능하면 1건을 기록한다. */
    consume(ip, now = Date.now()) {
      const max = limit();
      const windowNow = windowMs();
      if (!ip || max <= 0 || windowNow <= 0) return { allowed: true, remaining: Infinity };

      const times = (hits.get(ip) ?? []).filter((t) => now - t < windowNow);
      if (times.length >= max) {
        hits.set(ip, times);
        return { allowed: false, remaining: 0 };
      }

      times.push(now);
      hits.set(ip, times);
      prune(now, windowNow);
      return { allowed: true, remaining: max - times.length };
    },
    clear() {
      hits.clear();
    },
  };
}

const reportLimiter = makeLimiter({
  limit: () => Number(process.env.MOA_REPORT_LIMIT ?? 5),
  windowMs: () => Number(process.env.MOA_REPORT_WINDOW_MS ?? 60 * 60 * 1000),
});

const geocodeLimiter = makeLimiter({
  limit: () => Number(process.env.MOA_GEOCODE_LIMIT ?? 30),
  windowMs: () => Number(process.env.MOA_GEOCODE_WINDOW_MS ?? 60 * 1000),
});

// AI 분류: 가장 비싼 자원(외부 유료 Gemini 호출 + base64 디코드 CPU)이므로
// 인증 없는 익명 반복을 IP 분당 건수로 막는다.
const analyzeLimiter = makeLimiter({
  limit: () => Number(process.env.MOA_ANALYZE_LIMIT ?? 20),
  windowMs: () => Number(process.env.MOA_ANALYZE_WINDOW_MS ?? 60 * 1000),
});

// 업로드(presign 발급 + PUT 저장): 디스크 소진 방지용 IP 분당 건수.
const uploadLimiter = makeLimiter({
  limit: () => Number(process.env.MOA_UPLOAD_LIMIT ?? 60),
  windowMs: () => Number(process.env.MOA_UPLOAD_WINDOW_MS ?? 60 * 1000),
});

export const consumeReportSlot = (ip, now) => reportLimiter.consume(ip, now);
export const consumeGeocodeSlot = (ip, now) => geocodeLimiter.consume(ip, now);
export const consumeAnalyzeSlot = (ip, now) => analyzeLimiter.consume(ip, now);
export const consumeUploadSlot = (ip, now) => uploadLimiter.consume(ip, now);

/** 테스트용 초기화 */
export function clearReportLimits() {
  reportLimiter.clear();
  geocodeLimiter.clear();
  analyzeLimiter.clear();
  uploadLimiter.clear();
}
