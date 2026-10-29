import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { logout } from '../api/auth';
import { clearToken } from '../api/client';
import DashboardHeader from './dashboard-header';
import Sidebar from './sidebar';
import { useTheme } from '../contexts/theme-context';
import '../style/job/job-dashboard.css';
import '../style/job/job-search.css';
import '../style/job/job-management.css';
import '../style/job/job-pages.css';

export function JobPageHeading({ title, description, eyebrow, actions, children, className = '' }) {
  return (
    <header className={`page-heading job-page-heading ${className}`.trim()}>
      <div>
        {eyebrow ?? <span className="job-eyebrow">SITE OPERATIONS</span>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
        {children}
      </div>
      {actions && <div className="job-page-heading-actions">{actions}</div>}
    </header>
  );
}

export default function JobPageLayout({
  title,
  user,
  contentClassName = '',
  children,
}) {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { darkMode, setDarkMode } = useTheme();
  const userName = user?.name || user?.email || '사용자';
  const userInitial = Array.from(userName)[0] || '사';

  const doLogout = async () => {
    try {
      await logout();
    } finally {
      clearToken();
      navigate('/signin', { replace: true });
    }
  };

  return (
    <div className="dashboard-shell job-pages">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="dashboard-main">
        <DashboardHeader
          userInitial={userInitial}
          userName={userName}
          darkMode={darkMode}
          setDarkMode={setDarkMode}
          doLogout={doLogout}
          setSidebarOpen={setSidebarOpen}
          title={title}
        />
        <main className={`dashboard-content job-page-content ${contentClassName}`.trim()}>
          <div className="job-home-bar">
            <Link to="/dashboard"><span aria-hidden="true">←</span> 대시보드 · AI 질문 홈</Link>
            <span>현장 업무 관리</span>
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}
