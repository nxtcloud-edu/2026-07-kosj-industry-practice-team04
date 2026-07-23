import { useCallback, useEffect, useState } from 'react';
import { adminStats, getAdminToken, setAdminToken, clearAdminToken } from '../api.js';

/**
 * 관리자 접근 게이트 (Issue #56)
 * ─────────────────────────────────────────────────────
 * 백엔드에 MOA_ADMIN_TOKEN이 설정돼 있으면 관리자 API가 401을 돌려준다.
 * 가벼운 프로브(adminStats)로 인증 필요 여부를 확인하고,
 * 필요하면 토큰 입력 화면을 먼저 보여준다. 토큰은 세션에만 보관한다.
 */
export default function AdminTokenGate({ children }) {
  const [state, setState] = useState('checking'); // checking | need-token | ready | error
  const [input, setInput] = useState('');
  const [message, setMessage] = useState('');

  const probe = useCallback(async () => {
    setState('checking');
    try {
      await adminStats();
      setState('ready');
    } catch (e) {
      if (e.status === 401) {
        clearAdminToken();
        setState('need-token');
      } else {
        setMessage(e.message || '서버에 연결하지 못했습니다.');
        setState('error');
      }
    }
  }, []);

  useEffect(() => { probe(); }, [probe]);

  const submit = useCallback(async (e) => {
    e.preventDefault();
    const token = input.trim();
    if (!token) return;
    setAdminToken(token);
    setMessage('');
    try {
      await adminStats();
      setState('ready');
    } catch (err) {
      clearAdminToken();
      setMessage(err.status === 401 ? '토큰이 올바르지 않습니다.' : (err.message || '확인에 실패했습니다.'));
    }
  }, [input]);

  if (state === 'ready') return children;

  return (
    <div className="admin-shell">
      <main className="admin-gate">
        {state === 'checking' && <div className="spinner" role="status" aria-label="관리자 인증 확인 중" />}

        {state === 'need-token' && (
          <form className="admin-gate__card" onSubmit={submit}>
            <h1 className="admin-gate__title">관리자 콘솔</h1>
            <p className="admin-gate__desc">이 환경은 관리자 토큰이 설정되어 있습니다.<br />담당자에게 전달받은 토큰을 입력해 주세요.</p>
            <label className="admin-gate__label" htmlFor="admin-token">접근 토큰</label>
            <input
              id="admin-token"
              type="password"
              className="admin-gate__input"
              value={input}
              onChange={(e2) => setInput(e2.target.value)}
              autoComplete="off"
              autoFocus
            />
            {message && <p className="admin-gate__error" role="alert">{message}</p>}
            <button type="submit" className="admin-btn teal admin-gate__submit" disabled={!input.trim()}>
              입장하기
            </button>
          </form>
        )}

        {state === 'error' && (
          <div className="admin-gate__card" role="alert">
            <h1 className="admin-gate__title">연결 실패</h1>
            <p className="admin-gate__desc">{message}</p>
            <button type="button" className="admin-btn teal admin-gate__submit" onClick={probe}>다시 시도</button>
          </div>
        )}
      </main>
    </div>
  );
}
