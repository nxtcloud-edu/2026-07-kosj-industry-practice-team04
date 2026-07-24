/**
 * 신고 작성 중 임시 보관 (촬영 화면 → 위치 확인 화면)
 * ─────────────────────────────────────────────────────
 * 메타데이터는 sessionStorage에, 실제 사진 File 객체는 모듈 메모리에 둔다.
 * (sessionStorage는 바이트를 담기엔 용량 제한이 있고, SPA 내 이동에서는
 *  모듈 메모리로 충분하다. 새로고침으로 File이 날아가면 위치 확인 화면이
 *  재촬영을 안내한다 — Issue #55)
 * 접수가 끝나면 clearDraft()로 모두 비운다.
 */
const KEY = 'moa-report-draft';

/** @typedef {{ name: string, type: string, size: number }} PhotoMeta */

/** 촬영 화면의 압축된 File 객체 — 업로드(PUT)에 그대로 쓴다 */
let draftFiles = [];

/** 촬영 화면에서 사진 저장 (기존 분류 결과는 유지) */
export function saveDraftPhotos(files) {
  draftFiles = [...files];
  const photos = files.map((f) => ({ name: f.name, type: f.type, size: f.size }));
  const prev = getDraft();
  sessionStorage.setItem(KEY, JSON.stringify({
    ...prev, photos, savedAt: new Date().toISOString(),
  }));
}

/** 업로드할 실제 File 객체들 (새로고침 시 빈 배열) */
export function getDraftFiles() {
  return draftFiles;
}

/**
 * AI 분류 결과 저장 (Issue #10·#11)
 * 위치 확인 화면이 이 유형으로 유사 신고를 조회하고, 접수 시 함께 전송한다.
 */
export function saveDraftAnalysis({ type, confidence, needsReview }) {
  const prev = getDraft();
  sessionStorage.setItem(KEY, JSON.stringify({
    ...prev, analysis: { type, confidence, needsReview },
  }));
}

/** 분류의 근거였던 사진이 삭제되면 결과도 함께 지운다 — 낡은 유형으로 접수되는 것 방지 */
export function clearDraftAnalysis() {
  const prev = getDraft();
  delete prev.analysis;
  sessionStorage.setItem(KEY, JSON.stringify(prev));
}

/** @returns {{ photos: PhotoMeta[], analysis?: object, savedAt?: string }} */
export function getDraft() {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : { photos: [] };
  } catch {
    return { photos: [] };
  }
}

export function clearDraft() {
  draftFiles = [];
  sessionStorage.removeItem(KEY);
}
