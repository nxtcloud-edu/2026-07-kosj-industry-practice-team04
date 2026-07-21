import crypto from 'node:crypto';
import { TYPES, DETECTABLE_TYPES } from './types.js';

/**
 * 이미지 유형 분류기 (SIR-001 · 요구사항 #10)
 * ────────────────────────────────────────────────────────────
 * 인터페이스:  classify({ buffer, filename }) => Promise<{ type, confidence }>
 *
 * 현재는 MVP 시연용 MockClassifier — 파일명 힌트 + 이미지 바이트 해시 기반의
 * "결정적(같은 사진 = 항상 같은 결과)" 분류로, 실제 모델 없이도 전체 신고
 * 파이프라인과 검수 큐 흐름을 시연할 수 있게 한다.
 *
 * 실제 배포 시에는 이 파일의 classify() 한 곳만 아래 어댑터로 교체하면 되고,
 * 이 모듈을 사용하는 라우터(#3)·정확도 점검(#25)은 수정할 필요가 없다:
 *   - AWS Rekognition Custom Labels
 *   - Amazon Bedrock (멀티모달)
 *   - 자체 학습 모델 (로드맵 10단계, DAR-002 라벨 축적 기반)
 * 교체 지점은 MOA_CLASSIFIER 환경변수로 분기하도록 아래에 표시해 두었다.
 */

// 신뢰도 임계값 — 이 값 미만이면 자동 통합에서 제외하고 관리자 검수 큐로 보낸다(QUR-001·COR-001).
export const REVIEW_THRESHOLD = 0.7;

// 파일명 힌트: 현장에서 흔한 파일명 패턴을 우선 매칭 (실모델 도입 전 데모 품질 확보).
const HINTS = [
  { re: /(pothole|포트홀|도로|road|asphalt|균열|crack)/i, type: '도로 파손' },
  { re: /(lamp|light|가로등|street.?light|조명)/i, type: '가로등 고장' },
  { re: /(trash|garbage|쓰레기|투기|waste|dump)/i, type: '쓰레기 무단투기' },
];

export async function classify({ buffer, filename = '' }) {
  // ── 실 서비스 연동 지점 ──────────────────────────────────
  // if (process.env.MOA_CLASSIFIER === 'rekognition') {
  //   return await classifyWithRekognition(buffer); // 수초 내 응답 — PER-001
  // }
  // ─────────────────────────────────────────────────────────
  if (!buffer || buffer.length === 0) {
    throw new Error('분류할 이미지 데이터가 없습니다.');
  }

  const hash = crypto.createHash('sha1').update(buffer).digest();

  const hint = HINTS.find((h) => h.re.test(filename));
  // 힌트가 있으면 해당 유형, 없으면 이미지 해시로 주요 3종 중 결정적으로 선택.
  const type = hint ? hint.type : DETECTABLE_TYPES[hash[0] % DETECTABLE_TYPES.length];

  // 신뢰도 0.55~0.95를 해시에서 결정적으로 산출. 힌트가 있으면 0.8 이상으로 보정.
  const base = Math.round((0.55 + (hash[1] / 255) * 0.4) * 100) / 100;
  const confidence = hint ? Math.max(base, 0.8) : base;

  await new Promise((r) => setTimeout(r, 250)); // 분류 API 왕복 시간 모사

  return { type, confidence, needsReview: confidence < REVIEW_THRESHOLD };
}

// 여러 장을 한 번에 분류 (추가 사진 참여 프로그램·배치 재분류용).
export async function classifyBatch(items) {
  return Promise.all(items.map((it) => classify(it)));
}

export { TYPES };
