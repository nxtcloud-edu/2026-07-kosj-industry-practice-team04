# 분류 정확도 표본 점검 (QUR-002)

RFP 품질 요구사항 QUR-002(“표본 데이터로 분류 정확도를 점검할 방법을 제시한다”)에 대응하는 평가 도구입니다.

## 실행

```bash
cd backend
npm run eval                     # 목표 정확도 75% 기준
MOA_ACC_TARGET=0.8 npm run eval  # 목표 상향
```

## 측정 항목

| 지표 | 의미 |
|---|---|
| 전체 정확도 | 표본 중 예측=정답 비율 |
| 유형별 재현율 | 각 유형 표본을 얼마나 맞혔는지 (혼동 파악) |
| 평균 신뢰도 | 분류기가 낸 confidence 평균 |
| 검수 큐 회부율 | 신뢰도 < 0.7 로 관리자 검수로 넘어간 비율 (COR-001·QUR-001 안전망) |

목표 정확도 미달 시 **exit 1** 로 실패하므로 CI 게이트로도 쓸 수 있습니다.

## 표본 교체 방법

`eval/accuracy.mjs` 의 `FIXTURES` 배열이 표본입니다. 현재는 데모용 합성 표본이며,
실제 운영에서는 **담당자가 검수·확정한 라벨 이미지**(DAR-002로 축적되는 정제 라벨)로 교체합니다.
각 항목은 `{ file, truth, seed }` 형태이고 `truth` 가 정답 라벨입니다.

## 실제 분류 모델로 교체 후 점검

`src/classifier.js` 의 `classify()` 를 실제 API(예: AWS Rekognition)로 교체한 뒤
**같은 명령**을 다시 실행하면, 목(mock) 대비 실제 모델의 정확도 회귀를 동일 기준으로 비교할 수 있습니다.

```bash
MOA_CLASSIFIER=rekognition npm run eval
```
