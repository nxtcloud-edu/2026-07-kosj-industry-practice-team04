# 👋 4팀 「모아」 — 팀원은 이 문서부터

> 이 문서 → [GIT_QUICKSTART.md](GIT_QUICKSTART.md)(명령어) → [COLLABORATION.md](COLLABORATION.md)(규칙 상세) 순서로 보면 됩니다.
> 레포: https://github.com/nxtcloud-edu/2026-07-kosj-industry-practice-team04

## 0. 현재 상황 (7/23 기준)

**끝난 것**

- ✅ **3주차 스프린트 24개 이슈 전부 완료** — MVP 1~5 전 기능이 main에서 동작
- ✅ 시민 앱 3탭(신고/내 주변/조회) + 지도 + 사진 실저장 + 접수증 · 관리자 콘솔(토큰 게이트)
- ✅ 프로덕션 하드닝 — 관리자 상시 잠금·신고/공감 레이트리밋·보관기한 자동 삭제·데이터 영속화
- ✅ CI(테스트 113개+빌드)가 main 필수 체크 · 프론트는 main 머지 시 CloudFront 자동 배포
- ✅ 브랜치 정리 — `main` + **사람별 브랜치** 체계로 전환 (멘토 7/23 권장)

**남은 것 (4주차)**

| 이슈 | 내용 | 담당 |
|---|---|---|
| [#21](https://github.com/nxtcloud-edu/2026-07-kosj-industry-practice-team04/issues/21) | 고령 사용자 관점 점검 | FE |
| [#26](https://github.com/nxtcloud-edu/2026-07-kosj-industry-practice-team04/issues/26) | 안정화·시연 시나리오 | 전원 |
| [#31](https://github.com/nxtcloud-edu/2026-07-kosj-industry-practice-team04/issues/31) | 발표자료(Canva) | 전원 |
| [#32](https://github.com/nxtcloud-edu/2026-07-kosj-industry-practice-team04/issues/32) | 발표영상(10~15분) | 전원 |

추가 결정 대기: **Gemini API 키 연결**(무료, aistudio.google.com/apikey → `MOA_GEMINI_API_KEY`) · 백엔드 클라우드 배포 여부

## 1. 처음 왔다면 — 10분 안에 돌려보기

```bash
git clone https://github.com/nxtcloud-edu/2026-07-kosj-industry-practice-team04.git
cd 2026-07-kosj-industry-practice-team04

# 터미널 1
cd backend && npm start
# 터미널 2
cd frontend && npm install && npm run dev
```

- 시민 앱: http://localhost:5173 → 사진 촬영부터 접수증까지 눌러보기
- 관리자: http://localhost:5173/admin → **백엔드 콘솔에 출력된 `관리자 토큰(자동 생성)`** 입력
- 시연 동선: 신고 2건(같은 자리) → 유사 후보 '기존 문제에 추가' → 내 주변 탭 공감 → 관리자에서 우선순위·검수 큐 확인 → 상태 변경 → 시민 조회 링크에 반영

## 2. 작업 사이클 — 사람별 브랜치

멘토 권장(7/23)에 따라 **이슈별 브랜치 대신 자기 이름 브랜치 하나**를 씁니다.

```
① 내 브랜치로: git checkout sunghyun   (없으면 git checkout -b 이름 && git push -u origin 이름)
② 최신 main 반영: git pull origin main
③ 작업 → 커밋 (#이슈번호 포함, 작게 자주)
④ git push
⑤ 몫이 쌓이면 PR 생성 — 본문에 "Closes #N"
⑥ CI(테스트+빌드) 초록 확인 → 리뷰 요청 → Squash merge
⑦ 다음 작업도 같은 브랜치에서 ②부터
```

브랜치: `sunghyun`(김성현) · `jaeyong`(김재용) · `songeon`(심송언) · `dongjin`(가동진)

## 3. 우리 팀 규칙 — 5줄 요약

> 📌 **현재 운영 모드 (7/23~)**: 1인 개발 체제 — PR + **CI 통과가 유일한 머지 게이트**입니다.
> 리뷰 승인 요건은 일단 해제했고, 팀 협업이 재개되면 승인 1인 규칙을 복원합니다.

1. **main 직접 push 금지** — 사람별 브랜치 → PR → CI 통과 → Squash merge
2. **CI가 빨간 PR은 머지 불가** — 로컬에서 `cd backend && npm test` 먼저
3. 커밋·PR에 **이슈 번호** (`(#21)`, `Closes #21`) — 추적 가능한 사슬
4. PR은 작게 — 이슈 1~2개 몫 단위
5. **30분 이상 혼자 막히지 않기** — 슬랙에 상황 + `git status` + 에러 전문

## 4. 문서 지도

| 궁금한 것 | 문서 |
|---|---|
| 지금 뭐가 되는지·실행법 | [README](../README.md) |
| git 명령어 | [GIT_QUICKSTART.md](GIT_QUICKSTART.md) |
| 규칙의 이유 | [COLLABORATION.md](COLLABORATION.md) |
| API 스펙 (FE↔BE 기준) | [API_CONTRACT.md](API_CONTRACT.md) |
| 개인정보 처리 | [PRIVACY_POLICY.md](PRIVACY_POLICY.md) |
| 배포 | [DEPLOYMENT.md](DEPLOYMENT.md) |
| 진행 상황 | [칸반 보드](https://github.com/users/SungHyunC/projects/1) · [Issues](https://github.com/nxtcloud-edu/2026-07-kosj-industry-practice-team04/issues) |
| 왜 이 기능인가 | [입찰 제안서 PDF](2주차_입찰제안서_모아.pdf) 11p MVP ↔ 이슈 `mvp-N` 라벨 |
