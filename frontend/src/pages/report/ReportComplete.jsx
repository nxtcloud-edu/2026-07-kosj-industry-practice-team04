import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import './report.css';

/**
 * 신고 완료 화면 (/report/complete) — Issue #8
 * 종이 접수증 모티프의 티켓. 조회 링크 복사와 '내 신고 보관함' 저장까지.
 */

function saveToMyReports(receiptNo, token) {
  try {
    const saved = JSON.parse(window.localStorage.getItem('moa-my-reports'));
    const list = Array.isArray(saved) ? saved : [];
    const next = [
      { receiptNo, token, at: new Date().toISOString() },
      ...list.filter((r) => r.receiptNo !== receiptNo),
    ].slice(0, 5);
    window.localStorage.setItem('moa-my-reports', JSON.stringify(next));
  } catch {
    // 저장이 안 돼도 접수 자체에는 영향 없다.
  }
}

export default function ReportComplete() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const [copied, setCopied] = useState(false);

  const receiptNo = state?.receiptNo ?? null;
  const viewToken = state?.viewToken ?? null;
  const merged = state?.merged ?? false;
  const receivedAt = useMemo(() => new Date().toLocaleString('ko-KR'), []);

  const statusPath = receiptNo && viewToken ? `/status/${receiptNo}?token=${viewToken}` : null;

  // 이 기기에서 접수한 신고는 보관함에 남겨 조회 탭에서 바로 열 수 있게 한다.
  useEffect(() => {
    if (receiptNo && viewToken) saveToMyReports(receiptNo, viewToken);
  }, [receiptNo, viewToken]);

  const copyLink = async () => {
    if (!statusPath) return;
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${statusPath}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  // 직접 URL로 들어온 경우 — 접수 정보가 없으니 조회 탭을 안내한다.
  if (!receiptNo) {
    return (
      <div className="report-complete">
        <span className="report-complete__icon" aria-hidden="true">🧾</span>
        <h1 className="report-complete__title">접수 정보가 없어요</h1>
        <p className="report-complete__subtitle">
          신고를 마치면 이 화면에 접수증이 표시됩니다.
          <br />
          이미 접수한 신고는 접수 조회 탭에서 확인해 주세요.
        </p>
        <div className="report-complete__actions">
          <button className="btn-primary" onClick={() => navigate('/report/camera')}>📷 신고 시작하기</button>
          <Link className="btn-ghost" to="/lookup">접수 조회로 가기</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="report-complete">
      <span className="report-complete__icon rise" aria-hidden="true">✅</span>

      <h1 className="report-complete__title rise">신고가 접수되었습니다</h1>
      <p className="report-complete__subtitle rise">
        {merged
          ? '주변의 같은 문제와 하나로 모아 담당자에게 전달했어요.'
          : '담당 부서가 확인 후 처리 단계를 안내해 드려요.'}
      </p>

      {/* 접수증 티켓 */}
      <article className="ticket rise" style={{ animationDelay: '80ms' }} aria-label="신고 접수증">
        <header className="ticket__head">
          <span className="ticket__brand">모아</span>
          <span className="ticket__badge">{merged ? '기존 문제에 통합' : '새 신고 접수'}</span>
        </header>
        <div className="ticket__body">
          <span className="ticket__label">접수번호</span>
          <b className="ticket__number">{receiptNo}</b>
          <span className="ticket__date">접수일시 · {receivedAt}</span>
        </div>
        <div className="ticket__tear" aria-hidden="true" />
        <footer className="ticket__foot">
          <span className="ticket__note">
            아래 조회 링크(토큰 포함)는 재발급되지 않아요.
            <br />이 기기 '접수 조회' 탭의 보관함에도 저장해 두었어요.
          </span>
        </footer>
      </article>

      {/* 액션 버튼 */}
      <div className="report-complete__actions rise" style={{ animationDelay: '140ms' }}>
        <button className="btn-primary" onClick={() => navigate(statusPath)}>
          처리 현황 보기
        </button>
        <button className="btn-ghost" onClick={copyLink} aria-live="polite">
          {copied ? '✓ 복사되었어요' : '조회 링크 복사'}
        </button>
        <button className="btn-ghost" onClick={() => navigate('/')}>
          홈으로
        </button>
      </div>
    </div>
  );
}
