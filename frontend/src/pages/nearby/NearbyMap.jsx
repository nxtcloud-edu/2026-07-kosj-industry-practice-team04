import { useCallback, useEffect, useMemo, useState } from 'react';
import { issuesMap, addEmpathy } from '../../api.js';
import { getDeviceId } from '../../deviceId.js';
import useCurrentLocation from '../../hooks/useCurrentLocation.js';
import MoaMap from '../../components/MoaMap.jsx';
import './nearby.css';

/**
 * '내 주변' 탭 (멘토 피드백 7/23)
 * 내 위치 반경 안의 신고를 지도와 목록으로 함께 보여준다.
 * 같은 문제가 이미 있으면 새로 신고하는 대신 공감으로 힘을 보탤 수 있다.
 */

// 위치 권한이 없을 때의 기본 중심 — 세종시청 인근
const FALLBACK_CENTER = { latitude: 36.4801, longitude: 127.2891 };
const RADII = [
  { m: 500, label: '500m' },
  { m: 1500, label: '1.5km' },
  { m: 3000, label: '3km' },
];

const STATUS_CLASS = { 접수: 's0', 배정: 's1', 처리중: 's2', 완료: 's3' };

export default function NearbyMap() {
  const { position, isLoading: locating, error: locError, getCurrentPosition } = useCurrentLocation();
  const [radiusM, setRadiusM] = useState(1500);
  const [issues, setIssues] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [empathyBusy, setEmpathyBusy] = useState(null);
  const [empathized, setEmpathized] = useState(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem('moa-empathized-issues'));
      return Array.isArray(saved) ? saved : [];
    } catch {
      return [];
    }
  });

  const center = position ?? FALLBACK_CENTER;

  // 첫 진입 시 위치 요청
  useEffect(() => { getCurrentPosition(); }, [getCurrentPosition]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { issues: list } = await issuesMap(center.latitude, center.longitude, radiusM);
      setIssues(list);
    } catch (e) {
      setError(e.message || '주변 신고를 불러오지 못했습니다.');
      setIssues([]);
    } finally {
      setLoading(false);
    }
  }, [center.latitude, center.longitude, radiusM]);

  useEffect(() => { load(); }, [load]);

  const handleEmpathy = useCallback(async (issueId) => {
    if (empathyBusy || empathized.includes(issueId)) return;
    setEmpathyBusy(issueId);
    setError('');
    try {
      const result = await addEmpathy(issueId, getDeviceId());
      setIssues((cur) => (cur ?? []).map((it) => (it.id === issueId ? { ...it, empathy: result.count } : it)));
      const next = [...empathized, issueId];
      setEmpathized(next);
      window.localStorage.setItem('moa-empathized-issues', JSON.stringify(next));
    } catch (e) {
      setError(e.status === 429 ? '잠시 후 다시 공감할 수 있습니다.' : (e.message || '공감을 추가하지 못했습니다.'));
    } finally {
      setEmpathyBusy(null);
    }
  }, [empathyBusy, empathized]);

  const selected = useMemo(
    () => (issues ?? []).find((it) => it.id === selectedId) ?? null,
    [issues, selectedId],
  );

  return (
    <div className="nearby-page">
      <header className="page-head">
        <h1 className="page-head__title">내 주변 신고</h1>
        <p className="page-head__sub">이미 접수된 문제라면 공감으로 처리 순서를 앞당겨 보세요.</p>
      </header>

      <div className="nearby-controls">
        <div className="chip-group" role="group" aria-label="검색 반경">
          {RADII.map((r) => (
            <button
              key={r.m}
              type="button"
              className={`chip ${radiusM === r.m ? 'is-active' : ''}`}
              aria-pressed={radiusM === r.m}
              onClick={() => setRadiusM(r.m)}
            >
              {r.label}
            </button>
          ))}
        </div>
        <button type="button" className="chip chip--action" onClick={getCurrentPosition} disabled={locating}>
          {locating ? '위치 찾는 중…' : '📍 내 위치'}
        </button>
      </div>

      {locError && (
        <p className="notice warn" role="alert">
          위치 권한이 없어 세종시청 주변을 보여드리고 있어요. ({locError})
        </p>
      )}

      <div className="nearby-map-wrap">
        <MoaMap
          center={center}
          zoom={radiusM > 1500 ? 14 : 15}
          issues={issues ?? []}
          selectedId={selectedId}
          onSelect={setSelectedId}
          ariaLabel="내 주변 신고 지도"
        />
        {selected && (
          <aside className="nearby-popup" aria-live="polite">
            <div className="nearby-popup__row">
              <b>{selected.type}</b>
              <span className={`status-chip ${STATUS_CLASS[selected.status] ?? 's0'}`}>{selected.status}</span>
            </div>
            <p className="nearby-popup__meta">
              약 {selected.distance}m · 신고 {selected.reportCount}건 · 공감 {selected.empathy}
            </p>
            <button
              type="button"
              className="empathy-btn"
              aria-pressed={empathized.includes(selected.id)}
              disabled={empathyBusy === selected.id || empathized.includes(selected.id)}
              onClick={() => handleEmpathy(selected.id)}
            >
              {empathized.includes(selected.id) ? '✓ 공감했어요' : empathyBusy === selected.id ? '추가 중…' : '🙋 나도 불편해요'}
            </button>
          </aside>
        )}
      </div>

      {error && <p className="notice error" role="alert">{error}</p>}

      <section className="nearby-list" aria-label="주변 신고 목록">
        {loading && <div className="spinner" role="status" aria-label="불러오는 중" />}
        {!loading && issues && issues.length === 0 && (
          <div className="nearby-empty">
            <b>반경 {radiusM >= 1000 ? `${radiusM / 1000}km` : `${radiusM}m`} 안에 신고가 없어요</b>
            <p>불편한 곳을 발견하셨다면 첫 신고를 남겨주세요.</p>
          </div>
        )}
        {!loading && (issues ?? []).map((it, i) => (
          <button
            key={it.id}
            type="button"
            className={`nearby-card rise ${it.id === selectedId ? 'is-active' : ''}`}
            style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
            onClick={() => setSelectedId(it.id)}
          >
            <div className="nearby-card__row">
              <b className="nearby-card__type">{it.type}</b>
              <span className={`status-chip ${STATUS_CLASS[it.status] ?? 's0'}`}>{it.status}</span>
            </div>
            <p className="nearby-card__meta">
              약 {it.distance}m · 신고 {it.reportCount}건 · 공감 {it.empathy} · 중요도 {it.priorityLabel}
            </p>
          </button>
        ))}
      </section>
    </div>
  );
}
