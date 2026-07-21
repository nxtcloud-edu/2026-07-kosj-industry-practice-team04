// 신고 유형 상수 — 분류기(classifier)와 도메인 로직이 공유하는 단일 출처.
// 백엔드 코어(#3)의 domain.js는 이 파일을 re-export 하도록 통합하면 중복이 없어진다.
export const TYPES = ['도로 파손', '가로등 고장', '쓰레기 무단투기', '기타'];

// 분류기가 자동 판별하는 3개 주요 유형 (기타는 사람이 지정하거나 재분류로만 부여).
export const DETECTABLE_TYPES = TYPES.slice(0, 3);
