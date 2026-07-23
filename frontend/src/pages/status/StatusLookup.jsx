import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './status.css';

/**
 * 접수 조회 탭 — 접수번호 + 조회 토큰으로 처리 현황을 찾는다.
 * 이 기기에서 접수한 신고는 '내 신고 보관함'(localStorage)에서 바로 연다.
 */

const RECEIPT_PATTERN = /^MOA-\d{8}-\d{5}$/;
const TOKEN_PATTERN = /^[a-f0-9]{32}$/;

export function loadMyReports() {
  try {
    const saved = JSON.parse(window.localStorage.getItem('moa-my-reports'));
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

export default function StatusLookup() {
  const navigate = useNavigate();
  const [receiptNo, setReceiptNo] = useState('');
  const [token, setToken] = useState('');
  const [touched, setTouched] = useState(false);
  const myReports = useMemo(loadMyReports, []);

  const receiptOk = RECEIPT_PATTERN.test(receiptNo.trim().toUpperCase());
  const tokenOk = TOKEN_PATTERN.test(token.trim().toLowerCase());

  const submit = (e) => {
    e.preventDefault();
    setTouched(true);
    if (!receiptOk || !tokenOk) return;
    navigate(`/status/${receiptNo.trim().toUpperCase()}?token=${token.trim().toLowerCase()}`);
  };

  return (
    <div className="lookup-page">
      <header className="page-head">
        <h1 className="page-head__title">접수 조회</h1>
        <p className="page-head__sub">로그인 없이 접수번호와 조회 토큰만으로 확인합니다.</p>
      </header>

      {myReports.length > 0 && (
        <section className="my-reports" aria-label="이 기기에서 접수한 신고">
          <h2 className="my-reports__heading">내 신고 보관함</h2>
          {myReports.map((r) => (
            <button
              key={r.receiptNo}
              type="button"
              className="my-reports__item"
              onClick={() => navigate(`/status/${r.receiptNo}?token=${r.token}`)}
            >
              <b>{r.receiptNo}</b>
              <span>{new Date(r.at).toLocaleDateString('ko-KR')} 접수 · 현황 보기 →</span>
            </button>
          ))}
        </section>
      )}

      <form className="lookup-form" onSubmit={submit}>
        <label className="lookup-form__label" htmlFor="lookup-receipt">접수번호</label>
        <input
          id="lookup-receipt"
          className="lookup-form__input"
          placeholder="MOA-20260723-12345"
          value={receiptNo}
          onChange={(e) => setReceiptNo(e.target.value)}
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck="false"
        />
        {touched && !receiptOk && (
          <p className="lookup-form__hint" role="alert">MOA-날짜-숫자 5자리 형식이에요. 예) MOA-20260723-12345</p>
        )}

        <label className="lookup-form__label" htmlFor="lookup-token">조회 토큰</label>
        <input
          id="lookup-token"
          className="lookup-form__input"
          placeholder="신고 완료 화면에 표시된 32자리 코드"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          autoComplete="off"
          spellCheck="false"
        />
        {touched && !tokenOk && (
          <p className="lookup-form__hint" role="alert">조회 토큰은 32자리 영문·숫자 코드입니다.</p>
        )}

        <button type="submit" className="btn-primary lookup-form__submit">처리 현황 보기</button>
        <p className="lookup-form__note">
          조회 토큰은 신고자 보호를 위해 재발급되지 않아요. 링크를 잃어버렸다면 접수번호로 담당 기관에 문의해 주세요.
        </p>
      </form>
    </div>
  );
}
