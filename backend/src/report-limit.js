/**
 * 신고 접수 레이트리밋 (API 계약 보안 규칙 3)
 * ─────────────────────────────────────────────────────
 * 같은 IP는 시간창 안에서 정해진 횟수까지만 접수할 수 있다.
 * 기본: 1시간 5건 (계약 문서 "시간당 신고 5건 초과 시 429").
 * deviceId는 위조 가능하므로 IP를 기준으로 한다 — 공감 제한(#58)과 같은 원칙.
 */

const LIMIT = () => Number(process.env.MOA_REPORT_LIMIT ?? 5);
const WINDOW_MS = () => Number(process.env.MOA_REPORT_WINDOW_MS ?? 60 * 60 * 1000);

const submissions = new Map(); // ip → number[] (접수 시각 ms)

function prune(now) {
  if (submissions.size < 5000) return;
  const windowMs = WINDOW_MS();
  for (const [ip, times] of submissions) {
    const alive = times.filter((t) => now - t < windowMs);
    if (alive.length === 0) submissions.delete(ip);
    else submissions.set(ip, alive);
  }
}

/**
 * 이 IP가 지금 접수할 수 있는지 판정하고, 가능하면 1건을 기록한다.
 * @returns {{ allowed: boolean, remaining: number }}
 */
export function consumeReportSlot(ip, now = Date.now()) {
  const limit = LIMIT();
  const windowMs = WINDOW_MS();
  if (!ip || limit <= 0 || windowMs <= 0) return { allowed: true, remaining: Infinity };

  const times = (submissions.get(ip) ?? []).filter((t) => now - t < windowMs);
  if (times.length >= limit) {
    submissions.set(ip, times);
    return { allowed: false, remaining: 0 };
  }

  times.push(now);
  submissions.set(ip, times);
  prune(now);
  return { allowed: true, remaining: limit - times.length };
}

/** 테스트용 초기화 */
export function clearReportLimits() {
  submissions.clear();
}
