import { NavLink, useLocation } from 'react-router-dom';

/**
 * 하단 탭 네비게이션 (멘토 피드백 7/23 — "탭 기반으로 서비스답게")
 * 신고하기 / 내 주변 / 접수 조회 세 탭. 신고 진행 화면에서도 유지되어
 * 언제든 다른 탭으로 이동할 수 있다.
 */

const TABS = [
  {
    to: '/',
    label: '신고하기',
    match: (path) => path === '/' || path.startsWith('/report'),
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.2l1-1.6A2 2 0 0 1 10.4 3.5h3.2a2 2 0 0 1 1.7.9l1 1.6h1.2A2.5 2.5 0 0 1 20 8.5v8A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5v-8Z" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <circle cx="12" cy="12.2" r="3.1" fill="none" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    ),
  },
  {
    to: '/nearby',
    label: '내 주변',
    match: (path) => path.startsWith('/nearby'),
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 21s-6.5-5.4-6.5-10A6.5 6.5 0 0 1 12 4.5 6.5 6.5 0 0 1 18.5 11c0 4.6-6.5 10-6.5 10Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        <circle cx="12" cy="11" r="2.3" fill="none" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    ),
  },
  {
    to: '/lookup',
    label: '접수 조회',
    match: (path) => path.startsWith('/lookup') || path.startsWith('/status'),
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="5" y="3.5" width="14" height="17" rx="2.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <path d="M8.5 8h7M8.5 11.5h7M8.5 15h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    ),
  },
];

export default function BottomTabs() {
  const { pathname } = useLocation();

  return (
    <nav className="tab-bar" aria-label="주요 화면 이동">
      {TABS.map((tab) => {
        const active = tab.match(pathname);
        return (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={`tab-item ${active ? 'is-active' : ''}`}
            aria-current={active ? 'page' : undefined}
          >
            <span className="tab-item__icon">{tab.icon}</span>
            <span className="tab-item__label">{tab.label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}
