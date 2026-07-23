import { Link, useNavigate } from 'react-router-dom';
import './report.css';

/**
 * 홈 · 신고 시작 (/ 경로)
 * 서비스의 얼굴 — 큰 신고 버튼과 3단계 안내, 다른 탭으로 가는 지름길.
 */

const STEPS = [
  { icon: '📷', title: '사진 촬영', desc: 'AI가 유형을 바로 분류해요' },
  { icon: '📍', title: '위치 확인', desc: '지도에서 핀만 맞추면 끝' },
  { icon: '🧾', title: '접수 완료', desc: '접수증으로 끝까지 추적' },
];

export default function ReportStart() {
  const navigate = useNavigate();

  return (
    <div className="home-page">
      <section className="home-hero rise">
        <p className="home-hero__eyebrow">앱 설치 · 로그인 없이</p>
        <h1 className="home-hero__title">
          불편한 순간,
          <br />
          사진 한 장이면 돼요
        </h1>
        <p className="home-hero__desc">
          도로 파손 · 가로등 고장 · 쓰레기 무단투기 —
          <br />
          같은 신고는 하나로 모아 더 빨리 처리합니다.
        </p>
        <button className="btn-primary home-hero__cta" onClick={() => navigate('/report/camera')}>
          📷 사진으로 신고하기
        </button>
      </section>

      <section className="home-steps rise" aria-label="신고 절차 3단계" style={{ animationDelay: '80ms' }}>
        {STEPS.map((s, i) => (
          <div className="home-step" key={s.title}>
            <span className="home-step__no" aria-hidden="true">{i + 1}</span>
            <span className="home-step__icon" aria-hidden="true">{s.icon}</span>
            <b className="home-step__title">{s.title}</b>
            <span className="home-step__desc">{s.desc}</span>
          </div>
        ))}
      </section>

      <section className="home-links rise" style={{ animationDelay: '140ms' }}>
        <Link className="home-link" to="/nearby">
          <span className="home-link__icon" aria-hidden="true">🗺️</span>
          <span className="home-link__body">
            <b>내 주변 신고 보기</b>
            <small>이미 접수된 문제라면 공감으로 힘 보태기</small>
          </span>
          <span className="home-link__arrow" aria-hidden="true">→</span>
        </Link>
        <Link className="home-link" to="/lookup">
          <span className="home-link__icon" aria-hidden="true">🔎</span>
          <span className="home-link__body">
            <b>접수 조회</b>
            <small>접수번호로 처리 현황 확인</small>
          </span>
          <span className="home-link__arrow" aria-hidden="true">→</span>
        </Link>
      </section>

      <p className="home-foot rise" style={{ animationDelay: '200ms' }}>
        위치·사진은 신고 처리 목적에만 쓰이고, 처리 완료 후 보관 기간이 지나면 자동 삭제됩니다.
      </p>
    </div>
  );
}
