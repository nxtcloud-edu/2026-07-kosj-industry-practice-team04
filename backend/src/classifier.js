import crypto from 'node:crypto';
import { TYPES, DETECTABLE_TYPES } from './types.js';

/**
 * 이미지 유형 분류기 (SIR-001 · Issue #10 · 멘토 피드백 7/23)
 * ────────────────────────────────────────────────────────────
 * 인터페이스:  classify({ buffer, filename, mimeType }) => Promise<{ type, confidence, needsReview, engine }>
 *
 * 두 엔진을 지원한다:
 *  - gemini : MOA_GEMINI_API_KEY가 설정되면 Google Gemini 비전 모델로 실분류
 *             (멘토 권장 — 무료 키: https://aistudio.google.com/apikey)
 *  - mock   : 키가 없거나 Gemini 호출이 실패하면 파일명 힌트 + 바이트 해시 기반의
 *             결정적 분류로 폴백. 분류 실패가 신고 접수를 막아서는 안 된다.
 *
 * 추가 어댑터(AWS Rekognition·Bedrock·자체 모델)는 classifyWithGemini와 같은
 * 형태로 함수를 추가하고 아래 classify()에서 분기하면 된다.
 */

// 신뢰도 임계값 — 이 값 미만이면 자동 통합에서 제외하고 관리자 검수 큐로 보낸다(QUR-001·COR-001).
export const REVIEW_THRESHOLD = 0.7;

const GEMINI_TIMEOUT_MS = 12000;

// 파일명 힌트: 현장에서 흔한 파일명 패턴을 우선 매칭 (mock 엔진용).
const HINTS = [
  { re: /(pothole|포트홀|도로|road|asphalt|균열|crack)/i, type: '도로 파손' },
  { re: /(lamp|light|가로등|street.?light|조명)/i, type: '가로등 고장' },
  { re: /(trash|garbage|쓰레기|투기|waste|dump)/i, type: '쓰레기 무단투기' },
];

/* ──────────────────── Gemini 실분류 ──────────────────── */

const GEMINI_PROMPT = [
  '당신은 한국 지자체 생활 불편 신고 사진을 분류하는 시스템입니다.',
  '사진을 보고 아래 네 가지 유형 중 정확히 하나로 분류하세요.',
  `유형: ${JSON.stringify(TYPES)}`,
  '판단이 어렵거나 해당 유형이 없으면 "기타"를 사용하세요.',
  'confidence는 0과 1 사이 숫자로, 확신 정도를 나타냅니다.',
  '반드시 JSON 객체 하나만 출력하세요: {"type": "<유형>", "confidence": <숫자>}',
].join('\n');

async function classifyWithGemini({ buffer, mimeType }) {
  const key = process.env.MOA_GEMINI_API_KEY;
  // gemini-flash-latest는 무료 티어 할당량이 있는 현행 flash 모델을 가리킨다.
  // (일부 신규 키는 gemini-2.0-flash 무료 할당량이 0이라 429가 난다)
  const model = process.env.MOA_GEMINI_MODEL || 'gemini-flash-latest';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: GEMINI_PROMPT },
            { inline_data: { mime_type: mimeType || 'image/jpeg', data: buffer.toString('base64') } },
          ],
        }],
        generationConfig: { temperature: 0.1, response_mime_type: 'application/json' },
      }),
    });

    if (!res.ok) throw new Error(`Gemini 응답 ${res.status}`);
    const payload = await res.json();
    const text = payload?.candidates?.[0]?.content?.parts?.[0]?.text;
    const parsed = JSON.parse(text);

    const type = TYPES.includes(parsed.type) ? parsed.type : '기타';
    const confidence = Math.min(1, Math.max(0, Number(parsed.confidence) || 0));
    return { type, confidence, needsReview: confidence < REVIEW_THRESHOLD, engine: 'gemini' };
  } finally {
    clearTimeout(timer);
  }
}

/* ──────────────────── Mock 분류 (폴백) ──────────────────── */

async function classifyWithMock({ buffer, filename = '' }) {
  const hash = crypto.createHash('sha1').update(buffer).digest();

  const hint = HINTS.find((h) => h.re.test(filename));
  // 힌트가 있으면 해당 유형, 없으면 이미지 해시로 주요 3종 중 결정적으로 선택.
  const type = hint ? hint.type : DETECTABLE_TYPES[hash[0] % DETECTABLE_TYPES.length];

  // 신뢰도 0.55~0.95를 해시에서 결정적으로 산출. 힌트가 있으면 0.8 이상으로 보정.
  const base = Math.round((0.55 + (hash[1] / 255) * 0.4) * 100) / 100;
  const confidence = hint ? Math.max(base, 0.8) : base;

  await new Promise((r) => setTimeout(r, 250)); // 분류 API 왕복 시간 모사

  return { type, confidence, needsReview: confidence < REVIEW_THRESHOLD, engine: 'mock' };
}

/* ──────────────────────── 진입점 ──────────────────────── */

export async function classify({ buffer, filename = '', mimeType }) {
  if (!buffer || buffer.length === 0) {
    throw new Error('분류할 이미지 데이터가 없습니다.');
  }

  if (process.env.MOA_GEMINI_API_KEY) {
    try {
      return await classifyWithGemini({ buffer, mimeType });
    } catch (e) {
      // 실분류 장애가 신고 흐름을 막지 않도록 mock으로 폴백하고 사유만 남긴다.
      console.error(`[classifier] Gemini 분류 실패 — mock 폴백: ${e.message}`);
    }
  }
  return classifyWithMock({ buffer, filename });
}

// 여러 장을 한 번에 분류 (추가 사진 참여 프로그램·배치 재분류용).
export async function classifyBatch(items) {
  return Promise.all(items.map((it) => classify(it)));
}

export { TYPES };
