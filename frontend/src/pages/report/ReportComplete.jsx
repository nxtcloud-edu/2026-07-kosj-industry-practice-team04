import { useLocation, useNavigate } from 'react-router-dom';
import './report.css';

/**
 * 신고 완료 화면 (/report/complete) — Issue #8
 *
 * - 신고 완료 메시지 표시
 * - 접수번호 표시
 * - 신고 조회 링크
 * - 유사 신고 후보 카드 (더미 데이터)
 */

// 예시 접수번호 (실제로는 이전 화면에서 전달받음)
const MOCK_RECEIPT = {
  receiptNo: 'MOA-20260722-38291',
  date: '2026. 07. 22. 14:32',
};

// 유사 신고 후보 더미 데이터
const SIMILAR_REPORTS = [
  {
    id: 1,
    type: '도로 파손',
    address: '세종특별자치시 도움6로 24 인근',
    date: '2026. 07. 20.',
    status: 'processing',
    statusLabel: '처리중',
  },
  {
    id: 2,
    type: '도로 파손',
    address: '세종특별자치시 도움6로 26 인근',
    date: '2026. 07. 18.',
    status: 'resolved',
    statusLabel: '완료',
  },
  {
    id: 3,
    type: '가로등 고장',
    address: '세종특별자치시 도움6로 52 인근',
    date: '2026. 07. 21.',
    status: 'received',
    statusLabel: '접수',
  },
];

export default function ReportComplete() {
  const navigate = useNavigate();
  const { state } = useLocation();

  // 접수 응답(receiptNo·viewToken)은 위치 확인 화면에서 넘어온다.
  // 직접 URL로 들어온 경우엔 예시 값으로 화면만 보여준다.
  const receiptNo = state?.receiptNo ?? MOCK_RECEIPT.receiptNo;
  const viewToken = state?.viewToken ?? null;
  const receivedAt = state?.receiptNo
    ? new Date().toLocaleString('ko-KR')
    : MOCK_RECEIPT.date;

  // 조회는 접수번호 + 토큰이 함께 있어야 한다 (SER-001·003)
  const statusPath = viewToken
    ? `/status/${receiptNo}?token=${viewToken}`
    : `/status/${receiptNo}`;

  return (
    <div className="report-complete">
      {/* 성공 아이콘 */}
      <span className="report-complete__icon" aria-hidden="true">
        ✅
      </span>

      {/* 완료 메시지 */}
      <h1 className="report-complete__title">신고가 접수되었습니다</h1>
      <p className="report-complete__subtitle">
        신고 내용을 확인하고 처리 결과를 안내해 드리겠습니다.
        <br />
        접수번호를 통해 처리 현황을 조회할 수 있습니다.
      </p>

      {/* 접수번호 카드 */}
      <div className="receipt-card">
        <span className="receipt-card__label">접수번호</span>
        <span className="receipt-card__number">{receiptNo}</span>
        <span className="receipt-card__date">접수일시: {receivedAt}</span>
      </div>

      {/* 액션 버튼 */}
      <div className="report-complete__actions">
        <button
          className="report-complete__btn report-complete__btn--primary"
          onClick={() => navigate(statusPath)}
        >
          신고 조회하기
        </button>
        <button
          className="report-complete__btn report-complete__btn--secondary"
          onClick={() => navigate('/')}
        >
          홈으로 돌아가기
        </button>
      </div>

      {/* 유사 신고 후보 */}
      <section className="similar-section">
        <h2 className="similar-section__heading">
          주변 유사 신고 ({SIMILAR_REPORTS.length}건)
        </h2>
        {SIMILAR_REPORTS.map((report) => (
          <article className="similar-card" key={report.id}>
            <span className="similar-card__type">{report.type}</span>
            <p className="similar-card__address">{report.address}</p>
            <div className="similar-card__meta">
              {report.date}
              <span
                className={`similar-card__status similar-card__status--${report.status}`}
                style={{ marginLeft: 8 }}
              >
                {report.statusLabel}
              </span>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
