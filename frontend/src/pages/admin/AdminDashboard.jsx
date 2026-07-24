import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminIssues, adminStats } from '../../api.js';
import Thumb from '../../components/Thumb.jsx';
import './admin.css';

// 관리자 대시보드 — 대표 문제 목록 · 검수 큐 · 통계 (MVP 2·3 관리자 측)
const STATUS_FLOW = ['접수', '배정', '처리중', '완료'];
const TABS = [
  { key: 'all', label: '전체' },
  { key: 'review', label: '🔍 검수 큐' },
  ...STATUS_FLOW.map((s) => ({ key: s, label: s })),
];

function buildQs(tab, sort) {
  const p = new URLSearchParams();
  p.set('sort', sort);
  if (tab === 'review') p.set('queue', 'review');
  else if (tab !== 'all') p.set('status', tab);
  return `?${p.toString()}`;
}

function badgeClass(issue) {
  if (issue.priorityLabel === '높음') return 'high';
  if (issue.priorityLabel === '보통') return 'mid';
  return 'low';
}

export default function AdminDashboard() {
  const [tab, setTab] = useState('all');
  const [sort, setSort] = useState('priority');
  const [stats, setStats] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [s, d] = await Promise.all([adminStats(), adminIssues(buildQs(tab, sort))]);
      setStats(s);
      setData(d);
    } catch (e) {
      setError(e.message || '데이터를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [tab, sort]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="admin-shell">
      <header className="admin-topbar">
        <div className="admin-topbar-inner">
          <h1 className="admin-title">
            <span className="admin-title-mark">모아 관리자</span>
            <span className="admin-title-sub">· 대표 문제 관리</span>
          </h1>
          <div className="admin-top-actions">
            <button type="button" className="admin-btn teal" onClick={load} disabled={loading}>
              ⟳ 새로고침
            </button>
            <Link className="admin-btn ghost" to="/">
              시민 화면
            </Link>
          </div>
        </div>
      </header>

      <main className="admin-main">
        {stats && (
          <section className="admin-stats" aria-label="처리 현황 통계">
            <div className="admin-stat total">
              <span>전체</span>
              <b>{stats.total}</b>
            </div>
            {STATUS_FLOW.map((s) => (
              <div className="admin-stat" key={s}>
                <span>{s}</span>
                <b>{stats.byStatus?.[s] ?? 0}</b>
              </div>
            ))}
            <div className="admin-stat review">
              <span>검수 큐</span>
              <b>{stats.reviewQueue}</b>
            </div>
            <div className="admin-stat">
              <span>분리 이력</span>
              <b>{stats.splits}</b>
            </div>
          </section>
        )}

        <div className="admin-toolbar">
          <div className="admin-tabs" role="group" aria-label="문제 필터">
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                className={`admin-tab ${tab === t.key ? 'active' : ''}`}
                aria-pressed={tab === t.key}
                onClick={() => setTab(t.key)}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="admin-sort" role="group" aria-label="정렬 방식">
            <button
              type="button"
              className={sort === 'priority' ? 'active' : ''}
              aria-pressed={sort === 'priority'}
              onClick={() => setSort('priority')}
            >
              우선순위순
            </button>
            <button
              type="button"
              className={sort === 'recent' ? 'active' : ''}
              aria-pressed={sort === 'recent'}
              onClick={() => setSort('recent')}
            >
              최신순
            </button>
          </div>
        </div>

        {data?.params && (
          <p className="admin-params">
            통합 기준: 반경 <b>{data.params.radiusM}m</b> · 동일 유형 · <b>{data.params.windowHours}시간</b>
          </p>
        )}

        {error && (
          <div className="notice error" role="alert">
            {error}
          </div>
        )}

        {loading && (
          <div className="admin-loading">
            <div className="spinner" role="status" aria-label="불러오는 중" />
          </div>
        )}

        {!loading && !error && data && (
          <section className="admin-grid" aria-label="대표 문제 목록">
            {data.issues.length === 0 && <p className="admin-empty">조건에 맞는 문제가 없습니다.</p>}
            {data.issues.map((it) => (
              <Link key={it.id} to={`/admin/issues/${it.id}`} className="admin-card" aria-label={`${it.type} — ${it.address} 상세 보기`}>
                <div className="admin-card-thumb">
                  <Thumb url={it.thumbnail} alt={`${it.type} 신고 사진`} />
                  {it.needsReview && <span className="admin-badge review">검수 필요</span>}
                </div>
                <div className="admin-card-body">
                  <div className="admin-card-top">
                    <b className="admin-card-type">{it.type}</b>
                    <span className={`admin-badge ${badgeClass(it)}`}>
                      {it.priority}점 · {it.priorityLabel}
                    </span>
                  </div>
                  <p className="admin-card-addr">{it.address}</p>
                  <p className="admin-card-meta">
                    신고 {it.reportCount}건 · 공감 {it.empathy}
                  </p>
                  <div className="admin-card-foot">
                    <span className="admin-dept">{it.dept}</span>
                    <span className={`admin-status s${it.statusIndex}`}>{it.status}</span>
                  </div>
                </div>
              </Link>
            ))}
          </section>
        )}
      </main>
    </div>
  );
}
