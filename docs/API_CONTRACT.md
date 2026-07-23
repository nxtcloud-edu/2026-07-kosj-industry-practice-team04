# 「모아」 API 계약 v1

프론트·백엔드가 **이 문서를 기준으로** 구현합니다. 변경이 필요하면 이 문서를 고치는 PR을 먼저 올리고 팀 합의 후 코드에 반영하세요.

> 배경: 관리자 콘솔(#24)·AI 분류기(#10)가 이미 main에 머지돼 특정 경로·형태를 호출하고 있고, 신고 접수 API(PR #37)는 다른 경로로 구현되어 서로 연결되지 않는 상태입니다. 이 문서가 그 기준선입니다.

---

## 0. 기본 규칙

| 항목 | 값 |
|---|---|
| 백엔드 포트 | **4000** (`frontend/vite.config.js` 프록시가 `/api`·`/uploads` → `:4000`, main 머지 완료) |
| 형식 | 요청·응답 모두 JSON (UTF-8) |
| 프론트 호출 | **반드시 `frontend/src/api.js` 경유** — 컴포넌트에서 `fetch` 직접 호출 금지 |
| 사진 URL | 로컬 개발은 `/uploads/xxx.jpg`(상대), S3 연동 후엔 절대 URL — 양쪽 모두 허용 |

## 1. 응답 형태 규약

**성공**
```json
{ "success": true, "data": { ... } }
```
**실패** (4xx/5xx)
```json
{ "success": false, "errors": [ { "field": "latitude", "message": "위도는 필수입니다." } ] }
```

**잘못된 JSON**

요청 본문이 JSON 문법에 맞지 않으면 HTTP `400`을 반환한다.

```json
{
  "success": false,
  "errors": [
    { "field": "body", "message": "잘못된 JSON 형식입니다." }
  ]
}
```

빈 요청 본문은 `{}`로 파싱한 뒤 각 API의 필수 필드 검증 결과를 반환한다.

**예상하지 못한 서버 오류**

내부 오류 정보는 공개하지 않고 HTTP `500`과 고정된 메시지만 반환한다.

```json
{
  "success": false,
  "errors": [
    { "field": "server", "message": "서버 내부 오류" }
  ]
}
```

- PR #37의 필드 단위 검증 에러 구조를 채택합니다(폼 UX에 유리).
- `api.js`가 `data`를 벗겨 컴포넌트에 넘기고, 실패 시 `errors`의 message를 합쳐 `Error`로 throw 합니다 → **컴포넌트 코드는 수정 불필요**.

```js
// api.js 수정분 (이 계약에 맞춘 형태)
const body = await res.json().catch(() => ({}));
if (!res.ok || body.success === false) {
  throw new Error((body.errors || []).map((e) => e.message).join(' / ') || `요청 실패 (${res.status})`);
}
return body.data ?? body;
```

## 2. 시민 API

| # | 메서드·경로 | 요청 | 응답 data | 담당 이슈 |
|---|---|---|---|---|
| 1 | `POST /api/uploads/presign` | `{filename, contentType, fileSize?}` | `{uploadUrl, publicUrl, fileKey, expiresIn}` | #9·#55 |
| 1-1 | `PUT {uploadUrl}` (= `/uploads/:fileKey?exp=&sig=`) | 사진 바이트 (본문 그대로, ≤10MB) | `201 {publicUrl}` — 서명 틀리면 403, 재업로드 409 | #55 |
| 1-2 | `GET /uploads/:fileKey` | — | 이미지 바이트 (`Cache-Control: immutable`) — 없으면 404 | #55 |
| 2 | `POST /api/analyze` | `{photo(dataURL) 또는 photoUrl, filename?}` | `{type, confidence, needsReview, engine}` — engine: `gemini`\|`mock` | #10·#11 |
| 3 | `GET /api/issues/nearby?lat=&lng=&type=` | — | `{params, candidates:[{...issueSummary, distance}]}` | #13·#14 |
| 3-1 | `GET /api/issues/map?lat=&lng=&radiusM=` | — | `{issues:[{id,type,status,statusIndex,priorityLabel,reportCount,empathy,lat,lng,address,createdAt,distance}]}` — **사진·개인정보 없음** | 내 주변 탭 |
| 4 | `POST /api/reports` | 아래 참조 | `201 {receiptNo, viewToken, statusPath, issue, merged}` | #9 |
| 5 | `GET /api/status/:receiptNo?token=` | — | `{report:{receiptNo,status,createdAt}, issue?:{...issueSummary, history, statusFlow}}` | #22·#23·#34 |
| 6 | `POST /api/issues/:id/empathy` | `{deviceId}` | `{count, added, priority}` — 같은 IP가 같은 문제에 1시간 내 재요청 시 **429** | #15·#58 |

**신고 접수 요청 본문 (4번)** — 현재 구현 기준 (PR #37·#43)
```json
{
  "photos": ["https://.../reports/2026/07/22/xxx.jpg"],
  "latitude": 36.48012, "longitude": 127.28901,
  "address": "세종특별자치시 도움6로 24 인근",
  "locationConsent": true,
  "contact": "010-0000-0000",
  "deviceId": "uuid-...",
  "attachIssueId": "is_xxx"
}
```
- `locationConsent`(필수, SER-001) 없거나 `true`가 아니면 **400**. 동의 사실은 `consent: { location, agreedAt }` 으로 신고에 저장된다
- `photos`는 presign으로 받은 `publicUrl` 배열. **1장 vs 여러 장은 7장 미결정 사항** — 1장으로 정해지면 `photoUrl` 단수로 바꾼다
- `type`·`confidence`는 분류 API(#10·#11) 연동 시 추가 예정
- `attachIssueId` 있으면 기존 대표 문제에 통합 → 응답 `merged: true`
- `contact`는 처리 알림을 희망해 직접 입력한 경우에만 보내는 선택값이다(SER-003). 서버는 `010-0000-0000` 또는 `01000000000` 형식만 저장하며, 미입력 신고에는 연락처 필드를 만들지 않는다
- 시간당 신고 5건 초과 시 **429**

**흐름**: ① presign 받아 사진 업로드 → ② `/api/analyze`로 유형·신뢰도 표시 → ③ `/api/issues/nearby`로 유사 신고 후보 제시(선택) → ④ `/api/reports` 접수 → ⑤ `statusPath`로 조회

## 3. 관리자 API — **경로 확정 (main 머지 완료, 변경 불가)**

`frontend/src/api.js` + 관리자 콘솔이 이미 이 경로를 호출합니다.

| 메서드·경로 | 요청 | 응답 data |
|---|---|---|
| `GET /api/admin/issues?sort=priority\|recent&queue=review&status=` | — | `{params, issues:[issueSummary]}` |
| `GET /api/admin/issues/:id` | — | `{...issueSummary, history, statusFlow, reports:[report]}` |
| `PATCH /api/admin/reports/:id` | `{type}` 또는 `{spam}` | `{report, issue, warning?}` |
| `POST /api/admin/issues/:id/split` | `{reportId, reason}` | `{original, created}` |
| `PATCH /api/admin/issues/:id` | `{status}` | `issueSummary` |
| `GET /api/admin/stats` | — | `{total, byStatus, reviewQueue, reports, splits}` |

## 4. 데이터 모델

**issueSummary** (대표 문제)
```json
{
  "id": "is_xxx", "type": "도로 파손",
  "address": "세종특별자치시 도움6로 24 인근", "lat": 36.48, "lng": 127.28,
  "dept": "도로관리부", "status": "접수", "statusIndex": 0,
  "priority": 10, "priorityLabel": "높음",
  "reportCount": 2, "empathy": 3, "needsReview": false,
  "thumbnail": "/uploads/xx.jpg", "createdAt": "…", "lastReportAt": "…"
}
```

**report** (개별 신고)
```json
{
  "id": "rp_xxx", "receiptNo": "SJ-2026-0722-0001",
  "photoUrl": "…", "address": "…", "lat": 36.48, "lng": 127.28,
  "type": "도로 파손", "confidence": 0.87, "spam": false, "createdAt": "…"
}
```

시민 상태 조회의 `report`는 최소 공개 형태인 `receiptNo`, `status`, `createdAt`만 포함한다. 내부 신고 모델의 사진·위치·연락처와 조회 토큰 해시는 관리자 권한이 없는 상태 조회 응답에 포함하지 않는다.

**공통 상수**

| 항목 | 값 |
|---|---|
| 유형 | `도로 파손` · `가로등 고장` · `쓰레기 무단투기` · `기타` (`backend/src/types.js`) |
| 상태 흐름 | **`접수 → 배정 → 처리중 → 완료`** (다른 라벨 사용 금지) |
| 부서 매핑 | 도로→도로관리부 · 가로등→시설관리부 · 쓰레기→환경관리부 · 기타→민원총괄팀 |
| 우선순위 | `유형 위험도(도로5/가로등3/쓰레기2/기타1) + 신고 건수 + 공감 수(상한 5, #58)` |
| 우선순위 라벨 | ≥8 `높음` · ≥5 `보통` · 그 외 `낮음` |
| 검수 큐 | `confidence < 0.7` → `needsReview: true` |
| 유사 통합 | 반경 50m · 동일 유형 · 72시간 (운영 설정값) |

## 5. 보안 규칙 (비협상)

1. **상태 조회는 접수번호 + 토큰 둘 다 필수.** 토큰이 **없으면 403** (있는데 틀려도 403).
   → 토큰이 없을 때 통과시키면 접수번호 열거로 타인의 사진·GPS가 노출됩니다 (SER-003, 제안서 6p).
   접수번호는 `MOA-YYYYMMDD-XXXXX`, 조회 토큰은 발급 응답의 32자리 소문자 hex 값만 허용하며 형식 오류도 403으로 처리합니다.
2. **위치정보 동의**(`locationConsent`) 없이는 신고 접수 불가, 동의 사실을 신고 데이터에 기록 (SER-001).
3. **기기당 시간당 신고 5건 제한** (익명 신고 악용 방지).
4. 조회 토큰에는 개인정보를 넣지 않습니다(난수).
5. 조회 토큰 원문은 접수 응답에서 한 번만 전달하고 저장소에는 SHA-256 해시만 보관합니다.
6. 없는 접수번호와 틀린 조회 토큰은 모두 **403**으로 응답해 접수번호 존재 여부를 숨깁니다.
7. 상태 조회 응답은 `Cache-Control: no-store`, `Referrer-Policy: no-referrer`를 사용하고 사진·위치·연락처를 반환하지 않습니다.
8. **관리자 API 인증 (#56)** — 배포 환경에서는 `MOA_ADMIN_TOKEN`을 설정하고 `/api/admin/*` 요청에 `Authorization: Bearer <토큰>`을 요구합니다(불일치·누락 401). env 미설정 시(로컬 데모) 기존처럼 열립니다. CORS는 `MOA_ALLOWED_ORIGIN` 설정 시 해당 origin으로 제한합니다.
9. **요청 본문 상한 (#57)** — 기본 15MB(`MOA_MAX_BODY_BYTES`), 초과 시 **413**. 업로드 PUT은 10MB.
10. **공감 남용 방지 (#58)** — 같은 IP는 같은 문제에 1시간(`MOA_EMPATHY_WINDOW_MS`)당 1회(429), 우선순위 산식의 공감 기여는 최대 +5(`MOA_EMPATHY_CAP`).
11. **업로드 쓰기 보호 (#55)** — `PUT /uploads/:fileKey`는 presign이 발급한 `exp`·`sig`(HMAC) 검증을 통과해야 하며, 같은 키 재업로드는 409로 거절합니다. GET은 UUID 키를 아는 쪽만 접근합니다(신고·관리자 응답 외 목록 API 없음).

사진·위치·연락처의 보관 및 삭제 기준은 [PRIVACY_POLICY.md](PRIVACY_POLICY.md)를 따릅니다.

## 6. PR #37 정렬 가이드

| 현재 (PR #37) | 계약 | 조치 |
|---|---|---|
| 포트 `3000` | **`4000`** | 기본값 변경 |
| `POST /api/upload/presigned` | `POST /api/uploads/presign` | 경로 변경 |
| `GET /api/reports/:receiptNo?token=` | `GET /api/status/:receiptNo?token=` | 경로 변경 (api.js가 이 경로 호출) |
| `if (token && ...)` | 토큰 없으면 403 | **보안 수정 필수** |
| `photos: string[]` | `photoUrl: string` | 7장 결정 후 반영 |
| 상태 `received/processing/resolved` | `접수/배정/처리중/완료` | 라벨 통일 |
| `/api/admin/*` 없음 | 6개 엔드포인트 | 관리자 콘솔 연결용 추가 필요 |
| 응답 `{success, data}` | 동일 | **유지** (api.js가 맞춤) |
| 필드 단위 `errors[]` | 동일 | **유지** 👍 |

## 7. 미결정 — 팀 합의 필요 ⚠️

**사진 1장 vs 여러 장**

| | 1장 (제안서·분류기·관리자 기준) | 최대 10장 (PR #35·#37 구현) |
|---|---|---|
| 근거 | "사진 한 장으로 3단계 신고" 핵심 메시지, 입력 최소화(접근성) | 다양한 각도로 상황 전달, 파인튜닝 데이터 확보 |
| 영향 | 현재 머지된 분류기·관리자 콘솔과 그대로 맞음 | `/api/analyze`·`issueSummary.thumbnail`·관리자 사진 비교 UI 수정 필요 |
| 제안서상 위치 | MVP | 로드맵(별도 동의 기반 추가 사진 참여 프로그램) |

→ **스탠드업에서 결정 후 이 문서에 확정 표기**하고, 결정 전까지 `photoUrl`(1장) 기준으로 진행합니다.

---

관련 문서: [PRIVACY_POLICY.md](PRIVACY_POLICY.md) · [INTEGRATION_NOTES.md](INTEGRATION_NOTES.md) · [BACKLOG.md](BACKLOG.md) · [COLLABORATION.md](COLLABORATION.md)
