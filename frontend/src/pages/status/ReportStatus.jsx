import { useParams, useNavigate } from 'react-router-dom';
import './status.css';

/**
 * 신고 상태 조회 화면 (/status/:receiptNo)
 *
 * 접수번호를 기반으로 처리 현황을 표시한다.
 * 현재는 접수 완료 상태를 정적으로 보여주며,
 * 향후 백엔드 API(/api/reports/:receiptNo)와 연동하여 실시간 조회 가능.
 */
export default function ReportStatus() {
  const { receiptNo } = useParams();
  const navigate = useNavigate();

  // TODO: 실제 백엔드 API 연동 — fetch(`/api/reports/${receiptNo}?token=...`)
  const statusInfo = {
    receiptNo,
    status: '접수 완료',
    statusDetail: '신고가 정상적으로 접수되었습니다. 담당 부서에서 확인 후 처리할 예정입니다.',
    receivedAt: '2026. 07. 22. 14:32',
    steps: [
      { label: '신고 접수', done: true },
      { label: '담당 부서 배정', done: false },
      { label: '현장 확인', done: false },
      { label: '처리 완료', done: false },
    ],
  };

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
        <p className="status-current__detail">{statusInfo.statusDetail}</p>
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
