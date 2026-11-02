import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { logout } from '../api/auth';
import { clearToken } from '../api/client';
import { getCachedCurrentUser } from '../api/workers';
import DashboardHeader from '../components/dashboard-header';
import Sidebar from '../components/sidebar';
import { useTheme } from '../contexts/theme-context';
import '../style/job/job-dashboard.css';
import '../style/job/job-search.css';

const suggestedQuestions = [
  '작업 전 안전 점검 항목을 알려줘',
  '밀폐공간 작업 시 필요한 안전 조치는?',
  '아차사고 발생 후 무엇을 해야 하나요?',
];

function Dashboard() {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { darkMode, setDarkMode } = useTheme();
  const [user, setUser] = useState(null);
  const [userError, setUserError] = useState('');

  useEffect(() => {
    let cancelled = false;
    getCachedCurrentUser()
      .then((currentUser) => {
        if (!cancelled) setUser(currentUser);
      })
      .catch((requestError) => {
        if (!cancelled) setUserError(requestError.message || '사용자 정보를 불러오지 못했습니다.');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const userName = user?.user?.name || user?.user?.email || '사용자';
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
    <div className="dashboard-shell">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="dashboard-main">
        <DashboardHeader
          userInitial={userInitial}
          userName={userName}
          darkMode={darkMode}
          setDarkMode={setDarkMode}
          doLogout={doLogout}
          setSidebarOpen={setSidebarOpen}
          title="AI 질문"
        />
        <main className="dashboard-content ai-dashboard-content">
          {userError && <p className="ai-user-error" role="alert">{userError}</p>}
          <section className="ai-assistant">
            <span className="ai-assistant-mark" aria-hidden="true">AI</span>
            <p className="ai-assistant-eyebrow">AI SAFETY ASSISTANT</p>
            <h1>안전관리, 무엇이 궁금하세요?</h1>
            <p className="ai-assistant-description">작업과 현장 안전에 관한 질문을 입력해 주세요.</p>
            <p className="ai-assistant-description">기록 질문은 작업 등록·조회 화면의 기록 질문 탭에서 진행합니다.</p>
            <button type="button" className="job-link-button" onClick={() => navigate('/job/workspace?tab=records')}>기록 질문으로 이동 <span aria-hidden="true">→</span></button>
            <div className="ai-suggestions">
              <h2>이런 질문을 해보세요</h2>
              <div>
                {suggestedQuestions.map((suggestion) => (
                  <button
                    type="button"
                    key={suggestion}
                    onClick={() => navigate('/job/workspace?tab=records')}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}

export default Dashboard;
