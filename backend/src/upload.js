import crypto from 'node:crypto';

/**
 * Presigned URL 발급 서비스 (Issue #9 · PER-002)
 * ─────────────────────────────────────────────────────
 * 현재는 로컬 개발용 mock presigned URL을 반환한다.
 * 실제 배포 시에는 AWS S3 또는 GCS presigned URL로 교체한다.
 *
 * TODO: 실제 클라우드 스토리지 연결
 *   - AWS S3: @aws-sdk/s3-request-presigner 사용
 *   - GCS: @google-cloud/storage 사용
 *   - 환경변수 MOA_STORAGE=s3|gcs 로 분기
 */

const MOCK_BUCKET = 'moa-uploads-dev';
const MOCK_REGION = 'ap-northeast-2';
const URL_EXPIRY_SECONDS = 600; // 10분

/**
 * presigned URL 발급 (mock)
 * @param {{ filename: string, contentType: string }} params
 * @returns {{ uploadUrl: string, fileKey: string, expiresIn: number }}
 */
export function generatePresignedUrl({ filename, contentType }) {
  // TODO: 실제 S3 presigned PUT URL 생성으로 교체
  // const command = new PutObjectCommand({ Bucket, Key, ContentType });
  // const url = await getSignedUrl(s3Client, command, { expiresIn: URL_EXPIRY_SECONDS });

  const ext = filename.split('.').pop() || 'jpg';
  const uniqueId = crypto.randomUUID();
  const datePrefix = new Date().toISOString().slice(0, 10).replace(/-/g, '/');
  const fileKey = `reports/${datePrefix}/${uniqueId}.${ext}`;

  // Mock URL — 실제 업로드 엔드포인트가 아님
  const uploadUrl = `https://${MOCK_BUCKET}.s3.${MOCK_REGION}.amazonaws.com/${fileKey}?` +
    `X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Expires=${URL_EXPIRY_SECONDS}&` +
    `Content-Type=${encodeURIComponent(contentType)}&` +
    `X-Mock-Token=${uniqueId}`;

  // 업로드 완료 후 클라이언트가 저장할 public URL
  const publicUrl = `https://${MOCK_BUCKET}.s3.${MOCK_REGION}.amazonaws.com/${fileKey}`;

  return {
    uploadUrl,
    publicUrl,
    fileKey,
    expiresIn: URL_EXPIRY_SECONDS,
  };
}
