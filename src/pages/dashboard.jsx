import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { logout } from '../api/auth';
import { clearToken, getCurrentUser } from '../api/client';
import DashboardHeader from '../components/dashboard-header';
import Sidebar from '../components/sidebar';
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
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('dashboard-theme') === 'dark');
  const [user, setUser] = useState(null);
  const [userError, setUserError] = useState('');
  const [question, setQuestion] = useState('');
  const [questionNotice, setQuestionNotice] = useState('');

  useEffect(() => {
    document.documentElement.classList.toggle('dark-mode', darkMode);
    localStorage.setItem('dashboard-theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  useEffect(() => {
    let cancelled = false;
    getCurrentUser()
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

  const submitQuestion = (event) => {
    event.preventDefault();
    setQuestionNotice('AI 질문 기능은 아직 연결되지 않았습니다. 질문 API가 연결되면 답변을 받을 수 있습니다.');
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
            <form className="ai-question-form" onSubmit={submitQuestion}>
              <label className="sr-only" htmlFor="ai-question-input">질문 내용</label>
              <textarea
                id="ai-question-input"
                value={question}
                onChange={(event) => {
                  setQuestion(event.target.value);
                  setQuestionNotice('');
                }}
                placeholder="예: 밀폐공간 작업 전 확인해야 할 사항은 무엇인가요?"
                rows={4}
                required
              />
              <div className="ai-question-form-footer">
                <span>정확한 답변을 위해 작업 상황을 구체적으로 적어 주세요.</span>
                <button type="submit" disabled={!question.trim()}>질문하기 <span aria-hidden="true">↑</span></button>
              </div>
            </form>
            {questionNotice && <p className="ai-question-notice" role="status">{questionNotice}</p>}
            <div className="ai-suggestions">
              <h2>이런 질문을 해보세요</h2>
              <div>
                {suggestedQuestions.map((suggestion) => (
                  <button
                    type="button"
                    key={suggestion}
                    onClick={() => {
                      setQuestion(suggestion);
                      setQuestionNotice('');
                    }}
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
