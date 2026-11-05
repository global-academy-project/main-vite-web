import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { logout } from '../api/auth';
import { clearToken } from '../api/client';
import DashboardHeader from './dashboard-header';
import PageHeader from './ui/page-header.jsx';
import Sidebar from './sidebar';
import { useTheme } from '../contexts/theme-context';
import '../style/job/job-dashboard.css';
import '../style/job/job-search.css';
import '../style/job/job-management.css';
import '../style/job/job-pages.css';

/**
 * 예전 화면들이 쓰는 머리. 이제 공통 페이지 머리(PageHeader)를 그대로 그려 모든 화면이 같은 자리·같은 모양이 된다.
 * context(useWorkSite 결과)를 넘기면 오른쪽 맨 앞에 현장 선택이 붙는다. eyebrow 는 더 이상 표시하지 않는다.
 */
export function JobPageHeading({ title, description, actions, children, className = '', context, onBeforeSelect, badges }) {
  return (
    <div className={`job-page-heading ${className}`.trim()}>
      <PageHeader title={title} description={description} actions={actions} context={context} onBeforeSelect={onBeforeSelect} badges={badges}>{children}</PageHeader>
    </div>
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
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} onOpen={() => setSidebarOpen(true)} />
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
          {children}
        </main>
      </div>
    </div>
  );
}
