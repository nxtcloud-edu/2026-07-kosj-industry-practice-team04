import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

/**
 * 지도 컴포넌트 (멘토 피드백 7/23 · SIR-002)
 * ─────────────────────────────────────────────────────
 * Leaflet + OpenStreetMap 타일 — API 키 없이 동작한다.
 *
 * 두 가지 모드를 겸한다:
 *  - picker: draggable 핀 1개. 드래그하면 onMove({latitude, longitude}) 호출
 *            → "지도에서 위치 수정" (신고 위치 보정)
 *  - issues: 대표 문제 목록을 유형 색 핀으로 표시, 탭하면 onSelect(id)
 */

const TYPE_COLORS = {
  '도로 파손': '#C4453C',
  '가로등 고장': '#DFA321',
  '쓰레기 무단투기': '#5C7A3A',
  '기타': '#5F6B7A',
};

function pinIcon(color, { active = false, mine = false } = {}) {
  const size = active ? 34 : 26;
  return L.divIcon({
    className: 'moa-pin-wrap',
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
    html: `<span class="moa-pin ${active ? 'is-active' : ''} ${mine ? 'is-mine' : ''}" style="--pin:${color}"></span>`,
  });
}

export default function MoaMap({
  center,               // { latitude, longitude }
  zoom = 16,
  picker = false,       // true면 드래그 가능한 내 위치 핀
  onMove,               // picker 드래그 콜백
  issues = [],          // [{ id, type, lat, lng }]
  selectedId = null,
  onSelect,
  className = '',
  ariaLabel = '지도',
}) {
  const boxRef = useRef(null);
  const mapRef = useRef(null);
  const pinRef = useRef(null);
  const layerRef = useRef(null);
  const onMoveRef = useRef(onMove);
  const onSelectRef = useRef(onSelect);
  onMoveRef.current = onMove;
  onSelectRef.current = onSelect;

  // 지도 생성/파괴
  useEffect(() => {
    if (!boxRef.current || mapRef.current) return undefined;

    const map = L.map(boxRef.current, {
      zoomControl: false,
      attributionControl: true,
    }).setView([center.latitude, center.longitude], zoom);

    L.control.zoom({ position: 'bottomright' }).addTo(map);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap',
    }).addTo(map);

    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      pinRef.current = null;
      layerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 중심 이동
  useEffect(() => {
    if (!mapRef.current || !center) return;
    mapRef.current.setView([center.latitude, center.longitude], mapRef.current.getZoom(), { animate: true });
  }, [center?.latitude, center?.longitude]);

  // picker 핀
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !picker || !center) return;

    if (!pinRef.current) {
      const pin = L.marker([center.latitude, center.longitude], {
        draggable: true,
        icon: pinIcon('#166E5C', { mine: true }),
        keyboard: true,
        title: '신고 위치 (드래그해서 조정)',
      }).addTo(map);
      pin.on('dragend', () => {
        const p = pin.getLatLng();
        onMoveRef.current?.({ latitude: p.lat, longitude: p.lng });
      });
      pinRef.current = pin;
    } else {
      pinRef.current.setLatLng([center.latitude, center.longitude]);
    }
  }, [picker, center?.latitude, center?.longitude]);

  // issues 핀
  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;
    layer.clearLayers();

    for (const issue of issues) {
      const color = TYPE_COLORS[issue.type] ?? TYPE_COLORS['기타'];
      const marker = L.marker([issue.lat, issue.lng], {
        icon: pinIcon(color, { active: issue.id === selectedId }),
        title: `${issue.type} · ${issue.status ?? ''}`,
      });
      marker.on('click', () => onSelectRef.current?.(issue.id));
      layer.addLayer(marker);
    }
  }, [issues, selectedId]);

  return (
    <div
      ref={boxRef}
      className={`moa-map ${className}`}
      role="application"
      aria-label={ariaLabel}
    />
  );
}
