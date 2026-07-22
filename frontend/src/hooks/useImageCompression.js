import { useCallback, useState } from 'react';
import imageCompression from 'browser-image-compression';

/**
 * 이미지 자동 압축 커스텀 훅 (Issue #6)
 *
 * - 최대 1MB 이하, 최대 변 1920px, WebWorker 사용
 * - 압축 전/후 용량 + 압축률(%) 제공
 * - 압축 중 로딩 상태
 * - 압축 실패 시 원본으로 폴백
 */

const COMPRESSION_OPTIONS = {
  maxSizeMB: 1,
  maxWidthOrHeight: 1920,
  useWebWorker: true,
};

/**
 * 바이트를 사람이 읽을 수 있는 문자열로 변환
 */
export function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

export default function useImageCompression() {
  const [isCompressing, setIsCompressing] = useState(false);
  const [results, setResults] = useState([]);
  const [error, setError] = useState(null);

  /**
   * 단일 이미지 압축
   * @param {File} file
   * @returns {Promise<{file: File, info: object}>}
   */
  const compressOne = useCallback(async (file) => {
    const originalSize = file.size;

    try {
      const compressed = await imageCompression(file, COMPRESSION_OPTIONS);
      const compressedSize = compressed.size;
      const ratio = originalSize > 0
        ? Math.round((1 - compressedSize / originalSize) * 100)
        : 0;

      return {
        file: compressed,
        info: {
          originalSize,
          compressedSize,
          originalSizeStr: formatFileSize(originalSize),
          compressedSizeStr: formatFileSize(compressedSize),
          ratio,
        },
      };
    } catch {
      // 압축 실패 시 원본 폴백
      return {
        file,
        info: {
          originalSize,
          compressedSize: originalSize,
          originalSizeStr: formatFileSize(originalSize),
          compressedSizeStr: formatFileSize(originalSize),
          ratio: 0,
        },
      };
    }
  }, []);

  /**
   * 다중 이미지 압축
   * @param {File[]} files
   * @returns {Promise<{files: File[], infos: object[]}>}
   */
  const compressImages = useCallback(async (files) => {
    setIsCompressing(true);
    setError(null);

    try {
      const compressed = await Promise.all(files.map(compressOne));
      const compressedFiles = compressed.map((c) => c.file);
      const infos = compressed.map((c) => c.info);

      setResults((prev) => [...prev, ...infos]);
      return { files: compressedFiles, infos };
    } catch (e) {
      setError(e.message || '압축 중 오류가 발생했습니다.');
      return { files, infos: [] };
    } finally {
      setIsCompressing(false);
    }
  }, [compressOne]);

  /** 특정 인덱스의 결과 제거 */
  const removeResult = useCallback((index) => {
    setResults((prev) => prev.filter((_, i) => i !== index));
  }, []);

  /** 모든 결과 초기화 */
  const clearResults = useCallback(() => {
    setResults([]);
    setError(null);
  }, []);

  return {
    compressImages,
    isCompressing,
    results,
    error,
    removeResult,
    clearResults,
  };
}
