# 🔗 팀 통합 참고 — AI/Admin PR(#28·#29) 반영 시

김성현(AI·Admin)의 PR이 머지된 뒤, 다른 팀원 작업과 아래 지점에서 만납니다.
**각자 담당 이슈를 시작할 때 이 문서를 먼저 확인**하세요. (관련 PR: [#28 AI 분류](https://github.com/nxtcloud-edu/2026-07-kosj-industry-practice-team04/pull/28) · [#29 관리자 콘솔](https://github.com/nxtcloud-edu/2026-07-kosj-industry-practice-team04/pull/29))

## 가동진 (백엔드, #3)

- **유형 상수 단일화** — `backend/src/types.js`에 `TYPES`가 정의돼 있습니다. `domain.js`는 새로 정의하지 말고 `export { TYPES } from './types.js';`로 re-export 해서 중복을 없애 주세요.
- **분류 결과의 `needsReview`** — `classify()`가 `{ type, confidence, needsReview }`를 반환합니다. 라우터 `/analyze`에서 신뢰도 비교(`confidence < 0.7`)를 다시 하지 말고 반환값의 `needsReview`를 그대로 쓰면 됩니다.
- **`backend/package.json`** — 지금은 AI 파트 baseline(`type: module` + `test`/`eval` 스크립트)만 있습니다. express·cors 의존성과 `dev`/`seed` 스크립트를 여기에 **추가(union)** 하세요. 덮어쓰지 말 것.

## FE 팀 (심송언·김재용, 시민 화면 #5~#8·#19·#20)

- **`api.js` 공용** — `frontend/src/api.js`는 시민·관리자 공용 클라이언트입니다. 시민용 함수(`analyzePhoto`·`nearbyIssues`·`createReport`·`getStatus`·`addEmpathy`)가 이미 들어 있으니 새로 만들지 말고 그대로 import 하세요.
- **`App.jsx` 병합** — 지금은 관리자 라우트(`/admin`, `/admin/issues/:id`)와 임시 홈만 있습니다. 시민 라우트(`/`, `/status/:receiptNo`)를 추가하고 임시 홈(`Home`)을 실제 신고 플로우로 교체하세요.
- **스타일 도입** — 지금 `index.css`는 최소 전역(리셋·`.spinner`·`.notice`)만 있습니다. 시민 웜 틸 디자인 시스템은 `styles.css`로 별도 도입하고 `main.jsx`의 import를 조정하세요. (관리자 `admin.css`는 자체 완결형이라 건드릴 필요 없음)
- **`frontend/package.json`** — 지금은 react/react-dom/react-router-dom만 있습니다. 지도용 `leaflet` 등 시민 화면 의존성을 추가하세요.

## 실행 의존성 (전원)

- 관리자 콘솔의 **실데이터**는 백엔드(#3)+분류기(#10)가 `localhost:4000`에 떠 있어야 표시됩니다. 프론트 vite proxy가 `/api`·`/uploads`를 4000으로 전달합니다.
- 백엔드가 아직 없으면 관리자 화면은 렌더링은 되지만 "데이터를 불러오지 못했습니다" 알림이 뜹니다 — 정상입니다.
- 현재 이 PR들은 참고용 완제품 백엔드(`../모아-MVP-완제품-참고용`)로 검증했습니다.

---

> 이 문서는 AI/Admin 파트가 다른 파트와 만나는 지점만 정리한 것입니다. 전체 작업 목록은 [BACKLOG.md](BACKLOG.md), 협업 규칙은 [COLLABORATION.md](COLLABORATION.md) 참고.
