import { Link, useLocation } from 'react-router-dom';
import NotificationBell from './notification-bell';
import { crumbFor } from './app-shell/nav-config.js';
import { HEADER_SITE_SLOT } from './app-shell/header-slot.js';
import Icon from './ui/icon.jsx';

/** 화면 머리 위 줄. 화면 자리(작업 › 작업 목록) · 다크 모드 · 알림 · 현장 선택(각 화면의 PageHeader 가 이 자리에 그린다).
 * 이름·로그아웃은 왼쪽 메뉴 맨 아래로 옮겼다. 휴대폰에서는 메뉴가 숨겨져 있어 머리에 내 계정 동그라미를 남긴다. */
function DashboardHeader({
  userInitial,
  darkMode,
  setDarkMode,
  setSidebarOpen,
  title = '안전 작업 현황',
}) {
  const { pathname } = useLocation();
  const crumb = crumbFor(pathname) ?? [title];
  return (
    <header className="dashboard-header">
      <div className="header-leading">
        <button
          type="button"
          className="mobile-menu-button"
          aria-label="메뉴 열기"
          onClick={() => setSidebarOpen(true)}
        >
          <Icon name="menu" size={20} />
        </button>
        <nav className="breadcrumb" aria-label="화면 위치">
          {crumb.map((label, index) => (
            index < crumb.length - 1
              ? <span key={label}>{label}<b aria-hidden="true">›</b></span>
              : <strong key={label} aria-current="page">{label}</strong>
          ))}
        </nav>
      </div>
      <div className="header-actions">
        <button
          type="button"
          className="theme-toggle"
          aria-label={darkMode ? '라이트 모드로 전환' : '다크 모드로 전환'}
          onClick={() => setDarkMode((value) => !value)}
        >
          <Icon name={darkMode ? 'sun' : 'moon'} size={18} />
        </button>
        <NotificationBell />
        <div className="header-site" id={HEADER_SITE_SLOT} />
        <Link className="dashboard-account-link" to="/me" aria-label="내 계정">
          <span className="avatar">{userInitial}</span>
        </Link>
      </div>
    </header>
  );
}

export default DashboardHeader;
