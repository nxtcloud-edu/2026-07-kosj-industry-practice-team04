import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useImageCompression, { formatFileSize } from '../../hooks/useImageCompression.js';
import './report.css';

/**
 * 이미지 압축 화면 (/report/compress) — Issue #6
 *
 * - 이미지 선택 시 자동 압축 (browser-image-compression)
 * - 원본 크기, 압축 후 크기, 압축률(%) 표시
 * - 압축된 이미지 미리보기
 * - 기존 신고 화면 흐름에 연결 가능
 */
export default function ImageCompressor() {
  const navigate = useNavigate();
  const inputRef = useRef(null);

  const [files, setFiles] = useState([]);
  const [previewUrls, setPreviewUrls] = useState([]);

  const {
    compressImages,
    isCompressing,
    results,
    error,
    removeResult,
    clearResults,
  } = useImageCompression();

  // previewUrls 동기화 + 메모리 해제
  useEffect(() => {
    const urls = files.map((f) => URL.createObjectURL(f));
    setPreviewUrls(urls);
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, [files]);

  // 파일 선택 → 즉시 압축
  const handleFileChange = useCallback(
    async (e) => {
      const selected = Array.from(e.target.files || []);
      if (selected.length === 0) return;

      const { files: compressed } = await compressImages(selected);
      setFiles((prev) => [...prev, ...compressed]);
      e.target.value = '';
    },
    [compressImages]
  );

  // 개별 삭제
  const handleDelete = useCallback(
    (index) => {
      setFiles((prev) => prev.filter((_, i) => i !== index));
      removeResult(index);
    },
    [removeResult]
  );

  // 전체 삭제
  const handleClearAll = useCallback(() => {
    setFiles([]);
    clearResults();
  }, [clearResults]);

  // 전체 압축 요약
  const totalOriginal = results.reduce((s, r) => s + r.originalSize, 0);
  const totalCompressed = results.reduce((s, r) => s + r.compressedSize, 0);
  const totalRatio = totalOriginal > 0
    ? Math.round((1 - totalCompressed / totalOriginal) * 100)
    : 0;

  return (
    <div className="compressor-page">
      {/* 헤더 */}
      <header className="compressor-page__header">
        <button
          className="compressor-page__back"
          onClick={() => navigate('/')}
          aria-label="뒤로 가기"
        >
          &larr;
        </button>
        <h2 className="compressor-page__title">이미지 압축</h2>
      </header>

      {/* 파일 선택 */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="compressor-input-hidden"
        onChange={handleFileChange}
        aria-label="이미지 선택"
      />

      {/* 선택 버튼 */}
      <button
        className="compressor-select-btn"
        onClick={() => inputRef.current?.click()}
        disabled={isCompressing}
      >
        {isCompressing ? '압축 중...' : '📷 이미지 선택'}
      </button>

      {/* 로딩 */}
      {isCompressing && (
        <div className="compressor-loading">
          <div className="spinner" aria-hidden="true" />
          <p>이미지를 압축하고 있습니다...</p>
        </div>
      )}

      {/* 에러 */}
      {error && <p className="compressor-error" role="alert">{error}</p>}

      {/* 전체 요약 */}
      {results.length > 0 && (
        <div className="compressor-summary">
          <span>전체: {formatFileSize(totalOriginal)} → {formatFileSize(totalCompressed)}</span>
          <span className="compressor-summary__ratio">({totalRatio}% 절감)</span>
        </div>
      )}

      {/* 미리보기 격자 */}
      {previewUrls.length > 0 && (
        <div className="compressor-grid">
          {previewUrls.map((url, i) => (
            <div className="compressor-grid__item" key={`${url}-${i}`}>
              <img
                className="compressor-grid__img"
                src={url}
                alt={`압축된 이미지 ${i + 1}`}
              />
              <button
                className="compressor-grid__delete"
                onClick={() => handleDelete(i)}
                aria-label={`이미지 ${i + 1} 삭제`}
              >
                ✕
              </button>
              {/* 개별 압축 정보 */}
              {results[i] && (
                <div className="compressor-grid__info">
                  <span>{results[i].originalSizeStr} → {results[i].compressedSizeStr}</span>
                  <span className="compressor-grid__ratio">-{results[i].ratio}%</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 액션 */}
      {files.length > 0 && (
        <div className="compressor-actions">
          <button
            className="compressor-actions__add"
            onClick={() => inputRef.current?.click()}
            disabled={isCompressing}
          >
            추가 선택
          </button>
          <button className="compressor-actions__clear" onClick={handleClearAll}>
            전체 삭제
          </button>
        </div>
      )}
    </div>
  );
}
