import { Route, Routes } from 'react-router-dom';
import AccessibilityToolbar from './components/AccessibilityToolbar.jsx';
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
    <>
      <AccessibilityToolbar />
      <Routes>
        {/* 시민 신고 흐름: 시작 → 촬영 → 위치 확인 → 완료 */}
        <Route path="/" element={<ReportStart />} />
        <Route path="/report/camera" element={<CameraCapture />} />
        <Route path="/report/location" element={<LocationConfirm />} />
        <Route path="/report/complete" element={<ReportComplete />} />
        <Route path="/status/:receiptNo" element={<ReportStatus />} />
        <Route path="/report/compress" element={<ImageCompressor />} />

        {/* 관리자 콘솔 */}
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/admin/issues/:id" element={<AdminIssueDetail />} />
      </Routes>
    </>
  );
}
