import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { logout } from '../api/auth';
import { clearToken } from '../api/client';
import { useWorkSite } from '../api/workers';
import DashboardHeader from './dashboard-header';
import Sidebar from './sidebar';
import { useTheme } from '../contexts/theme-context';
import '../style/job/job-dashboard.css';

export default function SafetyPageLayout({ title, children }) {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { darkMode, setDarkMode } = useTheme();
  const site = useWorkSite();
  const userName = site.account?.user?.name || site.account?.user?.email || '사용자';

  const doLogout = async () => {
    try { await logout(); } finally {
      clearToken();
      navigate('/signin', { replace: true });
    }
  };

  return (
    <div className="dashboard-shell">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} site={site.currentSite} />
      <div className="dashboard-main">
        <DashboardHeader
          userInitial={Array.from(userName)[0] || '사'}
          userName={userName}
          darkMode={darkMode}
          setDarkMode={setDarkMode}
          doLogout={doLogout}
          setSidebarOpen={setSidebarOpen}
          title={title}
        />
        <main className="dashboard-content">
          {site.error && <p className="dashboard-error" role="alert">{site.error}</p>}
          {children(site)}
        </main>
      </div>
    </div>
  );
}
