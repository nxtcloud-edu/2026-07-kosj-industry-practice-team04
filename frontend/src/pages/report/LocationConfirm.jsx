import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useCurrentLocation from '../../hooks/useCurrentLocation.js';
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

  const handleNext = useCallback(() => {
    // TODO: 다음 단계로 이동 (신고 제출 등)
    // navigate('/report/submit');
    navigate('/');
  }, [navigate]);

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
        <h3 className="location-card__heading">위치정보 이용 안내</h3>
        <p className="location-card__desc">
          현재 위치를 사용하기 위해 위치 권한이 필요합니다.
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

      {/* 다음 버튼 */}
      <button
        className="location-next-btn"
        onClick={handleNext}
        disabled={!position}
      >
        다음
      </button>
    </div>
  );
}
