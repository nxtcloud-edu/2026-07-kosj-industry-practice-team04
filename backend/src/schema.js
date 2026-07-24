/**
 * 신고 접수 입력값 검증 스키마 (Issue #9 · SFR-001)
 * ─────────────────────────────────────────────────────
 * 외부 라이브러리 없이 순수 JS로 구현.
 * 향후 zod/joi 등 도입 시 이 파일만 교체하면 된다.
 */

/**
 * @typedef {Object} ValidationError
 * @property {string} field
 * @property {string} message
 */

const RECEIPT_NO_PATTERN = /^MOA-\d{8}-\d{5}$/;
const VIEW_TOKEN_PATTERN = /^[a-f0-9]{32}$/;

/**
 * presigned URL 요청 검증
 * @param {object} body
 * @returns {{ valid: boolean, errors: ValidationError[] }}
 */
export function validateUploadRequest(body) {
  const errors = [];

  if (!body || typeof body !== 'object') {
    return { valid: false, errors: [{ field: 'body', message: '요청 본문이 비어있습니다.' }] };
  }

  if (!body.filename || typeof body.filename !== 'string') {
    errors.push({ field: 'filename', message: '파일명(filename)은 필수 문자열입니다.' });
  } else if (!/\.(jpe?g|png|webp|heic)$/i.test(body.filename)) {
    errors.push({ field: 'filename', message: '지원하는 이미지 형식: jpg, jpeg, png, webp, heic' });
  }

  if (!body.contentType || typeof body.contentType !== 'string') {
    errors.push({ field: 'contentType', message: 'contentType은 필수 문자열입니다.' });
  } else if (!/^image\/(jpeg|png|webp|heic)$/.test(body.contentType)) {
    errors.push({ field: 'contentType', message: '지원하는 contentType: image/jpeg, image/png, image/webp, image/heic' });
  }

  if (body.fileSize != null) {
    if (typeof body.fileSize !== 'number' || body.fileSize <= 0) {
      errors.push({ field: 'fileSize', message: 'fileSize는 양의 정수여야 합니다.' });
    } else if (body.fileSize > 10 * 1024 * 1024) {
      errors.push({ field: 'fileSize', message: '파일 크기는 10MB를 초과할 수 없습니다.' });
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * 신고 접수 요청 검증
 * @param {object} body
 * @returns {{ valid: boolean, errors: ValidationError[] }}
 */
export function validateReportRequest(body) {
  const errors = [];

  if (!body || typeof body !== 'object') {
    return { valid: false, errors: [{ field: 'body', message: '요청 본문이 비어있습니다.' }] };
  }

  // 사진 URL 배열 (1~10장) — 이 서버가 발급한 업로드 경로이거나 https URL만 허용한다.
  // 임의 문자열/외부 스킴을 막아 관리자·시민 화면에 공격자 제어 콘텐츠가 렌더링되는 것을 차단.
  if (!Array.isArray(body.photos) || body.photos.length === 0) {
    errors.push({ field: 'photos', message: '사진 URL 배열(photos)은 1장 이상 필수입니다.' });
  } else if (body.photos.length > 10) {
    errors.push({ field: 'photos', message: '사진은 최대 10장까지 등록 가능합니다.' });
  } else {
    for (let i = 0; i < body.photos.length; i++) {
      const url = body.photos[i];
      const ok = typeof url === 'string'
        && url.length <= 512
        && (/^\/uploads\/reports\/\d{4}\/\d{2}\/\d{2}\/[0-9a-f-]{36}\.(jpe?g|png|webp|heic)$/i.test(url)
          || /^https:\/\/[^\s]+$/i.test(url));
      if (!ok) {
        errors.push({ field: `photos[${i}]`, message: `photos[${i}]는 업로드된 사진 경로 또는 https URL이어야 합니다.` });
      }
    }
  }

  // 위도
  if (body.latitude == null) {
    errors.push({ field: 'latitude', message: '위도(latitude)는 필수입니다.' });
  } else if (typeof body.latitude !== 'number' || body.latitude < -90 || body.latitude > 90) {
    errors.push({ field: 'latitude', message: '위도는 -90~90 범위의 숫자여야 합니다.' });
  }

  // 경도
  if (body.longitude == null) {
    errors.push({ field: 'longitude', message: '경도(longitude)는 필수입니다.' });
  } else if (typeof body.longitude !== 'number' || body.longitude < -180 || body.longitude > 180) {
    errors.push({ field: 'longitude', message: '경도는 -180~180 범위의 숫자여야 합니다.' });
  }

  // 주소/행정구역 (선택, 문자열)
  if (body.address != null && typeof body.address !== 'string') {
    errors.push({ field: 'address', message: '주소(address)는 문자열이어야 합니다.' });
  }

  // 처리 알림을 희망하는 경우에만 연락처를 선택 수집한다 (SER-003).
  // 연락처가 없으면 관련 필드를 저장하지 않는다.
  if (body.contact != null) {
    if (typeof body.contact !== 'string' || body.contact.trim() === '') {
      errors.push({ field: 'contact', message: '연락처(contact)는 비어 있지 않은 문자열이어야 합니다.' });
    } else {
      const contact = body.contact.trim();
      if (!/^(?:010\d{8}|010-\d{4}-\d{4})$/.test(contact)) {
        errors.push({ field: 'contact', message: '연락처는 010-0000-0000 또는 01000000000 형식이어야 합니다.' });
      }
    }
  }

  // 위치정보 수집 동의
  if (body.locationConsent !== true) {
    errors.push({ field: 'locationConsent', message: '위치정보 수집 동의(locationConsent)는 true여야 합니다.' });
  }

  return { valid: errors.length === 0, errors };
}

/**
 * 개인정보를 반환하지 않는 상태 조회 경계 검증.
 * 형식 오류도 토큰 오류와 같은 403으로 처리하도록 boolean만 반환한다.
 */
export function validateStatusLookup(receiptNo, token) {
  return typeof receiptNo === 'string'
    && RECEIPT_NO_PATTERN.test(receiptNo)
    && typeof token === 'string'
    && VIEW_TOKEN_PATTERN.test(token);
}
