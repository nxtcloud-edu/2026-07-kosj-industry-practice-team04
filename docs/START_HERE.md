# 👋 4팀 「모아」 — 지금부터 이렇게 진행합니다

> 팀원 전원이 처음 읽는 문서입니다. 이 문서 → [GIT_QUICKSTART.md](GIT_QUICKSTART.md)(명령어 따라하기) → [COLLABORATION.md](COLLABORATION.md)(규칙 상세) 순서로 보면 됩니다.
> 레포: https://github.com/nxtcloud-edu/2026-07-kosj-industry-practice-team04

## 0. 현재 상황 (7/16 기준)

**완료된 것**
- ✅ 2주차 입찰 제안서 완성 — [docs/2주차_입찰제안서_모아.pdf](2주차_입찰제안서_모아.pdf) (멘토 피드백 7건 반영: 접근성 MVP 격상, 50m·72h 통합 기준 근거, 오통합 분리 절차, 후보 선택 UX, 토큰 조회, 악용 방지·보관 정책, 웹앱 진화 경로)
- ✅ 레포 협업 세팅 — [PR #1](https://github.com/nxtcloud-edu/2026-07-kosj-industry-practice-team04/pull/1)(문서·템플릿), **이슈 25개**(3주차 22 + 4주차 3), 라벨 11개, 마일스톤 2개
- ✅ 협업 방식 확정 — Jira 없이 **GitHub 단일 체계** (Issues + Projects 보드)

**아직 안 된 것 → 아래 "오늘 할 일"**
- ⬜ 각자 로컬 작업물 업로드 + 하나로 통합
- ⬜ PR #1 리뷰·머지, Projects 보드, main 보호
- ⬜ 역할 분담 확정

## 1. 오늘 할 일 (전원, 각자 약 15분)

### STEP 1 — 최초 세팅 (전원, 5분)

```bash
git clone https://github.com/nxtcloud-edu/2026-07-kosj-industry-practice-team04.git
cd 2026-07-kosj-industry-practice-team04
git config user.name "본인이름"
git config user.email "깃허브가입이메일@example.com"
```

첫 `git push` 때 브라우저 로그인 창이 뜨면 GitHub 로그인 한 번 (이후 자동).

### STEP 2 — PR #1 리뷰·머지 (아무나 1명, 5분)

우리 팀의 **첫 코드 리뷰 실습**입니다.
[PR #1](https://github.com/nxtcloud-edu/2026-07-kosj-industry-practice-team04/pull/1) → **Files changed** 훑어보기 → 코멘트 한 줄 → **Review changes → Approve** → **Squash and merge** → **Delete branch**

### STEP 3 — 내 로컬 작업물 올리기 (각자, 10분)

```bash
git checkout main && git pull
git checkout -b upload/본인이름          # 예: upload/jaeyong
# 내 로컬 작업 파일들을 레포 폴더에 복사한 뒤
git add .
git commit -m "chore: 재용 로컬 작업물 업로드 (관리자 화면 초안)"
git push -u origin upload/본인이름
```

푸시 후 GitHub에 뜨는 노란 배너 **[Compare & pull request]** → PR 생성. (멘토 요청 사항입니다 — 멘토링 때 작업물이 레포에 보여야 피드백을 받을 수 있어요)

### STEP 4 — 통합 회의 (4명 다 올라오면, 허들 30분)

1. PR 4개를 열어놓고 겹치는 파일 확인
2. 가장 완성도 높은 버전을 기준으로 먼저 머지
3. 나머지는 `git pull origin main` 후 충돌 해결([QUICKSTART 4장](GIT_QUICKSTART.md)) → 머지
4. 폴더 구조 확정: `frontend/` `backend/` `docs/`

### STEP 5 — 세팅 담당 1명 추가 작업 (10분)

- **Projects 보드**: 레포 Projects 탭 → New project → Board → 컬럼 `To do/In progress/In review/Done` → ⚙ Workflows에서 *Auto-add* + *PR merged→Done* 켜기
- **main 보호**: Settings → Branches → Add rule → `main` → "Require a pull request before merging" + 리뷰 1명. Settings 탭이 없으면 슬랙으로 운영진에 요청
- 완료하면 이슈 [#4](https://github.com/nxtcloud-edu/2026-07-kosj-industry-practice-team04/issues/4) 닫기

> 📌 **내일(7/17 금) 마감**: 입찰 제안서 PDF를 운영 채널(슬랙)로 제출 — `docs/2주차_입찰제안서_모아.pdf` 파일 그대로 제출하면 됩니다.

## 2. 3주차(7/20~)부터 — 매 작업은 이 사이클

```
① Issues 탭에서 이슈 하나 잡기 (Assignee = 나, 보드에서 In progress로)
② git checkout main && git pull
③ git checkout -b 12-photo-upload     ← 이슈 번호로 브랜치
④ 코드 작성 → git commit -m "feat: ... (#12)"   (작게, 자주)
⑤ git push -u origin 12-photo-upload
⑥ PR 생성 — 본문에 "Closes #12" 필수
⑦ 리뷰어 지정 + 슬랙에 PR 링크
⑧ Approve 받으면 Squash and merge → 브랜치 삭제
⑨ 다음 이슈로 ①부터 반복
```

상세 설명·충돌 해결·리뷰하는 법: [GIT_QUICKSTART.md](GIT_QUICKSTART.md)

**팀 리듬**: 월요일 플래닝 30분 · 매일 스탠드업 10분(허들: 어제/오늘/막힌 것) · 금요일 데모 + `git tag week3-demo`

## 3. 우리 팀 규칙 — 5줄 요약

1. **모든 작업은 이슈에서 시작** (이슈 없으면 이슈부터 만들기)
2. **main 직접 push 금지** — 무조건 브랜치 → PR → 리뷰 → Squash merge
3. **PR은 작게** (화면 1개·기능 1개), **리뷰는 24시간 내**
4. **브랜치·커밋·PR에 이슈 번호** (`12-photo-upload`, `(#12)`, `Closes #12`)
5. **30분 이상 혼자 막히지 않기** — 슬랙에 상황 + `git status` + 에러 전문

## 4. 역할 분담 (통합 회의에서 결정)

이슈에 영역 라벨이 붙어 있으니, 영역별로 주 담당을 정하고 이슈 Assignee를 지정하세요:

| 영역 라벨 | 이슈 수 | 내용 | 담당 |
|---|---|---|---|
| `frontend` | 11 | 시민 웹앱 화면 (신고 3단계·접근성·조회) | ? (2명 권장) |
| `backend` | 7 | 신고 API·통합/우선순위 로직·상태 모델 | ? |
| `ai` | 2 | 이미지 분류 연동·정확도 점검 | ? |
| `admin` | 3 | 관리자 검수 화면·대시보드 | ? |
| `infra` | 2 | 배포 파이프라인·안정화 | ? |

결정되면 README의 팀원 역할 표를 업데이트하세요 — 이것도 브랜치 파서 PR로! (첫 연습으로 딱 좋습니다)

## 5. 문서 지도

| 궁금한 것 | 문서 |
|---|---|
| git 명령어를 모르겠다 | [GIT_QUICKSTART.md](GIT_QUICKSTART.md) — 복붙으로 따라하기 |
| 규칙의 이유·보드 세팅 | [COLLABORATION.md](COLLABORATION.md) |
| 뭘 만들어야 하는지 | [Issues 탭](https://github.com/nxtcloud-edu/2026-07-kosj-industry-practice-team04/issues) (원본 목록: [BACKLOG.md](BACKLOG.md)) |
| 우리가 뭘 제안했는지 | [입찰 제안서 PDF](2주차_입찰제안서_모아.pdf) · [1주차 아이디어 노트](1주차_초기아이디어노트.html) |
| 왜 이 기능을 만드는지 | 제안서 11p MVP 레벨 ↔ 이슈의 `mvp-N` 라벨이 1:1 대응 |
