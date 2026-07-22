import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useCurrentLocation from '../../hooks/useCurrentLocation.js';
import { createReport, nearbyIssues, presignUpload } from '../../api.js';
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
  const [photoUrls, setPhotoUrls] = useState([]);
  const [candidates, setCandidates] = useState(null);

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

  // 위치·사진을 준비한 뒤 유사 신고 후보를 먼저 제시한다 (Issue #14).
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

      setPhotoUrls(photoUrls);

      // 이미지 분류 연동 전에는 '기타'로 조회한다. 분류 결과가 draft에 추가되면
      // 해당 유형을 넘기도록 교체한다.
      try {
        const result = await nearbyIssues(position.latitude, position.longitude, '기타');
        setCandidates(result.candidates ?? []);
      } catch {
        // 후보 조회 장애가 새 신고 자체를 막아서는 안 된다.
        setCandidates([]);
        setSubmitError('유사 신고를 확인하지 못했습니다. 새 신고로는 계속 접수할 수 있습니다.');
      }
      setSubmitting(false);
    } catch (e) {
      setSubmitError(e.message || '신고 접수에 실패했습니다. 잠시 후 다시 시도해 주세요.');
      setSubmitting(false);
    }
  }, [position, agreed, submitting, addressPlaceholder, navigate]);

  const submitChoice = useCallback(async (attachIssueId = null) => {
    if (!position || !agreed || submitting) return;
    setSubmitting(true);
    setSubmitError('');

    try {
      const { receiptNo, viewToken, merged } = await createReport({
        photos: photoUrls,
        latitude: position.latitude,
        longitude: position.longitude,
        address: addressPlaceholder,
        locationConsent: agreed,
        ...(attachIssueId ? { attachIssueId } : {}),
      });

      clearDraft();
      navigate('/report/complete', { state: { receiptNo, viewToken, merged } });
    } catch (e) {
      setSubmitError(e.message || '신고 접수에 실패했습니다. 잠시 후 다시 시도해 주세요.');
      setSubmitting(false);
    }
  }, [position, agreed, submitting, photoUrls, addressPlaceholder, navigate]);

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

      {candidates === null ? (
        <button
          className="location-next-btn"
          onClick={handleNext}
          disabled={!position || !agreed || submitting}
        >
          {submitting ? '유사 신고 확인 중…' : '이 위치로 신고하기'}
        </button>
      ) : (
        <section className="similar-choice" aria-labelledby="similar-choice-title">
          <h3 id="similar-choice-title">주변에 비슷한 신고가 있나요?</h3>
          <p>같은 문제라면 기존 문제에 추가해 담당자가 한 번에 확인할 수 있어요.</p>

          {candidates.length > 0 ? (
            <div className="similar-choice__list">
              {candidates.map((candidate) => (
                <article className="similar-choice__card" key={candidate.id}>
                  {candidate.thumbnail && (
                    <img src={candidate.thumbnail} alt="" className="similar-choice__thumb" />
                  )}
                  <div className="similar-choice__content">
                    <strong>{candidate.type}</strong>
                    <span>{candidate.address}</span>
                    <small>
                      약 {Math.round(candidate.distance ?? 0)}m · 신고 {candidate.reportCount ?? 1}건 · {candidate.status}
                    </small>
                    <button
                      type="button"
                      onClick={() => submitChoice(candidate.id)}
                      disabled={submitting}
                    >
                      기존 문제에 추가
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="similar-choice__empty">반경 50m 안에 같은 유형의 신고가 없습니다.</p>
          )}

          <button
            type="button"
            className="similar-choice__new"
            onClick={() => submitChoice()}
            disabled={submitting}
          >
            {submitting ? '접수 중…' : '새 신고로 접수'}
          </button>
        </section>
      )}
    </div>
  );
}
