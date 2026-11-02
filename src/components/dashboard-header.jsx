import { Link } from 'react-router-dom';
import NotificationBell from './notification-bell';

function DashboardHeader({
  userInitial,
  userName,
  darkMode,
  setDarkMode,
  doLogout,
  setSidebarOpen,
  title = '안전 작업 현황',
}) {
  return (
    <header className="dashboard-header">
      <div className="header-leading">
        <button
          type="button"
          className="mobile-menu-button"
          aria-label="메뉴 열기"
          onClick={() => setSidebarOpen(true)}
        >
          ☰
        </button>
        <div className="breadcrumb">
          <span>AI Safety</span>
          <b>›</b>
          <strong>{title}</strong>
        </div>
      </div>
      <div className="header-actions">
        <button
          type="button"
          className="theme-toggle"
          aria-label={darkMode ? '라이트 모드로 전환' : '다크 모드로 전환'}
          onClick={() => setDarkMode((value) => !value)}
        >
          {darkMode ? '☀' : '☾'}
        </button>
        <NotificationBell />
        <div className="user-info">
          <strong>{userName}</strong>
          <span>사용자</span>
        </div>
        <Link className="dashboard-account-link" to="/me" aria-label="내 계정">
          <span className="avatar">{userInitial}</span>
        </Link>
        <button type="button" className="logout" onClick={doLogout}>
          로그아웃
        </button>
      </div>
    </header>
  );
}

export default DashboardHeader;
