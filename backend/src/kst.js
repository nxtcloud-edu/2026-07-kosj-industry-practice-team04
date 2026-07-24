/**
 * 한국 표준시(KST) 날짜 헬퍼
 * ─────────────────────────────────────────────────────
 * 서버가 어느 타임존에서 돌든(UTC 컨테이너가 일반적) 접수번호·업로드 경로의
 * 날짜는 한국 사용자가 보는 날짜와 일치해야 한다. UTC로 찍으면 KST 00:00~09:00
 * 접수분이 전날 날짜(MOA-<어제>)를 받는 문제가 생긴다.
 *
 * 서버 로케일에 의존하지 않도록 Asia/Seoul 타임존으로 명시 포맷한다.
 */

const KST = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Seoul',
  year: 'numeric', month: '2-digit', day: '2-digit',
});

/** KST 기준 'YYYY-MM-DD' */
export function kstDateISO(date = new Date()) {
  return KST.format(date); // en-CA는 YYYY-MM-DD 형식
}

/** KST 기준 'YYYYMMDD' (접수번호용) */
export function kstDateCompact(date = new Date()) {
  return kstDateISO(date).replace(/-/g, '');
}

/** KST 기준 'YYYY/MM/DD' (업로드 파일 경로용) */
export function kstDatePath(date = new Date()) {
  return kstDateISO(date).replace(/-/g, '/');
}
