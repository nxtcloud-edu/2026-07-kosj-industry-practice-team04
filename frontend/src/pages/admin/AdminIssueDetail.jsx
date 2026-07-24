import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { adminIssue, markSpam, reclassify, setIssueStatus, splitIssue } from '../../api.js';
import MoaMap from '../../components/MoaMap.jsx';
import Thumb from '../../components/Thumb.jsx';
import './admin.css';

// 관리자 문제 상세 — 상태 변경(SFR-006) · 재분류(COR-001, SFR-005) · 스팸 · 오통합 분리
const STATUS_FLOW = ['접수', '배정', '처리중', '완료'];
const TYPES = ['도로 파손', '가로등 고장', '쓰레기 무단투기', '기타'];
const SPLIT_REASONS = ['위치 상이', '유형 상이', '별개 문제'];

function formatTime(value) {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleString('ko-KR');
}

function badgeClass(issue) {
  if (issue.priorityLabel === '높음') return 'high';
  if (issue.priorityLabel === '보통') return 'mid';
  return 'low';
}

export default function AdminIssueDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(null); // { kind: 'info'|'warn'|'error', text }
  const [busy, setBusy] = useState(false);
  const [typeSel, setTypeSel] = useState({});
  const [splitOpen, setSplitOpen] = useState(null); // reportId
  const [splitReason, setSplitReason] = useState(SPLIT_REASONS[0]);
  const [selectedReportId, setSelectedReportId] = useState(null); // 지도 핀 ↔ 카드 연동

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await adminIssue(id);
      setData(res);
      const sel = {};
      (res.reports || []).forEach((r) => {
        sel[r.id] = r.type;
      });
      setTypeSel(sel);
    } catch (e) {
      setError(e.message || '문제 정보를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const changeStatus = async (status) => {
    if (busy || !data || status === data.status) return;
    setBusy(true);
    setNotice(null);
    try {
      await setIssueStatus(id, status);
      setNotice({ kind: 'info', text: `상태를 '${status}'(으)로 변경했습니다.` });
      await load();
    } catch (e) {
      setNotice({ kind: 'error', text: e.message || '상태 변경에 실패했습니다.' });
    } finally {
      setBusy(false);
    }
  };

  const applyReclass = async (report) => {
    if (busy) return;
    const type = typeSel[report.id] || report.type;
    setBusy(true);
    setNotice(null);
    try {
      const res = await reclassify(report.id, type);
      if (res.warning) {
        setNotice({ kind: 'warn', text: res.warning });
      } else {
        setNotice({ kind: 'info', text: `신고 ${report.receiptNo}의 유형을 '${type}'(으)로 재분류했습니다.` });
      }
      await load();
    } catch (e) {
      setNotice({ kind: 'error', text: e.message || '재분류에 실패했습니다.' });
    } finally {
      setBusy(false);
    }
  };

  const toggleSpam = async (report) => {
    if (busy) return;
    setBusy(true);
    setNotice(null);
    try {
      await markSpam(report.id, !report.spam);
      setNotice({
        kind: 'info',
        text: report.spam ? `신고 ${report.receiptNo}의 스팸 처리를 해제했습니다.` : `신고 ${report.receiptNo}을(를) 스팸 처리했습니다.`,
      });
      await load();
    } catch (e) {
      setNotice({ kind: 'error', text: e.message || '스팸 처리에 실패했습니다.' });
    } finally {
      setBusy(false);
    }
  };

  const confirmSplit = async (report) => {
    if (busy) return;
    setBusy(true);
    setNotice(null);
    try {
      await splitIssue(id, report.id, splitReason);
      setNotice({ kind: 'info', text: `신고 ${report.receiptNo}을(를) 분리해 새 문제로 생성했습니다. 목록으로 이동합니다.` });
      setSplitOpen(null);
      setTimeout(() => navigate('/admin'), 1200);
    } catch (e) {
      setNotice({ kind: 'error', text: e.message || '분리에 실패했습니다.' });
      setBusy(false);
    }
  };

  const flow = data?.statusFlow || STATUS_FLOW;
  const reports = data?.reports || [];
  const history = data?.history ? [...data.history].reverse() : [];

  return (
    <div className="admin-shell">
      <header className="admin-topbar">
        <div className="admin-topbar-inner">
          <h1 className="admin-title">
            <span className="admin-title-mark">모아 관리자</span>
            <span className="admin-title-sub">· 문제 상세</span>
          </h1>
          <div className="admin-top-actions">
            <button type="button" className="admin-btn teal" onClick={load} disabled={loading || busy}>
              ⟳ 새로고침
            </button>
            <Link className="admin-btn ghost" to="/admin">
              목록으로
            </Link>
          </div>
        </div>
      </header>

      <main className="admin-main">
        <Link className="admin-back" to="/admin">
          ← 대표 문제 목록으로 돌아가기
        </Link>

        {notice && (
          <div className={`notice ${notice.kind}`} role="alert">
            {notice.text}
          </div>
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
          <>
            <section className="admin-detail-head">
              <h2>
                {data.type}
                <span className={`admin-badge ${badgeClass(data)}`}>
                  {data.priority}점 · {data.priorityLabel}
                </span>
                {data.needsReview && <span className="admin-badge review">검수 필요</span>}
              </h2>
              <p className="admin-detail-sub">
                {data.address} · 담당 {data.dept} · 현재 상태 {data.status}
              </p>
              <p className="admin-priority-note">
                우선순위 {data.priority} = 위험도 + 신고 {data.reportCount}건 + 공감 {Math.min(data.empathy, 5)}
                {data.empathy > 5 && ` (실제 ${data.empathy} — 조작 방지 상한 5 적용)`}
              </p>
            </section>

            {/* 통합된 신고 위치 비교 — 멀리 떨어진 핀은 오통합 신호 */}
            {reports.some((r) => Number.isFinite(r.lat) && Number.isFinite(r.lng)) && (
              <section className="admin-panel">
                <h3>신고 위치 지도</h3>
                <div className="admin-map-wrap">
                  <MoaMap
                    center={{ latitude: data.lat, longitude: data.lng }}
                    zoom={17}
                    issues={reports
                      .filter((r) => Number.isFinite(r.lat) && Number.isFinite(r.lng))
                      .map((r) => ({ id: r.id, type: r.type, lat: r.lat, lng: r.lng, status: r.receiptNo }))}
                    selectedId={selectedReportId}
                    onSelect={setSelectedReportId}
                    ariaLabel="통합된 신고들의 위치 지도"
                  />
                </div>
                <p className="admin-map-hint">핀을 누르면 아래 신고 카드가 강조됩니다 — 유형 색이 다르거나 멀리 떨어진 핀은 분리 검토 대상</p>
              </section>
            )}

            <section className="admin-panel">
              <h3>상태 변경</h3>
              <div className="admin-status-btns" role="group" aria-label="처리 상태 변경">
                {flow.map((s, i) => (
                  <button
                    key={s}
                    type="button"
                    className={`admin-status-btn ${s === data.status ? 'current' : ''}`}
                    aria-pressed={s === data.status}
                    disabled={busy}
                    onClick={() => changeStatus(s)}
                  >
                    {i + 1}. {s}
                  </button>
                ))}
              </div>
            </section>

            <section className="admin-panel">
              <h3>통합된 신고 {reports.length}건 — 사진 비교</h3>
              <div className="admin-report-grid">
                {reports.map((r) => (
                  <article
                    key={r.id}
                    className={`admin-report-card ${r.spam ? 'spam' : ''} ${r.id === selectedReportId ? 'is-selected' : ''}`}
                    onClick={() => setSelectedReportId(r.id)}
                  >
                    <Thumb className="admin-report-photo" url={r.photoUrl} alt={`신고 ${r.receiptNo} 사진`} />
                    <div className="admin-report-body">
                      <div className="admin-report-top">
                        <b className="admin-mono">{r.receiptNo}</b>
                        <span className="admin-conf">신뢰도 {Math.round((r.confidence ?? 0) * 100)}%</span>
                        {r.spam && <span className="admin-badge spam">스팸</span>}
                      </div>
                      <p className="admin-report-meta">{formatTime(r.createdAt)}</p>
                      <p className="admin-report-meta">{r.address}</p>

                      <div className="admin-report-actions">
                        <div className="admin-inline">
                          <select
                            className="admin-select"
                            value={typeSel[r.id] || r.type}
                            onChange={(e) => setTypeSel((s) => ({ ...s, [r.id]: e.target.value }))}
                            aria-label={`신고 ${r.receiptNo} 유형 재분류`}
                          >
                            {TYPES.map((t) => (
                              <option key={t} value={t}>
                                {t}
                              </option>
                            ))}
                          </select>
                          <button type="button" className="admin-btn teal" disabled={busy} onClick={() => applyReclass(r)}>
                            재분류 적용
                          </button>
                        </div>

                        <div className="admin-inline">
                          <button type="button" className="admin-btn danger" disabled={busy} onClick={() => toggleSpam(r)}>
                            {r.spam ? '스팸 해제' : '스팸 처리'}
                          </button>
                          {reports.length >= 2 &&
                            (splitOpen === r.id ? (
                              <>
                                <select
                                  className="admin-select"
                                  value={splitReason}
                                  onChange={(e) => setSplitReason(e.target.value)}
                                  aria-label="분리 사유"
                                >
                                  {SPLIT_REASONS.map((x) => (
                                    <option key={x} value={x}>
                                      {x}
                                    </option>
                                  ))}
                                </select>
                                <button type="button" className="admin-btn yellow" disabled={busy} onClick={() => confirmSplit(r)}>
                                  분리 확정
                                </button>
                                <button type="button" className="admin-btn ghost" disabled={busy} onClick={() => setSplitOpen(null)}>
                                  취소
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                className="admin-btn ghost"
                                disabled={busy}
                                onClick={() => {
                                  setSplitOpen(r.id);
                                  setSplitReason(SPLIT_REASONS[0]);
                                }}
                              >
                                이 신고 분리
                              </button>
                            ))}
                        </div>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section className="admin-panel">
              <h3>처리 이력</h3>
              {history.length === 0 ? (
                <p className="admin-report-meta">아직 이력이 없습니다.</p>
              ) : (
                <ol className="admin-timeline">
                  {history.map((h, i) => (
                    <li key={i}>
                      {h.event || h.status || h.label || ''}
                      {h.note ? ` — ${h.note}` : ''}
                      <time>{formatTime(h.time || h.at)}</time>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
