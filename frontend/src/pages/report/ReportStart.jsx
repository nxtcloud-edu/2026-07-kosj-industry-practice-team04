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
      <h1 className="report-start__title">생활 불편 신고</h1>
      <p className="report-start__desc">
        도로 파손, 가로등 고장, 쓰레기 무단투기를 사진으로 신고하세요.
        <br />
        촬영한 사진은 AI가 자동으로 유형을 분류합니다.
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
