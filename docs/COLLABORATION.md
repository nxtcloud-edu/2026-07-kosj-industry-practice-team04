# 4팀 「모아」 협업 가이드 — GitHub + Jira

> 이 문서를 팀 레포의 `docs/COLLABORATION.md`(또는 루트 `CONTRIBUTING.md`)로 커밋해서 팀 규칙으로 쓰세요.
> 레포: https://github.com/nxtcloud-edu/2026-07-kosj-industry-practice-team04

---

## 0. 지금 당장 할 일 — 로컬 작업물 업로드 (오늘)

멘토 지적대로 레포에는 `notice.md` 하나뿐입니다. **각자 로컬 작업을 먼저 브랜치로 올리고, PR에서 차이를 논의해 하나로 통합**합니다. main에 직접 푸시하지 말고 처음부터 PR로 시작하는 것이 포트폴리오에도 남습니다.

### 각 팀원이 할 일 (각자 자기 이름으로)

```bash
# 1. 레포 클론 (이미 했다면 생략)
git clone https://github.com/nxtcloud-edu/2026-07-kosj-industry-practice-team04.git
cd 2026-07-kosj-industry-practice-team04

# 2. 자기 작업 브랜치 생성
git checkout -b upload/성현-local-work   # 각자 자기 이름으로

# 3. 로컬 작업물을 레포 폴더로 복사한 뒤
git add .
git commit -m "chore: 성현 로컬 작업물 업로드 (신고 화면 프로토타입)"
git push -u origin upload/성현-local-work

# 4. GitHub에서 Pull Request 생성 (base: main)
```

### 통합 순서 (팀 전체가 함께, 30분 회의 권장)

1. 4명의 PR을 모두 연 상태에서 **겹치는 파일**을 확인
2. 가장 완성도 높은 버전을 기준(base)으로 정해 먼저 머지
3. 나머지 PR은 `git pull origin main` 후 충돌 해결(다른 부분만 남기고) → 머지
4. 통합 후 main 기준으로 폴더 구조 확정: 예) `frontend/` `backend/` `docs/`

> 💡 1주차 아이디어 노트 HTML과 2주차 제안서(PDF·HTML)도 `docs/` 폴더에 커밋해 두세요. 멘토가 "문서도 보여주면서 이야기해달라"고 한 것에 바로 대응됩니다.

---

## 1. 브랜치 전략 — GitHub Flow (단순하게)

4주 프로젝트에는 git-flow(develop/release 브랜치)는 과합니다. **main + 기능 브랜치** 2단계면 충분합니다.

```
main ──────●─────────●───────●──→  항상 "시연 가능한" 상태 유지
            \       /       /
             ●──●──●   ●──●        feature 브랜치 (이슈 단위, 1~3일 수명)
```

| 규칙 | 내용 |
|---|---|
| main 보호 | Settings → Branches → Branch protection: `main`에 **직접 push 금지**, PR 필수, 리뷰 1명 이상 승인 필수 |
| 브랜치 이름 | `MOA-12-photo-upload` (Jira 이슈 키 + 짧은 설명) — Jira 연동의 핵심 |
| 브랜치 수명 | 1~3일 내 머지. 오래 살수록 충돌 지옥 |
| 머지 방식 | **Squash and merge** 권장 — main 히스토리가 "이슈 1개 = 커밋 1개"로 깔끔해짐 |

## 2. 커밋 메시지 컨벤션 (Conventional Commits 축약형)

```
feat: 사진 촬영 화면 3단계 진행 표시 추가 (MOA-12)
fix: GPS 권한 거부 시 지도 선택으로 폴백 (MOA-18)
docs: 2주차 입찰 제안서 추가
refactor: 신고 API 응답 형식 통일
chore: ESLint 설정 추가
```

- 타입: `feat` `fix` `docs` `refactor` `test` `chore`
- **커밋 메시지에 Jira 이슈 키(MOA-12)를 넣으면 Jira에서 자동으로 연결됩니다** (아래 4장)

## 3. Pull Request 규칙

- **PR은 작게**: 화면 1개, 기능 1개 단위. 500줄 넘으면 쪼개기
- PR 템플릿 (레포에 `.github/pull_request_template.md`로 저장):

```markdown
## 무엇을 (What)
- MOA-12: 사진 촬영 화면 구현

## 왜 (Why)
- MVP 레벨 1 — 3단계 신고 흐름

## 확인 방법 (How to test)
- `npm run dev` → /report 접속 → 사진 선택 시 압축·미리보기 확인

## 스크린샷
(화면 변경 시 첨부)
```

- **리뷰는 24시간 내**: 리뷰가 병목이 되면 안 됨. 승인 1명이면 머지 가능
- 리뷰어는 돌아가면서: FE 작업은 BE 담당이, BE 작업은 FE 담당이 보면 서로 코드를 알게 됨
- 급한 핫픽스도 PR로 (셀프 머지 허용하되 사후 리뷰)

## 4. Jira 연동 — JIRA + GITHUB 세팅 (30분이면 끝)

### 4-1. Jira 프로젝트 만들기 (팀장 1명이)

1. https://www.atlassian.com/software/jira → **Free 플랜** 가입 (10명까지 무료, 팀 4명이니 충분)
2. 사이트 이름: 예) `moa-team4.atlassian.net`
3. 프로젝트 생성: **Scrum 템플릿**, 프로젝트 키 **`MOA`** ← 이 키가 모든 이슈 번호의 접두어(MOA-1, MOA-2…)
4. 팀원 3명 이메일로 초대

### 4-2. GitHub 연동 (핵심)

1. Jira 좌측 하단 **설정(⚙) → Apps → Explore more apps** → **"GitHub for Jira"** 검색 → 설치 (무료)
2. **Connect GitHub organization** → GitHub 로그인 → `nxtcloud-edu` org 선택
   - ⚠️ org 관리자(운영진) 승인이 필요할 수 있습니다. 안 되면 운영진(멘토 채널)에 "GitHub for Jira 앱 설치 승인" 요청 → 그래도 안 되면 4-4의 대안 사용
3. 연동되면 그때부터 **자동으로**:
   - 브랜치 이름/커밋 메시지/PR 제목에 `MOA-12`가 들어가면 → Jira 이슈 MOA-12에 해당 브랜치·커밋·PR이 자동 표시
   - Jira 이슈 화면에서 개발 진행 상황(브랜치 생성됨 → PR 열림 → 머지됨)이 한눈에 보임

### 4-3. 운영 리듬 (스프린트 = 1주)

| 언제 | 무엇을 |
|---|---|
| 월요일 (30분) | 스프린트 플래닝 — 백로그에서 이번 주 할 이슈 선택, 담당자 지정 |
| 매일 (10분, 허들) | 스탠드업 — 어제 한 것 / 오늘 할 것 / 막힌 것 |
| 금요일 (20분) | 스프린트 리뷰 — 데모 + 다음 주 백로그 정리 |

**이슈 작성 팁**: MVP 레벨(제안서 11p)을 에픽으로, 화면·API 단위를 스토리로.
```
에픽: MVP-1 3단계 신고 흐름
 ├─ MOA-11 사진 촬영 화면 (촬영 가이드 + 압축)
 ├─ MOA-12 위치 확인 화면 (GPS + 지도 수정)
 ├─ MOA-13 신고 완료 화면 (접수번호 발급)
 └─ MOA-14 신고 접수 API
```

**워크플로 자동화** (Jira 프로젝트 설정 → Automation, 클릭 몇 번):
- PR 열리면 → 이슈를 "In Review"로
- PR 머지되면 → 이슈를 "Done"으로

### 4-4. 대안: GitHub Projects (Jira 연동이 막히면)

org 권한 문제로 GitHub for Jira 설치가 안 되면, **GitHub Projects(무료, 레포 내장)** 가 차선책입니다:
- 레포 → Projects → Board 생성 (To do / In progress / In review / Done)
- GitHub Issues로 백로그 관리, PR에 `Closes #12` 쓰면 머지 시 이슈 자동 닫힘
- 도구가 하나로 합쳐져 더 간단하다는 장점도 있음. 단, "Jira 사용 경험"은 포트폴리오 가치가 있으니 연동이 되면 Jira 우선

## 5. 포트폴리오를 위한 습관 (멘토 강조 사항)

멘토: *"AI 코딩 도구로 코드 생성량이 늘어난 지금, 협업 경험 여부가 채용 시 중요한 평가 요소"*

- ✅ 모든 변경은 PR로 — 머지된 PR 목록이 곧 협업 증거
- ✅ 리뷰 코멘트를 실제로 남기기 (approve만 누르지 말고 한 줄이라도)
- ✅ 커밋 메시지에 이슈 키 — "계획 → 구현 → 리뷰 → 머지"의 추적 가능한 사슬
- ✅ README에 아키텍처 그림 + 실행 방법 + 팀원 역할 명시
- ✅ 매주 금요일 main에 태그: `git tag week3-demo && git push --tags`

---

## 부록: 오늘 체크리스트

- [ ] 각자 로컬 작업 → `upload/이름` 브랜치로 push → PR 생성
- [ ] 팀 회의로 4개 PR 통합, 폴더 구조 확정
- [ ] main 브랜치 보호 규칙 설정 (PR 필수 + 리뷰 1명)
- [ ] `.github/pull_request_template.md` 추가
- [ ] Jira Free 가입 → MOA 프로젝트 생성 → 팀원 초대
- [ ] GitHub for Jira 앱 연동 (안 되면 운영진에 승인 요청)
- [ ] 제안서 MVP 레벨 1~5를 에픽으로 등록, 3주차 스프린트 이슈 생성
- [ ] 1·2주차 문서(아이디어 노트, 제안서)를 `docs/`에 커밋
