import { useCallback, useEffect, useState } from 'react';
import { Link, Outlet, Route, Routes } from 'react-router-dom';
import { health } from './api.js';
import AccessibilityToolbar from './components/AccessibilityToolbar.jsx';
import BottomTabs from './components/BottomTabs.jsx';
import AdminTokenGate from './components/AdminTokenGate.jsx';
import AdminDashboard from './pages/admin/AdminDashboard.jsx';
import AdminIssueDetail from './pages/admin/AdminIssueDetail.jsx';
import ReportStart from './pages/report/ReportStart.jsx';
import CameraCapture from './pages/report/CameraCapture.jsx';
import ImageCompressor from './pages/report/ImageCompressor.jsx';
import LocationConfirm from './pages/report/LocationConfirm.jsx';
import ReportComplete from './pages/report/ReportComplete.jsx';
import ReportStatus from './pages/status/ReportStatus.jsx';
import StatusLookup from './pages/status/StatusLookup.jsx';
import NearbyMap from './pages/nearby/NearbyMap.jsx';

/**
 * 시민 쪽 공통 쉘 — 브랜드 헤더 + 접근성 바 + 하단 탭 (멘토 피드백 7/23)
 * 관리자 콘솔은 자체 상단바를 쓰므로 접근성 바만 얹는다.
 * 백엔드에 닿지 못하면(배포된 화면에 API 서버가 없는 경우 등) 안내 배너를 띄운다.
 */
function CitizenLayout() {
  const [serverDown, setServerDown] = useState(false);
  const [checking, setChecking] = useState(false);

  const checkServer = useCallback(async () => {
    setChecking(true);
    try {
      await health();
      setServerDown(false);
    } catch {
      setServerDown(true);
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => { checkServer(); }, [checkServer]);

  return (
    <div className="app-shell">
      <header className="app-header">
        <Link to="/" className="app-brand" aria-label="모아 홈으로">
          <span className="app-brand__mark" aria-hidden="true">모아</span>
          <span className="app-brand__desc">생활 불편 신고</span>
        </Link>
        <Link to="/admin" className="app-header__admin">관리자</Link>
      </header>
      <AccessibilityToolbar />
      {serverDown && (
        <div className="app-offline" role="alert">
          <span>
            지금은 서버에 연결할 수 없어 신고 접수·조회가 어려워요.
            화면 둘러보기는 가능합니다.
          </span>
          <button type="button" onClick={checkServer} disabled={checking}>
            {checking ? '확인 중…' : '다시 연결'}
          </button>
        </div>
      )}
      <main className="app-main">
        <Outlet />
      </main>
      <BottomTabs />
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      {/* 시민: 탭 쉘 안에서 신고 → 내 주변 → 조회가 오간다 */}
      <Route element={<CitizenLayout />}>
        <Route path="/" element={<ReportStart />} />
        <Route path="/report/camera" element={<CameraCapture />} />
        <Route path="/report/location" element={<LocationConfirm />} />
        <Route path="/report/complete" element={<ReportComplete />} />
        <Route path="/nearby" element={<NearbyMap />} />
        <Route path="/lookup" element={<StatusLookup />} />
        <Route path="/status/:receiptNo" element={<ReportStatus />} />
        <Route path="/report/compress" element={<ImageCompressor />} />
      </Route>

      {/* 관리자 콘솔 — 토큰 게이트(#56) 안쪽 */}
      <Route
        path="/admin"
        element={(
          <>
            <AccessibilityToolbar />
            <AdminTokenGate><AdminDashboard /></AdminTokenGate>
          </>
        )}
      />
      <Route
        path="/admin/issues/:id"
        element={(
          <>
            <AccessibilityToolbar />
            <AdminTokenGate><AdminIssueDetail /></AdminTokenGate>
          </>
        )}
      />
    </Routes>
  );
}
