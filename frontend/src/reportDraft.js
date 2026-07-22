/**
 * 신고 작성 중 임시 보관 (촬영 화면 → 위치 확인 화면)
 * ─────────────────────────────────────────────────────
 * 화면 간 상태 공유가 필요하지만 전역 스토어를 도입할 정도는 아니라
 * sessionStorage에 최소 정보만 둔다. 접수가 끝나면 clearDraft()로 비운다.
 *
 * 이미지 바이트는 저장하지 않는다(용량). presign 발급에 필요한 메타데이터만 보관.
 */
const KEY = 'moa-report-draft';

/** @typedef {{ name: string, type: string, size: number }} PhotoMeta */

/** 촬영 화면에서 사진 메타데이터 저장 */
export function saveDraftPhotos(files) {
  const photos = files.map((f) => ({ name: f.name, type: f.type, size: f.size }));
  sessionStorage.setItem(KEY, JSON.stringify({ photos, savedAt: new Date().toISOString() }));
}

/** @returns {{ photos: PhotoMeta[], savedAt?: string }} */
export function getDraft() {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : { photos: [] };
  } catch {
    return { photos: [] };
  }
}

export function clearDraft() {
  sessionStorage.removeItem(KEY);
}
