/**
 * 역지오코딩 — 좌표를 사람이 읽는 주소로 (SIR-002 후속)
 * ─────────────────────────────────────────────────────
 * Nominatim(OpenStreetMap) 공개 API 사용 — 키 불필요.
 * 이용 정책(≤1req/s)을 지키기 위해:
 *  - 약 100m 격자(소수 3자리)로 캐시해 같은 지점 재조회를 막는다
 *  - User-Agent를 명시한다 (정책 필수)
 * 실패해도 신고 흐름을 막지 않는다 — 주소 없이(null) 좌표만 쓰면 된다.
 *
 * 국내 서비스 정식 운영 시 카카오 로컬/행안부 주소 API로 교체 지점.
 */

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/reverse';
const USER_AGENT = 'moa-civic-mvp/1.0 (KUS team04 educational project)';
const TIMEOUT_MS = 4000;
const CACHE_MAX = 500;

const cache = new Map(); // "lat,lng"(3자리) → address|null

function cacheKey(lat, lng) {
  return `${Number(lat).toFixed(3)},${Number(lng).toFixed(3)}`;
}

/** Nominatim address 객체 → "세종특별자치시 조치원읍 도움6로" 형태로 조립 */
export function composeKoreanAddress(a) {
  if (!a || typeof a !== 'object') return null;
  const parts = [
    a.province || a.state || a.city,
    a.county || a.city_district || a.district,
    a.town || a.suburb || a.village || a.quarter || a.neighbourhood,
    a.road,
    a.house_number,
  ];
  const seen = new Set();
  const composed = parts
    .filter((p) => typeof p === 'string' && p.trim() && !seen.has(p) && seen.add(p))
    .join(' ')
    .trim();
  return composed || null;
}

/**
 * 좌표 → 주소. 실패 시 { address: null }.
 * @param {number} lat
 * @param {number} lng
 * @param {{ fetchFn?: typeof fetch }} [opts] 테스트용 fetch 주입
 */
export async function reverseGeocode(lat, lng, { fetchFn = fetch } = {}) {
  const key = cacheKey(lat, lng);
  if (cache.has(key)) return { address: cache.get(key), cached: true };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const url = `${NOMINATIM_URL}?format=jsonv2&lat=${lat}&lon=${lng}&zoom=17&accept-language=ko`;
    const res = await fetchFn(url, {
      signal: controller.signal,
      headers: { 'User-Agent': USER_AGENT },
    });
    if (!res.ok) throw new Error(`Nominatim ${res.status}`);

    const data = await res.json();
    const address = composeKoreanAddress(data.address)
      ?? (typeof data.display_name === 'string' ? data.display_name : null);

    if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value);
    cache.set(key, address);
    return { address, cached: false };
  } catch {
    // 주소를 못 구해도 좌표만으로 접수 가능해야 한다.
    return { address: null, cached: false };
  } finally {
    clearTimeout(timer);
  }
}

/** 테스트용 캐시 초기화 */
export function clearGeocodeCache() {
  cache.clear();
}
