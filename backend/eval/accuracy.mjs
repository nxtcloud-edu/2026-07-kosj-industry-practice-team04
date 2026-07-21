// 분류 정확도 표본 점검 (QUR-002 · 요구사항 #25)
// ──────────────────────────────────────────────────────────────
// 표본 데이터셋을 분류기에 통과시켜 (1) 전체 정확도 (2) 유형별 정오 혼동표
// (3) 평균 신뢰도 (4) 검수 큐 회부율 을 측정하고, 목표 정확도 미달 시 실패(exit 1).
//
// 실제 모델 도입 후에도 같은 스크립트를 그대로 돌려 회귀 여부를 점검한다
// (MOA_CLASSIFIER=rekognition npm run eval). 표본은 아래 FIXTURES에 라벨과 함께 정의.
//
// 실행: npm run eval   (backend 폴더에서)   ·   목표값 조정: MOA_ACC_TARGET=0.8 npm run eval

import { classify, REVIEW_THRESHOLD } from '../src/classifier.js';
import { TYPES } from '../src/types.js';

const TARGET = Number(process.env.MOA_ACC_TARGET || 0.75);

// 표본 데이터셋 — 실제 운영에서는 담당자가 검수·확정한 라벨 이미지로 교체(DAR-002).
// seed는 재현 가능한 바이트를 만들기 위한 값(같은 seed = 같은 분류 결과).
const FIXTURES = [
  { file: 'pothole_gangnam_01.jpg', truth: '도로 파손', seed: 'a1' },
  { file: 'road_crack_02.jpg', truth: '도로 파손', seed: 'a2' },
  { file: '도로파손_yeouido_03.jpg', truth: '도로 파손', seed: 'a3' },
  { file: 'asphalt_damage_04.jpg', truth: '도로 파손', seed: 'a4' },
  { file: 'streetlight_out_01.jpg', truth: '가로등 고장', seed: 'b1' },
  { file: 'lamp_broken_02.jpg', truth: '가로등 고장', seed: 'b2' },
  { file: '가로등_flicker_03.jpg', truth: '가로등 고장', seed: 'b3' },
  { file: 'streetlight_dark_04.jpg', truth: '가로등 고장', seed: 'b4' },
  { file: 'trash_dump_01.jpg', truth: '쓰레기 무단투기', seed: 'c1' },
  { file: 'garbage_pile_02.jpg', truth: '쓰레기 무단투기', seed: 'c2' },
  { file: '쓰레기투기_03.jpg', truth: '쓰레기 무단투기', seed: 'c3' },
  { file: 'illegal_waste_04.jpg', truth: '쓰레기 무단투기', seed: 'c4' },
  // 파일명 힌트가 없는 실제 촬영본 — 해시 경로 + 검수 큐 흐름 점검용
  { file: 'IMG_2207.jpg', truth: '도로 파손', seed: 'x1' },
  { file: 'photo_4821.jpg', truth: '가로등 고장', seed: 'x2' },
  { file: 'DCIM_0033.jpg', truth: '쓰레기 무단투기', seed: 'x3' },
];

function pad(s, n) {
  s = String(s);
  // 한글은 폭 2로 계산해 대략 정렬
  let w = 0;
  for (const ch of s) w += ch.charCodeAt(0) > 0x2e80 ? 2 : 1;
  return s + ' '.repeat(Math.max(0, n - w));
}
const pct = (x) => `${(x * 100).toFixed(1)}%`;

async function run() {
  const rows = [];
  for (const fx of FIXTURES) {
    const buffer = Buffer.from(`${fx.file}|${fx.seed}`);
    const { type, confidence, needsReview } = await classify({ buffer, filename: fx.file });
    rows.push({ ...fx, pred: type, confidence, correct: type === fx.truth, review: needsReview });
  }

  const total = rows.length;
  const correct = rows.filter((r) => r.correct).length;
  const accuracy = correct / total;
  const avgConf = rows.reduce((a, r) => a + r.confidence, 0) / total;
  const reviewCount = rows.filter((r) => r.review).length;

  // 상세 표
  console.log('\n📋 표본별 분류 결과');
  console.log('─'.repeat(72));
  console.log(pad('파일', 26) + pad('정답', 16) + pad('예측', 16) + pad('신뢰도', 9) + '판정');
  console.log('─'.repeat(72));
  for (const r of rows) {
    const mark = r.correct ? '✓' : '✗';
    const flag = r.review ? ' ⚑검수' : '';
    console.log(pad(r.file, 26) + pad(r.truth, 16) + pad(r.pred, 16) + pad(pct(r.confidence), 9) + mark + flag);
  }

  // 유형별 재현율(혼동표)
  console.log('\n🔢 유형별 재현율');
  console.log('─'.repeat(72));
  for (const t of TYPES) {
    const of = rows.filter((r) => r.truth === t);
    if (of.length === 0) continue;
    const hit = of.filter((r) => r.correct).length;
    console.log(`${pad(t, 16)} ${hit}/${of.length}  (${pct(hit / of.length)})`);
  }

  // 요약
  console.log('\n📊 요약');
  console.log('─'.repeat(72));
  console.log(`전체 정확도   : ${correct}/${total}  = ${pct(accuracy)}`);
  console.log(`평균 신뢰도   : ${pct(avgConf)}`);
  console.log(`검수 큐 회부   : ${reviewCount}/${total}  (신뢰도 < ${pct(REVIEW_THRESHOLD)} → 관리자 검수)`);
  console.log(`목표 정확도   : ${pct(TARGET)}`);
  console.log('─'.repeat(72));

  if (accuracy < TARGET) {
    console.error(`\n❌ 정확도 ${pct(accuracy)} < 목표 ${pct(TARGET)} — 모델·표본 점검 필요\n`);
    process.exit(1);
  }
  console.log(`\n✅ 정확도 ${pct(accuracy)} ≥ 목표 ${pct(TARGET)} — 통과 (검수 큐가 저신뢰 건을 걸러냄)\n`);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
