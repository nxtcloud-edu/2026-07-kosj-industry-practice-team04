import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { getStatus } from '../../api.js';
import './status.css';

/**
 * 신고 상태 조회 화면 (/status/:receiptNo)
 *
 * 접수번호를 기반으로 처리 현황을 표시한다.
 * 접수번호와 비밀 조회 토큰이 모두 있어야 로그인 없이 조회할 수 있다.
 */
export default function ReportStatus() {
  const { receiptNo } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(Boolean(token));

  useEffect(() => {
    if (!token) {
      setError('조회 토큰이 없습니다. 신고 완료 화면에서 제공된 조회 링크를 사용해 주세요.');
      setLoading(false);
      return;
    }

    let active = true;
    getStatus(receiptNo, token)
      .then((result) => { if (active) setData(result); })
      .catch((e) => {
        if (!active) return;
        setError(e.status === 403
          ? '조회 링크가 만료되었거나 올바르지 않습니다.'
          : e.message || '처리 현황을 불러오지 못했습니다.');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [receiptNo, token]);

  const statusInfo = useMemo(() => {
    if (!data) return null;
    const issue = data.issue ?? data;
    const report = data.report ?? data;
    const flow = issue.statusFlow ?? ['접수', '배정', '처리중', '완료'];
    const status = issue.status ?? report.status ?? '접수';
    const currentIndex = Math.max(flow.indexOf(status), 0);
    return {
      receiptNo: report.receiptNo ?? receiptNo,
      status,
      statusDetail: status === '완료'
        ? '신고 처리가 완료되었습니다.'
        : '담당 부서에서 신고 내용을 확인하고 있습니다.',
      dept: issue.dept ?? null,
      receivedAt: report.createdAt ? new Date(report.createdAt).toLocaleString('ko-KR') : '-',
      steps: flow.map((label, index) => ({ label, done: index <= currentIndex })),
      // 담당자의 상태 변경 기록 (서버가 상태 변경 이벤트만 내려준다 — 타인 정보 없음)
      history: [
        { label: '신고 접수', at: report.createdAt },
        ...(issue.history ?? []).map((h) => ({
          label: h.event.replace('상태 변경 → ', '') + ' 단계로 변경',
          at: h.at,
        })),
      ],
    };
  }, [data, receiptNo]);

  if (loading) {
    return <div className="status-page"><div className="spinner" role="status" aria-label="처리 현황 불러오는 중" /></div>;
  }

  if (error || !statusInfo) {
    return (
      <div className="status-page">
        <h1 className="status-page__title">신고 조회</h1>
        <section className="status-error" role="alert">
          <strong>처리 현황을 조회할 수 없습니다</strong>
          <p>{error || '조회 정보가 없습니다.'}</p>
          <small>보안을 위해 조회 토큰은 재발급되지 않습니다. 링크를 잃어버린 경우 담당 기관에 접수번호로 문의해 주세요.</small>
        </section>
        <button className="status-home-btn" onClick={() => navigate('/')}>홈으로 돌아가기</button>
      </div>
    );
  }

  return (
    <div className="status-page">
      {/* 헤더 */}
      <header className="status-page__header">
        <h1 className="status-page__title">신고 조회</h1>
      </header>

      {/* 접수번호 카드 */}
      <section className="status-card">
        <span className="status-card__label">접수번호</span>
        <span className="status-card__number">{statusInfo.receiptNo}</span>
      </section>

      {/* 현재 상태 */}
      <section className="status-current">
        <div className="status-current__badge">{statusInfo.status}</div>
        <p className="status-current__detail">
          {statusInfo.statusDetail}
          {statusInfo.dept && <> 담당: <b>{statusInfo.dept}</b></>}
        </p>
        <span className="status-current__date">
          접수일시: {statusInfo.receivedAt}
        </span>
      </section>

      {/* 처리 단계 */}
      <section className="status-steps">
        <h2 className="status-steps__heading">처리 현황</h2>
        <ol className="status-steps__list">
          {statusInfo.steps.map((step, i) => (
            <li
              className={`status-steps__item ${step.done ? 'status-steps__item--done' : ''}`}
              key={i}
            >
              <span className="status-steps__dot" />
              <span className="status-steps__label">{step.label}</span>
            </li>
          ))}
        </ol>
      </section>

      {/* 처리 기록 — 담당자가 상태를 바꾼 시각 */}
      {statusInfo.history.length > 1 && (
        <section className="status-history" aria-label="처리 기록">
          <h2 className="status-steps__heading">처리 기록</h2>
          <ol className="status-history__list">
            {statusInfo.history.map((h, i) => (
              <li className="status-history__item" key={i}>
                <span className="status-history__label">{h.label}</span>
                <time className="status-history__time">
                  {h.at ? new Date(h.at).toLocaleString('ko-KR') : ''}
                </time>
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* 홈으로 돌아가기 */}
      <button
        className="status-home-btn"
        onClick={() => navigate('/')}
      >
        홈으로 돌아가기
      </button>
    </div>
  );
}
