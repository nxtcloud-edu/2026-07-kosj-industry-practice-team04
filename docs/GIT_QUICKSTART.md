# 팀원용 Git 협업 퀵스타트 — 이대로만 따라하세요

> PR 기반 협업이 처음인 팀원을 위한 문서입니다. 규칙의 "왜"는 [COLLABORATION.md](COLLABORATION.md), 여기는 "어떻게"만.

## 1. 처음 한 번만 (최초 세팅, 5분)

```bash
# ① 레포 클론
git clone https://github.com/nxtcloud-edu/2026-07-kosj-industry-practice-team04.git
cd 2026-07-kosj-industry-practice-team04

# ② 내 이름·이메일 설정 (커밋에 기록됨 — GitHub 가입 이메일 권장)
git config user.name "김성현"
git config user.email "내깃허브이메일@gmail.com"
```

- 첫 `git push` 때 브라우저 로그인 창이 뜹니다 → GitHub 로그인 한 번이면 이후 자동.
- 로그인 창이 안 뜨고 에러가 나면: [git-scm.com](https://git-scm.com/download/win)에서 최신 Git 설치 후 재시도.

## 2. 작업 사이클 (매 작업마다 반복) ⭐

이 9단계가 우리 팀 협업의 전부입니다.

```bash
# ① 보드(Projects)에서 이슈 하나 잡기 — 담당자에 나를 지정, In progress로 이동

# ② 항상 최신 main에서 시작
git checkout main
git pull origin main

# ③ 이슈 번호로 브랜치 만들기 (예: 이슈 #12)
git checkout -b 12-photo-upload
#    └ 더 쉬운 방법: GitHub 이슈 페이지 우측 Development → "Create a branch"
#      → 안내대로 git fetch origin && git checkout 12-photo-upload

# ④ 코드 작성 후 커밋 (작게, 자주)
git add .
git commit -m "feat: 사진 촬영 화면 미리보기 추가 (#12)"

# ⑤ 푸시
git push -u origin 12-photo-upload

# ⑥ PR 만들기 — 푸시 직후 GitHub 레포에 뜨는 노란 배너
#    [Compare & pull request] 클릭 → 템플릿 채우기 → 본문에 "Closes #12" 꼭 포함

# ⑦ 리뷰어 지정 (우측 Reviewers) + 슬랙에 PR 링크 공유

# ⑧ Approve 받으면 [Squash and merge] 클릭 → [Delete branch]

# ⑨ 다음 작업은 다시 ②부터 (머지된 브랜치는 재사용 금지!)
```

### 커밋 메시지 규칙 (30초 요약)

`타입: 무엇을 했는지 (#이슈번호)` — 타입은 `feat`(기능) `fix`(수정) `docs`(문서) `refactor`(정리) `test` `chore`(설정)

## 3. 여러 명이 동시에 작업할 때

- **다른 사람과 같은 파일을 건드릴 것 같으면** 슬랙에 먼저 말하기 (충돌 예방이 해결보다 쉬움)
- 내 브랜치 작업이 이틀 넘게 길어지면 중간중간 main을 당겨오기:

```bash
git checkout 12-photo-upload
git pull origin main        # main의 최신 변경을 내 브랜치에 합치기
```

## 4. 충돌(Conflict) 났을 때 — 당황하지 않기

`git pull origin main` 후 `CONFLICT` 메시지가 나오면:

1. VS Code에서 충돌 파일을 열면 `<<<<<<<` `=======` `>>>>>>>` 표시가 보임
2. **Accept Current / Incoming / Both** 버튼으로 남길 코드 선택 (어느 쪽이 맞는지 모르면 그 코드 작성자에게 물어보기!)
3. 정리 후:

```bash
git add .
git commit -m "merge: main 반영 및 충돌 해결 (#12)"
git push
```

## 5. 리뷰하는 법 (리뷰어용)

1. PR 페이지 → **Files changed** 탭
2. 의견 있는 줄에 마우스 올려 **+** 클릭 → 코멘트 작성
3. 다 봤으면 우상단 **Review changes** →
   - **Approve**: 머지 OK (코멘트 한 줄이라도 남기기 — 포트폴리오에 남습니다)
   - **Request changes**: 수정 필요
4. 뭘 봐야 할지 모르겠으면 이 4개만: ① 실행해보면 돌아가는가 ② 이슈의 완료 조건을 채웠는가 ③ 이해 안 되는 코드가 있는가(있으면 질문 코멘트) ④ 하드코딩·비밀키가 섞여 있지 않은가

## 6. 하지 말 것 🚫

| 금지 | 이유 |
|---|---|
| `git push origin main` (main 직접 푸시) | 리뷰 없는 코드가 시연 브랜치를 깨뜨림 (보호 규칙으로 차단됨) |
| `git push --force` | 팀원 커밋이 날아갈 수 있음. 필요하면 슬랙에 먼저 물어보기 |
| 여러 기능을 한 PR에 몰아넣기 | 리뷰 불가능 → 대충 approve → 협업이 형식이 됨 |
| 머지된 브랜치 재사용 | 히스토리 꼬임. 새 작업 = 새 브랜치 |
| `.env`, API 키 커밋 | 공개 레포입니다. 키는 슬랙 DM으로, 파일은 `.gitignore`에 |

## 7. 꼬였을 때 응급 명령어

```bash
git status                    # 지금 상태 확인 (모든 문제 해결의 시작)
git stash                     # 작업 중인 변경 임시 보관 (브랜치 잘못 들어왔을 때)
git stash pop                 # 보관한 변경 꺼내기
git checkout -- 파일명         # 파일 하나를 마지막 커밋 상태로 되돌리기
git log --oneline -5          # 최근 커밋 5개 보기
```

그래도 모르겠으면 **강제로 뭔가 하지 말고** 슬랙에 ① 하려던 것 ② `git status` 결과 ③ 에러 메시지 전문을 붙여넣으세요. 대부분 5분 안에 풀립니다.
