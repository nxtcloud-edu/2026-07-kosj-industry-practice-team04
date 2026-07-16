# 4팀 「모아」 협업 가이드 — GitHub 단일 체계

> 이슈·보드·코드·리뷰를 전부 GitHub 한 곳에서 관리합니다. 도구는 하나, 규칙은 단순하게.
> 처음이라 명령어가 낯설면 → **[GIT_QUICKSTART.md](GIT_QUICKSTART.md)** 를 그대로 따라하세요.

**3대 원칙**

1. **이슈 없이는 작업 없음** — 모든 작업은 GitHub Issue로 시작한다
2. **main 직접 push 금지** — 모든 변경은 브랜치 → PR → 리뷰 → 머지
3. **main은 항상 시연 가능 상태** — 깨진 코드는 머지하지 않는다

---

## 0. 지금 당장 할 일 — 로컬 작업물 업로드

각자 로컬 작업을 **자기 브랜치로 올리고, PR에서 차이를 논의해 하나로 통합**합니다.

```bash
git clone https://github.com/nxtcloud-edu/2026-07-kosj-industry-practice-team04.git
cd 2026-07-kosj-industry-practice-team04
git checkout -b upload/성현-local-work    # 각자 자기 이름으로
# 로컬 작업물을 폴더에 복사한 뒤
git add .
git commit -m "chore: 성현 로컬 작업물 업로드 (신고 화면 프로토타입)"
git push -u origin upload/성현-local-work
# → GitHub에서 Pull Request 생성
```

**통합 회의 (30분):** 4개의 PR을 열어놓고 → 겹치는 파일 확인 → 가장 완성도 높은 버전을 먼저 머지 → 나머지는 `git pull origin main` 후 충돌 해결 → 머지 → 폴더 구조 확정 (`frontend/` `backend/` `docs/`)

## 1. 작업 관리 — GitHub Issues + Projects

### 이슈(작업 티켓) 규칙

- 화면 1개, API 1개 수준으로 잘게 쪼갠다 (1~2일 안에 끝나는 크기)
- 제목은 명령형: "사진 촬영 화면 구현", 본문에 완료 조건 1~3줄
- 만들 때 **담당자(Assignee) + 라벨 + 마일스톤**을 붙인다
- 전체 작업 목록은 [BACKLOG.md](BACKLOG.md) 참고 — 이슈로 등록해서 사용

### 라벨 체계

| 종류 | 라벨 | 용도 |
|---|---|---|
| 에픽 | `p0` `mvp-1` `mvp-2` `mvp-3` `mvp-4` `mvp-5` | 제안서 MVP 레벨과 1:1 매핑 |
| 영역 | `frontend` `backend` `ai` `admin` `infra` | 담당 영역 구분 |

마일스톤: **`3주차 스프린트`(7/20~24)**, **`4주차 스프린트`(7/27~31)**

### Projects 보드 세팅 (팀장 1명이 5분)

1. 레포 상단 **Projects** 탭 → **Link a project → New project** → **Board** 템플릿
2. 컬럼: `To do` / `In progress` / `In review` / `Done`
3. 보드 우상단 **⚙ → Workflows**에서 자동화 켜기:
   - *Auto-add to project* — 이 레포의 이슈·PR 자동 등록
   - *Pull request merged* → **Done** 이동
4. 매일 스탠드업은 이 보드를 보면서 진행

### 이슈 ↔ 브랜치 ↔ PR 연결 (핵심!)

- 브랜치명에 이슈 번호: **`12-photo-upload`**
  - 꿀팁: 이슈 페이지 우측 **Development → Create a branch** 누르면 이름 자동 생성
- 커밋 메시지에 `(#12)` 포함 → 이슈에 커밋이 자동 표시
- PR 본문에 **`Closes #12`** → 머지되는 순간 이슈 자동 닫힘 + 보드 Done 이동

이 세 가지만 지키면 "계획 → 구현 → 리뷰 → 완료"가 추적 가능한 사슬로 남습니다.

## 2. 브랜치 전략 — GitHub Flow

4주 프로젝트에 git-flow(develop/release)는 과합니다. **main + 작업 브랜치** 2단계면 충분합니다.

```
main ──────●─────────●───────●──→  항상 "시연 가능한" 상태 유지
            \       /       /
             ●──●──●   ●──●        작업 브랜치 (이슈 단위, 1~3일 수명)
```

| 규칙 | 내용 |
|---|---|
| main 보호 | Settings → Branches → Branch protection: `main` **직접 push 금지**, PR 필수, 리뷰 1명 이상 승인 |
| 브랜치 이름 | `12-photo-upload` (이슈 번호 + 짧은 영문 설명) |
| 브랜치 수명 | 1~3일 내 머지. 오래 살수록 충돌 지옥 |
| 머지 방식 | **Squash and merge** — main 히스토리가 "이슈 1개 = 커밋 1개"로 깔끔해짐 |

## 3. 커밋 메시지 컨벤션

```
feat: 사진 촬영 화면 3단계 진행 표시 추가 (#12)
fix: GPS 권한 거부 시 지도 선택으로 폴백 (#18)
docs: 2주차 입찰 제안서 추가
refactor: 신고 API 응답 형식 통일
chore: ESLint 설정 추가
```

- 타입: `feat` `fix` `docs` `refactor` `test` `chore`
- 기능·수정 커밋에는 이슈 번호 `(#12)`를 붙인다

## 4. Pull Request 규칙

- **PR은 작게**: 화면 1개, 기능 1개 단위. 500줄 넘으면 쪼개기
- 본문은 템플릿(자동 적용)대로: What / Why / 확인 방법 / 스크린샷 + `Closes #12`
- **리뷰는 24시간 내** — 리뷰가 병목이 되면 안 됨. 승인 1명이면 머지 가능
- 리뷰어는 교차로: FE 작업은 BE 담당이, BE 작업은 FE 담당이 → 서로 코드를 알게 됨
- 급한 핫픽스도 PR로 (셀프 머지 허용하되 사후 리뷰)
- 리뷰하는 방법을 모르면 → [GIT_QUICKSTART.md 5장](GIT_QUICKSTART.md)

## 5. 운영 리듬 (스프린트 = 1주)

| 언제 | 무엇을 | 어디서 |
|---|---|---|
| 월요일 30분 | 플래닝 — 이번 주 이슈 선택·담당 지정 | Projects 보드 |
| 매일 10분 | 스탠드업 — 어제/오늘/막힌 것 | 슬랙 허들 + 보드 |
| 금요일 20분 | 리뷰 — 데모, main에 `week3-demo` 태그, 다음 주 백로그 정리 | 보드 |

## 6. 포트폴리오를 위한 습관 (멘토 강조 사항)

멘토: *"AI 코딩 도구로 코드 생성량이 늘어난 지금, 협업 경험 여부가 채용 시 중요한 평가 요소"*

- ✅ 모든 변경은 PR로 — 머지된 PR 목록이 곧 협업 증거
- ✅ 리뷰 코멘트를 실제로 남기기 (approve만 누르지 말고 한 줄이라도)
- ✅ 커밋·PR에 이슈 번호 — 추적 가능한 작업 사슬
- ✅ README에 아키텍처 그림 + 실행 방법 + 팀원 역할
- ✅ 매주 금요일 main에 태그: `git tag week3-demo && git push --tags`

---

## 부록: 오늘 체크리스트

- [ ] 각자 로컬 작업 → `upload/이름` 브랜치로 push → PR 생성
- [ ] 팀 회의로 4개 PR 통합, 폴더 구조 확정
- [ ] main 브랜치 보호 규칙 설정 (PR 필수 + 리뷰 1명)
- [ ] Projects 보드 생성 + 자동화 2개 켜기
- [ ] 라벨·마일스톤 생성, [BACKLOG.md](BACKLOG.md)의 작업을 이슈로 등록
- [ ] 3주차 스프린트 이슈에 담당자 지정
