import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useImageCompression, { formatFileSize } from '../../hooks/useImageCompression.js';
import './report.css';

const MAX_PHOTOS = 10;

/**
 * 사진 촬영 컴포넌트 (/report/camera)
 *
 * - 모바일 후면 카메라 호출 (capture="environment")
 * - 생활불편 신고용 촬영 가이드
 * - 선택 즉시 자동 압축 (PER-002, Issue #6)
 * - 최대 10장까지 다중 사진 등록
 * - 격자 미리보기 + 개별 삭제 / 전체 삭제
 * - URL.createObjectURL 사용 후 revokeObjectURL로 메모리 해제
 */
export default function CameraCapture() {
  const navigate = useNavigate();
  const inputRef = useRef(null);

  // 다중 파일 상태
  const [files, setFiles] = useState([]);
  const [previewUrls, setPreviewUrls] = useState([]);
  const [warning, setWarning] = useState('');
  // 압축 결과 누적 (원본/압축 후 용량 표시용)
  const [savedBytes, setSavedBytes] = useState({ before: 0, after: 0 });

  const { compressImages, isCompressing } = useImageCompression();

  // previewUrls 동기화: files 변경 시 objectURL 생성 및 이전 URL 해제
  useEffect(() => {
    // 이전 URL 모두 해제
    previewUrls.forEach((url) => URL.revokeObjectURL(url));

    // 새 URL 생성
    const newUrls = files.map((file) => URL.createObjectURL(file));
    setPreviewUrls(newUrls);

    // cleanup: 컴포넌트 언마운트 또는 files 변경 시 해제
    return () => {
      newUrls.forEach((url) => URL.revokeObjectURL(url));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [files]);

  // 파일 선택 핸들러 — 선택 즉시 자동 압축 후 등록 (Issue #6, PER-002)
  const handleFileChange = useCallback(
    async (e) => {
      const selected = Array.from(e.target.files || []);
      // input value 초기화 (같은 파일 재선택 가능) — 비동기 처리 전에 먼저 해둔다
      e.target.value = '';
      if (selected.length === 0) return;

      // 남은 자리만큼만 받는다
      const room = MAX_PHOTOS - files.length;
      if (room <= 0) {
        setWarning(`사진은 최대 ${MAX_PHOTOS}장까지 등록할 수 있습니다.`);
        return;
      }
      const accepted = selected.slice(0, room);
      setWarning(accepted.length < selected.length ? `사진은 최대 ${MAX_PHOTOS}장까지 등록할 수 있습니다.` : '');

      const { files: compressed, infos } = await compressImages(accepted);
      setFiles((prev) => [...prev, ...compressed]);
      setSavedBytes((prev) => ({
        before: prev.before + infos.reduce((n, i) => n + i.originalSize, 0),
        after: prev.after + infos.reduce((n, i) => n + i.compressedSize, 0),
      }));
    },
    [files.length, compressImages]
  );

  // 개별 삭제
  const handleDeleteOne = useCallback((index) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
    setWarning('');
  }, []);

  // 전체 삭제
  const handleDeleteAll = useCallback(() => {
    setFiles([]);
    setWarning('');
    setSavedBytes({ before: 0, after: 0 });
  }, []);

  // 카메라 열기
  const openCamera = useCallback(() => {
    if (files.length >= MAX_PHOTOS) {
      setWarning(`사진은 최대 ${MAX_PHOTOS}장까지 등록할 수 있습니다.`);
      return;
    }
    inputRef.current?.click();
  }, [files.length]);

  const hasPhotos = files.length > 0;
  const isFull = files.length >= MAX_PHOTOS;

  return (
    <div className="camera-page">
      {/* 헤더 */}
      <header className="camera-page__header">
        <button
          className="camera-page__back"
          onClick={() => navigate('/')}
          aria-label="뒤로 가기"
        >
          ←
        </button>
        <h2 className="camera-page__title">문제 상황 촬영</h2>
      </header>

      {/* 숨김 파일 입력 — 모바일 후면 카메라 호출 */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        className="camera-input-hidden"
        onChange={handleFileChange}
        aria-label="카메라로 사진 촬영"
      />

      {/* 압축 진행 / 결과 (Issue #6) */}
      {isCompressing && (
        <p className="camera-compressing" role="status">
          사진을 압축하는 중입니다…
        </p>
      )}
      {!isCompressing && savedBytes.before > 0 && (
        <p className="camera-compress-info">
          자동 압축 완료 · {formatFileSize(savedBytes.before)} → {formatFileSize(savedBytes.after)}
          {savedBytes.before > savedBytes.after &&
            ` (${Math.round((1 - savedBytes.after / savedBytes.before) * 100)}% 절감)`}
        </p>
      )}

      {/* 경고 메시지 */}
      {warning && (
        <p className="camera-warning" role="alert">
          {warning}
        </p>
      )}

      {hasPhotos ? (
        /* 미리보기 영역 */
        <section className="preview-section">
          {/* 카운터 */}
          <p className="preview-counter">
            {files.length} / {MAX_PHOTOS}장
          </p>

          {/* 격자 미리보기 */}
          <div className="preview-grid">
            {previewUrls.map((url, index) => (
              <div className="preview-grid__item" key={url}>
                <img
                  className="preview-grid__img"
                  src={url}
                  alt={`촬영 사진 ${index + 1}`}
                />
                <button
                  className="preview-grid__delete"
                  onClick={() => handleDeleteOne(index)}
                  aria-label={`사진 ${index + 1} 삭제`}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          {/* 액션 버튼들 */}
          <div className="preview-section__actions">
            <button
              className="preview-btn preview-btn--retake"
              onClick={openCamera}
              disabled={isFull}
            >
              사진 추가 촬영
            </button>
            <button
              className="preview-btn preview-btn--delete"
              onClick={handleDeleteAll}
            >
              전체 삭제
            </button>
          </div>

          {/* 다음 단계 — 위치 확인 (#7) */}
          <button
            className="camera-next-btn"
            onClick={() => navigate('/report/location')}
            disabled={isCompressing}
          >
            다음 · 위치 확인 →
          </button>
        </section>
      ) : (
        /* 촬영 가이드 */
        <div className="camera-guide">
          <div className="camera-guide__box">
            <span className="camera-guide__icon" aria-hidden="true">📷</span>
            <p>신고하려는 문제 상황이 잘 보이도록 여러 방향에서 촬영해주세요.</p>
            <ul className="camera-guide__tips">
              <li>문제 장소와 주변 환경이 함께 보이도록 촬영</li>
              <li>파손·위험·불편 요소를 가까이서 촬영</li>
              <li>전체 상황을 알 수 있도록 다른 방향에서도 촬영</li>
              <li>흔들리지 않게 촬영</li>
            </ul>
          </div>
          <button className="camera-capture-btn" onClick={openCamera}>
            카메라 열기
          </button>
        </div>
      )}
    </div>
  );
}
