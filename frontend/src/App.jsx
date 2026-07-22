import { Route, Routes } from 'react-router-dom';
import AdminDashboard from './pages/admin/AdminDashboard.jsx';
import AdminIssueDetail from './pages/admin/AdminIssueDetail.jsx';
import ReportStart from './pages/report/ReportStart.jsx';
import CameraCapture from './pages/report/CameraCapture.jsx';
import ImageCompressor from './pages/report/ImageCompressor.jsx';
import LocationConfirm from './pages/report/LocationConfirm.jsx';
import ReportComplete from './pages/report/ReportComplete.jsx';
import ReportStatus from './pages/status/ReportStatus.jsx';

export default function App() {
  return (
    <Routes>
      {/* 시민 신고 흐름: 시작 → 촬영 → 위치 확인 → 완료 */}
      <Route path="/" element={<ReportStart />} />
      <Route path="/report/camera" element={<CameraCapture />} />
      <Route path="/report/location" element={<LocationConfirm />} />
      <Route path="/report/complete" element={<ReportComplete />} />
      {/* 무로그인 처리 상태 조회 */}
      <Route path="/status/:receiptNo" element={<ReportStatus />} />
      {/* 압축 동작 확인용 개발 화면 — 실제 신고에서는 CameraCapture가 자동 압축한다 */}
      <Route path="/report/compress" element={<ImageCompressor />} />

      {/* 관리자 콘솔 */}
      <Route path="/admin" element={<AdminDashboard />} />
      <Route path="/admin/issues/:id" element={<AdminIssueDetail />} />
    </Routes>
  );
}
