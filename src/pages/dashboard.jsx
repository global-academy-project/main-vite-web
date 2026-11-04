import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { logout } from '../api/auth';
import { sendAndWait } from '../api/agent-chat';
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
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState([]);
  const [conversationId, setConversationId] = useState(null);
  const [chatError, setChatError] = useState('');
  const [sending, setSending] = useState(false);

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

  const submitQuestion = async (event) => {
    event.preventDefault();
    const message = question.trim();
    if (!message || sending) return;
    setMessages((current) => [...current, { role: 'user', text: message }]);
    setQuestion('');
    setChatError('');
    setSending(true);
    try {
      const { conversationId: nextId, run } = await sendAndWait({ message, conversationId });
      console.debug('agent run', run); // 응답 필드 이름 확인용. 확인 뒤 지워도 된다.
      setConversationId(nextId);
      setMessages((current) => [...current, { role: 'assistant', text: agentReply(run) }]);
    } catch (requestError) {
      setChatError(requestError.message || 'AI 답변을 받지 못했습니다.');
    } finally {
      setSending(false);
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
            {messages.length > 0 && <section className="ai-conversation" aria-live="polite" aria-label="AI 대화">
              {messages.map((message, index) => <div className={`ai-message ai-message-${message.role}`} key={`${message.role}-${index}`}>
                <strong>{message.role === 'user' ? '나' : 'AI'}</strong>
                <p>{message.text}</p>
              </div>)}
              {sending && <div className="ai-message ai-message-assistant"><strong>AI</strong><p>답변을 생성하고 있습니다...</p></div>}
            </section>}
            <form className="ai-question-form" onSubmit={submitQuestion}>
              <label className="sr-only" htmlFor="ai-question-input">질문 내용</label>
              <textarea
                id="ai-question-input"
                value={question}
                onChange={(event) => {
                  setQuestion(event.target.value);
                  setChatError('');
                }}
                placeholder="예: 밀폐공간 작업 전 확인해야 할 사항은 무엇인가요?"
                rows={4}
                maxLength={2000}
                disabled={sending}
                required
              />
              <div className="ai-question-form-footer">
                <span>정확한 답변을 위해 작업 상황을 구체적으로 적어 주세요.</span>
                <button type="submit" disabled={!question.trim() || sending}>{sending ? '답변 중...' : '질문하기'} <span aria-hidden="true">↑</span></button>
              </div>
            </form>
            {chatError && <p className="ai-question-notice" role="alert">{chatError}</p>}
            <div className="ai-suggestions">
              <h2>이런 질문을 해보세요</h2>
              <div>
                {suggestedQuestions.map((suggestion) => (
                  <button
                    type="button"
                    key={suggestion}
                    onClick={() => {
                      setQuestion(suggestion);
                      setChatError('');
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

// 실행 결과에서 AI 응답(WorkRegisterResult)을 꺼낸다. 필드 이름은 확인 전이라 여러 후보를 본다.
function extractResult(run) {
  const raw = run?.result ?? run?.output ?? run?.outputJson ?? run?.response ?? run;
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
  return raw;
}

function agentReply(run) {
  if (run?.status === 'FAILED') return 'AI 처리에 실패했습니다. 잠시 후 다시 시도해 주세요.';
  const result = extractResult(run);
  const askText = result?.ask?.message ?? result?.ask?.question ?? run?.askMessage;
  if (askText) return askText;
  const guidance = result?.guidance;
  if (Array.isArray(guidance) && guidance.length) {
    return guidance.map((item) => `${item.title}: ${item.why}`).join('\n');
  }
  if (result?.runStatus === 'DONE') {
    const workTypes = result.classification?.workTypes?.join(', ');
    const approval = result.approvalGate?.canRequest ? '승인 요청 요건을 충족했습니다.' : result.approvalGate?.reasons?.join(' ');
    return [`질문을 분석했습니다${workTypes ? ` (작업 유형: ${workTypes})` : ''}.`, approval].filter(Boolean).join('\n');
  }
  return '질문 처리가 완료됐지만 표시할 답변이 없습니다.';
}

export default Dashboard;