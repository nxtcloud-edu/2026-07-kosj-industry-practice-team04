import { Route, Routes } from 'react-router-dom';
import AdminDashboard from './pages/admin/AdminDashboard.jsx';
import AdminIssueDetail from './pages/admin/AdminIssueDetail.jsx';
import ReportStart from './pages/report/ReportStart.jsx';
import CameraCapture from './pages/report/CameraCapture.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<ReportStart />} />
      <Route path="/report/camera" element={<CameraCapture />} />
      <Route path="/admin" element={<AdminDashboard />} />
      <Route path="/admin/issues/:id" element={<AdminIssueDetail />} />
    </Routes>
  );
}
