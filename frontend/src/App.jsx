import { Link, Route, Routes } from 'react-router-dom';
import AdminDashboard from './pages/admin/AdminDashboard.jsx';
import AdminIssueDetail from './pages/admin/AdminIssueDetail.jsx';
import LocationConfirm from './pages/report/LocationConfirm.jsx';

// 관리자 콘솔 라우팅.
// 시민 화면(/, /status/:receiptNo)은 FE 팀 PR에서 이 App에 라우트를 추가한다.
function Home() {
  return (
    <div className="home-placeholder">
      <h1>모아 관리자 콘솔</h1>
      <p>시민 신고 화면은 별도 PR(FE)에서 제공됩니다.</p>
      <Link className="home-cta" to="/admin">
        관리자 대시보드 열기 →
      </Link>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/report/location" element={<LocationConfirm />} />
      <Route path="/admin" element={<AdminDashboard />} />
      <Route path="/admin/issues/:id" element={<AdminIssueDetail />} />
    </Routes>
  );
}
