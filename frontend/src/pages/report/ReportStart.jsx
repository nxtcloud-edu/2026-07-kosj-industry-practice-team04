import { useNavigate } from 'react-router-dom';
import './report.css';

/**
 * 시민 신고 시작 화면 (/ 경로)
 * "사진 촬영" 버튼을 누르면 카메라 화면으로 이동한다.
 */
export default function ReportStart() {
  const navigate = useNavigate();

  return (
    <div className="report-page">
      <h1 className="report-start__title">불법 주정차 신고</h1>
      <p className="report-start__desc">
        불법 주정차 차량을 촬영하여 간편하게 신고하세요.
        <br />
        촬영된 사진은 AI가 자동으로 분석합니다.
      </p>
      <button
        className="report-start__btn"
        onClick={() => navigate('/report/camera')}
      >
        📷 사진 촬영하기
      </button>
    </div>
  );
}
