import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useCurrentLocation from '../../hooks/useCurrentLocation.js';
import { createReport, presignUpload } from '../../api.js';
import { clearDraft, getDraft } from '../../reportDraft.js';
import './report.css';

/**
 * 위치 확인 화면 (/report/location) — SER-001(위치정보 동의) · SIR-002(지도 API 연계)
 *
 * 1. 위치정보 수집 동의
 * 2. 현재 위치 가져오기 (Geolocation API)
 * 3. 지도 Placeholder (향후 Kakao/Naver Map 연동 대비)
 * 4. 행정구역 표시 (현재는 위도/경도 + TODO 주석)
 */
export default function LocationConfirm() {
  const navigate = useNavigate();
  const { position, isLoading, error, getCurrentPosition, setPosition } =
    useCurrentLocation();

  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // TODO: 실제 주소 API(카카오 로컬, 행정안전부 등) 연동 시 이 함수 교체
  const addressPlaceholder = position
    ? `위도 ${position.latitude.toFixed(6)}, 경도 ${position.longitude.toFixed(6)} (주소 API 연동 예정)`
    : null;

  const handleAgreeChange = useCallback((e) => {
    setAgreed(e.target.checked);
  }, []);

  const handleGetLocation = useCallback(() => {
    getCurrentPosition();
  }, [getCurrentPosition]);

  // 지도에서 위치 변경 시뮬레이션 (Placeholder용)
  const handleMapClick = useCallback(
    (e) => {
      // 실제 지도 API 연동 시 이벤트에서 좌표를 추출
      // 현재는 Placeholder이므로 동작하지 않음
      void e;
      void setPosition;
    },
    [setPosition]
  );

  // 신고 접수 — 동의 사실을 함께 전송해 서버에 기록한다 (SER-001, Issue #33)
  const handleNext = useCallback(async () => {
    if (!position || !agreed || submitting) return;
    setSubmitting(true);
    setSubmitError('');

    try {
      // ① 사진 업로드용 presigned URL 발급 → publicUrl을 신고에 첨부
      //    (실제 바이너리 업로드는 S3 연동 시 이 사이에 들어간다 — upload.js 참고)
      const { photos: metas } = getDraft();
      const photoUrls = [];
      for (const meta of metas) {
        const { publicUrl } = await presignUpload({
          filename: meta.name,
          contentType: meta.type,
          fileSize: meta.size,
        });
        photoUrls.push(publicUrl);
      }

      // ② 신고 접수 — locationConsent 없이는 서버가 400으로 거부한다
      const { receiptNo, viewToken } = await createReport({
        photos: photoUrls,
        latitude: position.latitude,
        longitude: position.longitude,
        address: addressPlaceholder,
        locationConsent: agreed,
      });

      clearDraft();
      navigate('/report/complete', { state: { receiptNo, viewToken } });
    } catch (e) {
      setSubmitError(e.message || '신고 접수에 실패했습니다. 잠시 후 다시 시도해 주세요.');
      setSubmitting(false);
    }
  }, [position, agreed, submitting, addressPlaceholder, navigate]);

  return (
    <div className="location-page">
      {/* 헤더 */}
      <header className="location-page__header">
        <button
          className="location-page__back"
          onClick={() => navigate(-1)}
          aria-label="뒤로 가기"
        >
          &larr;
        </button>
        <h2 className="location-page__title">위치 확인</h2>
      </header>

      {/* 위치정보 안내 카드 */}
      <section className="location-card">
        <h3 className="location-card__heading">위치정보 수집·이용 안내</h3>
        <p className="location-card__desc">
          현재 위치를 사용하기 위해 위치 권한이 필요합니다.
        </p>

        {/* 수집 목적·항목·보관 기간 고지 (SER-001) */}
        <dl className="consent-notice">
          <div>
            <dt>수집 목적</dt>
            <dd>신고 접수·처리 및 담당 부서 배정, 유사 신고 통합</dd>
          </div>
          <div>
            <dt>수집 항목</dt>
            <dd>신고 위치(위도·경도), 신고 사진</dd>
          </div>
          <div>
            <dt>보관 기간</dt>
            <dd>처리 완료 후 6개월, 이후 파기 또는 비식별 처리</dd>
          </div>
        </dl>
        <p className="consent-notice__hint">
          동의하지 않으면 위치 기반 신고를 접수할 수 없습니다.
        </p>

        {/* 동의 체크박스 */}
        <label className="location-agree">
          <input
            type="checkbox"
            className="location-agree__checkbox"
            checked={agreed}
            onChange={handleAgreeChange}
          />
          <span className="location-agree__text">
            개인정보 및 위치정보 수집·이용에 동의합니다.
          </span>
        </label>

        {/* 현재 위치 가져오기 버튼 */}
        <button
          className="location-btn"
          onClick={handleGetLocation}
          disabled={!agreed || isLoading}
        >
          {isLoading ? (
            <>
              <span className="spinner spinner--sm" aria-hidden="true" />
              위치를 가져오는 중...
            </>
          ) : (
            '📍 현재 위치 가져오기'
          )}
        </button>

        {/* 에러 메시지 */}
        {error && (
          <p className="location-error" role="alert">
            {error}
          </p>
        )}
      </section>

      {/* 지도 영역 (Placeholder) */}
      <section
        className="location-map-placeholder"
        onClick={handleMapClick}
        role="application"
        aria-label="지도 영역 (Placeholder)"
      >
        <p className="location-map-placeholder__text">
          {position
            ? `📍 ${position.latitude.toFixed(4)}, ${position.longitude.toFixed(4)}`
            : '지도가 여기에 표시됩니다'}
        </p>
        <span className="location-map-placeholder__hint">
          {/* TODO: Kakao Map 또는 Naver Map API 연동 */}
          향후 지도 API를 연결하면 이 영역에 지도가 표시됩니다.
          <br />
          지도에서 위치를 탭하여 수정할 수 있습니다.
        </span>
      </section>

      {/* 선택된 위치 정보 카드 */}
      {position && (
        <section className="location-info-card">
          <h4 className="location-info-card__heading">선택된 위치</h4>
          <dl className="location-info-card__list">
            <div className="location-info-card__row">
              <dt>위도</dt>
              <dd>{position.latitude.toFixed(6)}</dd>
            </div>
            <div className="location-info-card__row">
              <dt>경도</dt>
              <dd>{position.longitude.toFixed(6)}</dd>
            </div>
            <div className="location-info-card__row">
              <dt>주소</dt>
              {/* TODO: 역지오코딩 API 연동 후 실제 주소 표시 */}
              <dd>{addressPlaceholder}</dd>
            </div>
          </dl>
        </section>
      )}

      {/* 접수 실패 안내 */}
      {submitError && (
        <p className="location-error" role="alert">
          {submitError}
        </p>
      )}

      {/* 신고 접수 */}
      <button
        className="location-next-btn"
        onClick={handleNext}
        disabled={!position || !agreed || submitting}
      >
        {submitting ? '접수 중…' : '이 위치로 신고하기'}
      </button>
    </div>
  );
}
