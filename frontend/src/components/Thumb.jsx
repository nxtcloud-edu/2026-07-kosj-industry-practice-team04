import { useState } from 'react';
import { photoSrc } from '../api.js';

/**
 * 신고 사진 썸네일 — 로드 실패(파일 없음·404) 시 "사진 없음" 자리표시로 대체한다.
 * 저장소에서 파일이 사라져도 관리자 화면이 깨진 이미지 아이콘을 보이지 않게 한다.
 */
export default function Thumb({ url, alt, className = '' }) {
  const [failed, setFailed] = useState(false);

  if (!url || failed) {
    return <div className={`admin-thumb-empty ${className}`}>사진 없음</div>;
  }
  return (
    <img
      className={className}
      src={photoSrc(url)}
      alt={alt}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}
