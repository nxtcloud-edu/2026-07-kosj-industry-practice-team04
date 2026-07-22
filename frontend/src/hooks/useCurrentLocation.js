import { useCallback, useState } from 'react';

/**
 * 현재 위치를 가져오는 커스텀 훅 (PER-003)
 *
 * - HTML5 Geolocation API 사용
 * - 로딩·에러 상태 관리
 * - 위치 수동 설정(setPosition)도 지원하여 지도 연동에 대비
 *
 * @returns {{
 *   position: { latitude: number, longitude: number } | null,
 *   isLoading: boolean,
 *   error: string | null,
 *   getCurrentPosition: () => void,
 *   setPosition: (pos: { latitude: number, longitude: number }) => void,
 * }}
 */
export default function useCurrentLocation() {
  const [position, setPosition] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const getCurrentPosition = useCallback(() => {
    if (!navigator.geolocation) {
      setError('이 브라우저에서는 위치 서비스를 지원하지 않습니다.');
      return;
    }

    setIsLoading(true);
    setError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPosition({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
        setIsLoading(false);
      },
      (err) => {
        let message;
        switch (err.code) {
          case err.PERMISSION_DENIED:
            message = '위치 권한이 거부되었습니다. 브라우저 설정에서 위치 권한을 허용해주세요.';
            break;
          case err.POSITION_UNAVAILABLE:
            message = '위치 정보를 사용할 수 없습니다.';
            break;
          case err.TIMEOUT:
            message = '위치 요청 시간이 초과되었습니다.';
            break;
          default:
            message = '위치를 가져오는 중 오류가 발생했습니다.';
        }
        setError(message);
        setIsLoading(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  }, []);

  // 지도에서 위치를 수동으로 선택했을 때 호출
  const updatePosition = useCallback((newPosition) => {
    setPosition(newPosition);
    setError(null);
  }, []);

  return {
    position,
    isLoading,
    error,
    getCurrentPosition,
    setPosition: updatePosition,
  };
}
