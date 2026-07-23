import { useCallback, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import useCurrentLocation from '../../hooks/useCurrentLocation.js';
import { addEmpathy, createReport, nearbyIssues, presignUpload, uploadPhoto } from '../../api.js';
import { getDeviceId } from '../../deviceId.js';
import { clearDraft, getDraft, getDraftFiles } from '../../reportDraft.js';
import MoaMap from '../../components/MoaMap.jsx';
import './report.css';

/**
 * 위치 확인 화면 (/report/location)
 * — SER-001(위치정보 동의) · SIR-002(지도) · Issue #55(사진 실업로드)
 *
 * 1. 위치정보 수집 동의
 * 2. 현재 위치 가져오기 (Geolocation API)
 * 3. 지도에서 핀을 드래그해 위치 보정 (Leaflet + OSM, 멘토 피드백 7/23)
 * 4. 사진 실제 업로드(presign → PUT) 후 유사 신고 후보 제시 → 접수
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
  const [empathyBusy, setEmpathyBusy] = useState(null);
  const [empathized, setEmpathized] = useState(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem('moa-empathized-issues'));
      return Array.isArray(saved) ? saved : [];
    } catch {
      return [];
    }
  });

  const draft = getDraft();
  const draftFiles = getDraftFiles();
  // 새로고침으로 File 객체가 날아간 경우 — 메타만 남아 있으면 재촬영을 안내한다.
  const filesMissing = draft.photos.length > 0 && draftFiles.length !== draft.photos.length;

  // TODO: 역지오코딩 API(카카오 로컬 등) 연동 시 실제 주소로 교체
  const addressLabel = position
    ? `핀 위치 기준 (위도 ${position.latitude.toFixed(5)}, 경도 ${position.longitude.toFixed(5)})`
    : null;

  const handleAgreeChange = useCallback((e) => {
    setAgreed(e.target.checked);
  }, []);

  const handleGetLocation = useCallback(() => {
    getCurrentPosition();
  }, [getCurrentPosition]);

  // 지도 핀 드래그 → 신고 위치 보정
  const handlePinMove = useCallback((next) => {
    setPosition(next);
  }, [setPosition]);

  // 사진을 실제로 올린 뒤(#55) 유사 신고 후보를 먼저 제시한다 (Issue #14).
  const handleNext = useCallback(async () => {
    if (!position || !agreed || submitting) return;
    setSubmitting(true);
    setSubmitError('');

    try {
      // ① presign 발급 → ② 압축된 사진 바이트를 PUT 업로드 → ③ publicUrl 첨부
      const files = getDraftFiles();
      const uploaded = [];
      for (const file of files) {
        const { uploadUrl, publicUrl } = await presignUpload({
          filename: file.name,
          contentType: file.type,
          fileSize: file.size,
        });
        await uploadPhoto(uploadUrl, file);
        uploaded.push(publicUrl);
      }

      setPhotoUrls(uploaded);

      // 촬영 단계의 AI 분류 결과(#10·#11)를 그대로 사용한다. 분류가 없으면 '기타'.
      const reportType = getDraft().analysis?.type ?? '기타';
      try {
        const result = await nearbyIssues(position.latitude, position.longitude, reportType);
        setCandidates(result.candidates ?? []);
      } catch {
        // 후보 조회 장애가 새 신고 자체를 막아서는 안 된다.
        setCandidates([]);
        setSubmitError('유사 신고를 확인하지 못했습니다. 새 신고로는 계속 접수할 수 있습니다.');
      }
      setSubmitting(false);
    } catch (e) {
      setSubmitError(e.message || '사진 업로드에 실패했습니다. 잠시 후 다시 시도해 주세요.');
      setSubmitting(false);
    }
  }, [position, agreed, submitting]);

  const submitChoice = useCallback(async (attachIssueId = null) => {
    if (!position || !agreed || submitting) return;
    setSubmitting(true);
    setSubmitError('');

    try {
      // AI 분류 결과(#10·#11)를 함께 보내 대표 문제의 유형·부서·검수 큐 판정에 쓰이게 한다.
      const { analysis } = getDraft();

      const { receiptNo, viewToken, merged } = await createReport({
        photos: photoUrls,
        latitude: position.latitude,
        longitude: position.longitude,
        address: addressLabel,
        locationConsent: agreed,
        ...(analysis ? { type: analysis.type, confidence: analysis.confidence } : {}),
        ...(attachIssueId ? { attachIssueId } : {}),
      });

      clearDraft();
      navigate('/report/complete', { state: { receiptNo, viewToken, merged } });
    } catch (e) {
      setSubmitError(e.message || '신고 접수에 실패했습니다. 잠시 후 다시 시도해 주세요.');
      setSubmitting(false);
    }
  }, [position, agreed, submitting, photoUrls, addressLabel, navigate]);

  const handleEmpathy = useCallback(async (issueId) => {
    if (empathyBusy || empathized.includes(issueId)) return;
    setEmpathyBusy(issueId);
    setSubmitError('');

    try {
      const result = await addEmpathy(issueId, getDeviceId());
      setCandidates((current) => current.map((candidate) =>
        candidate.id === issueId ? { ...candidate, empathy: result.count } : candidate
      ));
      const next = [...empathized, issueId];
      setEmpathized(next);
      window.localStorage.setItem('moa-empathized-issues', JSON.stringify(next));
    } catch (e) {
      setSubmitError(e.status === 429
        ? '잠시 후 다시 공감할 수 있습니다.'
        : (e.message || '공감을 추가하지 못했습니다. 잠시 후 다시 시도해 주세요.'));
    } finally {
      setEmpathyBusy(null);
    }
  }, [empathyBusy, empathized]);

  return (
    <div className="location-page">
      {/* 헤더 */}
      <header className="flow-head">
        <button
          className="flow-head__back"
          onClick={() => navigate(-1)}
          aria-label="뒤로 가기"
        >
          ←
        </button>
        <h2 className="flow-head__title">위치 확인</h2>
        <span className="flow-head__step" aria-label="3단계 중 2단계">2 / 3</span>
      </header>

      {filesMissing && (
        <div className="notice warn" role="alert">
          화면이 새로 열려 촬영한 사진이 비워졌어요.{' '}
          <Link to="/report/camera" className="notice__link">다시 촬영하러 가기</Link>
        </div>
      )}

      {/* 위치정보 안내 카드 */}
      <section className="location-card">
        <h3 className="location-card__heading">위치정보 수집·이용 안내</h3>

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
            <dd>처리 완료 후 6개월, 이후 자동 파기·비식별 처리</dd>
          </div>
        </dl>

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

      {/* 지도 — 핀을 드래그해 위치 보정 (SIR-002) */}
      {position ? (
        <section className="location-map-card">
          <MoaMap
            center={position}
            picker
            onMove={handlePinMove}
            ariaLabel="신고 위치 지도 — 핀을 드래그해 위치를 조정할 수 있습니다"
          />
          <p className="location-map-hint">🧭 핀을 끌어서 정확한 위치로 맞춰주세요</p>
        </section>
      ) : (
        <section className="location-map-empty" aria-hidden="true">
          <span>동의 후 위치를 가져오면 지도가 표시됩니다</span>
        </section>
      )}

      {/* 선택된 위치 정보 */}
      {position && (
        <section className="location-info-card">
          <dl className="location-info-card__list">
            <div className="location-info-card__row">
              <dt>좌표</dt>
              <dd>{position.latitude.toFixed(6)}, {position.longitude.toFixed(6)}</dd>
            </div>
            <div className="location-info-card__row">
              <dt>주소</dt>
              {/* TODO: 역지오코딩 API 연동 후 실제 주소 표시 */}
              <dd>{addressLabel}</dd>
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
          className="btn-primary location-next-btn"
          onClick={handleNext}
          disabled={!position || !agreed || submitting || filesMissing}
        >
          {submitting ? '사진 올리는 중…' : '이 위치로 신고하기'}
        </button>
      ) : (
        <section className="similar-choice" aria-labelledby="similar-choice-title">
          <h3 id="similar-choice-title">주변에 비슷한 신고가 있나요?</h3>
          <p>같은 문제라면 기존 문제에 추가해 담당자가 한 번에 확인할 수 있어요.</p>

          {candidates.length > 0 ? (
            <div className="similar-choice__list">
              {candidates.map((candidate) => (
                <article className="similar-choice__card" key={candidate.id}>
                  <div className="similar-choice__content">
                    <strong>{candidate.type}</strong>
                    <span>{candidate.address}</span>
                    <small>
                      약 {Math.round(candidate.distance ?? 0)}m · 신고 {candidate.reportCount ?? 1}건 · 공감 {candidate.empathy ?? 0}명 · {candidate.status}
                    </small>
                    <button
                      type="button"
                      className="similar-choice__empathy"
                      aria-pressed={empathized.includes(candidate.id)}
                      onClick={() => handleEmpathy(candidate.id)}
                      disabled={empathyBusy === candidate.id || empathized.includes(candidate.id)}
                    >
                      {empathized.includes(candidate.id)
                        ? '✓ 공감했어요'
                        : empathyBusy === candidate.id ? '추가 중…' : '🙋 나도 불편해요'}
                    </button>
                    <button
                      type="button"
                      className="similar-choice__attach"
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
