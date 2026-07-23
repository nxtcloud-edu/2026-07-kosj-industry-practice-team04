import test from 'node:test';
import assert from 'node:assert/strict';
import { reverseGeocode, composeKoreanAddress, clearGeocodeCache } from '../src/geocode.js';

/**
 * 역지오코딩 (실주소 표시)
 * 외부 API 없이 fetch를 주입해 조립·캐시·장애 폴백을 검증한다.
 */

const NOMINATIM_SAMPLE = {
  display_name: '도움6로, 어진동, 세종특별자치시, 30150, 대한민국',
  address: {
    road: '도움6로',
    suburb: '어진동',
    city: '세종특별자치시',
    postcode: '30150',
    country: '대한민국',
  },
};

function fakeFetch(payload, { status = 200 } = {}) {
  let calls = 0;
  const fn = async () => {
    calls += 1;
    return { ok: status === 200, status, json: async () => payload };
  };
  fn.calls = () => calls;
  return fn;
}

test('주소 조립 — 시/구/동/도로를 중복 없이 잇는다', () => {
  assert.equal(composeKoreanAddress(NOMINATIM_SAMPLE.address), '세종특별자치시 어진동 도움6로');
  assert.equal(composeKoreanAddress({ city: '세종특별자치시', county: '세종특별자치시', road: '한누리대로' }), '세종특별자치시 한누리대로');
  assert.equal(composeKoreanAddress({}), null);
  assert.equal(composeKoreanAddress(null), null);
});

test('같은 100m 격자는 한 번만 외부 조회하고 캐시로 응답한다', async () => {
  clearGeocodeCache();
  const fetchFn = fakeFetch(NOMINATIM_SAMPLE);

  const first = await reverseGeocode(36.48012, 127.28901, { fetchFn });
  assert.equal(first.address, '세종특별자치시 어진동 도움6로');
  assert.equal(first.cached, false);

  const second = await reverseGeocode(36.48019, 127.28904, { fetchFn }); // 몇 m 옆 — 같은 격자
  assert.equal(second.address, '세종특별자치시 어진동 도움6로');
  assert.equal(second.cached, true);
  assert.equal(fetchFn.calls(), 1, '외부 API는 한 번만 호출되어야 한다');
});

test('외부 API 장애 시 null을 돌려주고 신고 흐름을 막지 않는다', async () => {
  clearGeocodeCache();
  const { address } = await reverseGeocode(36.5, 127.3, { fetchFn: fakeFetch({}, { status: 503 }) });
  assert.equal(address, null);

  const thrown = await reverseGeocode(36.6, 127.4, { fetchFn: async () => { throw new Error('네트워크 끊김'); } });
  assert.equal(thrown.address, null);
});

test('address 필드가 없으면 display_name으로 폴백한다', async () => {
  clearGeocodeCache();
  const { address } = await reverseGeocode(36.7, 127.5, {
    fetchFn: fakeFetch({ display_name: '세종특별자치시 어딘가' }),
  });
  assert.equal(address, '세종특별자치시 어딘가');
});
