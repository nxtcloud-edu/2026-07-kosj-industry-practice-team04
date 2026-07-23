# 프론트엔드 배포

Issue #2는 Vite 프론트엔드를 비공개 S3와 CloudFront로 제공한다. PR은 AWS 자격 증명 없이 검증만 수행하며, `main`에서만 OIDC 단기 자격 증명으로 배포한다.

## AWS 사전 설정

1. 계정의 GitHub OIDC Provider를 확인한다. URL은 `https://token.actions.githubusercontent.com`, Client ID 목록은 `sts.amazonaws.com`을 포함해야 한다. 기존 Provider는 재생성하거나 CloudFormation으로 import하지 않는다.
2. PR 승인 후 IAM Identity Center 또는 기존 단기 세션으로 인증한다. 장기 Access Key는 만들거나 GitHub에 저장하지 않는다.
3. 승인된 PR commit의 템플릿을 검증하고 change set을 검토한다.

```bash
aws cloudformation validate-template \
  --region ap-northeast-2 \
  --template-body file://infra/frontend-hosting.yml

aws cloudformation create-change-set \
  --region ap-northeast-2 \
  --stack-name moa-frontend-hosting \
  --change-set-name issue2-<approved-pr-sha> \
  --change-set-type CREATE \
  --template-body file://infra/frontend-hosting.yml \
  --capabilities CAPABILITY_IAM \
  --parameters ParameterKey=GitHubOidcProviderArn,ParameterValue=<existing-provider-arn>
```

`aws cloudformation wait change-set-create-complete`와 `describe-change-set`으로 내용을 검토한 뒤, `execute-change-set`을 실행하고 stack 완료를 기다린다. 고정 RoleName을 사용하지 않으므로 `CAPABILITY_IAM`이면 충분하다.

## GitHub Variables

스택 출력값을 Repository Variables에 등록한다.

| 변수 | 값 |
| --- | --- |
| `AWS_REGION` | `ap-northeast-2` |
| `AWS_ROLE_ARN` | `GitHubDeployRoleArn` 출력값 |
| `S3_BUCKET_NAME` | `FrontendBucketName` 출력값 |
| `CLOUDFRONT_DISTRIBUTION_ID` | `CloudFrontDistributionId` 출력값 |
| `VITE_API_BASE_URL` | 선택 사항: `/api` 없는 HTTPS API origin |

`VITE_API_BASE_URL`이 비어 있으면 기존 상대 `/api/...` 요청을 유지한다. 이 경우 CloudFront는 정적 S3 origin만 제공하므로, 백엔드 미배포 상태에서는 API 요청이 403 또는 404가 되는 것이 정상이다. 실제 API 기능을 제공하는 배포에서는 HTTPS API origin을 `VITE_API_BASE_URL`로 설정하고, 백엔드 배포 작업에서 CloudFront origin에 대한 CORS를 허용해야 한다.

## 배포와 복구

- PR의 `validate` job은 빌드·전체 테스트·Function 테스트·산출물 검사·lint만 수행한다.
- `main` push는 assets를 먼저 업로드하고 index를 마지막에 업로드한 뒤 CloudFront invalidation과 smoke test를 실행한다.
- 첫 배포에서 `index.html`이 없어 `head-object`가 404를 반환하는 것은 정상이다. 이전 버전이 없으므로 자동 rollback은 하지 못한다.
- 이후 invalidation 또는 smoke test가 실패하면 이전 `index.html` S3 Version ID를 복원하고 다시 invalidation한다. workflow는 rollback 성공 여부와 관계없이 실패로 남는다.

실제 배포 상태는 GitHub Actions에서 확인한다. 백엔드가 아직 클라우드에 배포되지 않은 상태에서는 화면의 API 기능이 실패할 수 있다.
