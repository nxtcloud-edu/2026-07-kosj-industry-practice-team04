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

  // 사진 URL 배열 (1~10장)
  if (!Array.isArray(body.photos) || body.photos.length === 0) {
    errors.push({ field: 'photos', message: '사진 URL 배열(photos)은 1장 이상 필수입니다.' });
  } else if (body.photos.length > 10) {
    errors.push({ field: 'photos', message: '사진은 최대 10장까지 등록 가능합니다.' });
  } else {
    for (let i = 0; i < body.photos.length; i++) {
      if (typeof body.photos[i] !== 'string' || body.photos[i].trim() === '') {
        errors.push({ field: `photos[${i}]`, message: `photos[${i}]는 유효한 URL 문자열이어야 합니다.` });
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

  // 위치정보 수집 동의
  if (body.locationConsent !== true) {
    errors.push({ field: 'locationConsent', message: '위치정보 수집 동의(locationConsent)는 true여야 합니다.' });
  }

  return { valid: errors.length === 0, errors };
}
