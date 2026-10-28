import { Link } from 'react-router-dom';

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
        <button type="button" className="notification" aria-label="GitHub 알림함">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 4.75h16l1 10.5h-5l-2 3h-4l-2-3H3l1-10.5Z" />
            <path d="M3.5 12.25h4l1.5 2h6l1.5-2h4" />
          </svg>
        </button>
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
