import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { logout } from '../../api/auth';
import { clearToken, getCurrentUser } from '../../api/client';
import Sidebar from '../../components/sidebar';
import '../../style/job/job-dashboard.css';

const sampleWorkers = [
  { name: '김용접', jobType: '용접', team: '정비팀', sites: ['울산 공장', '여수 공장'], qualification: '밀폐공간 특별교육' },
  { name: '이감시', jobType: '감시인', team: '정비팀', sites: ['울산 공장'], qualification: '등록된 자격 없음' },
];

function daysFromToday(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
}

function formatDate(value) {
  return value.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
}
function JobSearch() {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('dashboard-theme') === 'dark');
  const [user, setUser] = useState(null);
  const [userError, setUserError] = useState('');
  const [loadingUser, setLoadingUser] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const today = new Date();
  const dateText = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  useEffect(() => {
    document.documentElement.classList.toggle('dark-mode', darkMode);
    localStorage.setItem('dashboard-theme', darkMode ? 'dark' : 'light');
    return () => document.documentElement.classList.remove('dark-mode');
  }, [darkMode]);

  useEffect(() => {
    let cancelled = false;

    getCurrentUser()
      .then((currentUser) => {
        if (cancelled) return;
        setUser(currentUser);
        setUserError('');
      })
      .catch((requestError) => {
        if (!cancelled) {
          setUserError(requestError.message || '사용자 정보를 불러오지 못했습니다.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingUser(false);
      });

    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const userName = user?.user?.name || user?.user?.email || '사용자';
  const userInitial = Array.from(userName)[0] || '사';
  const userFactory = user?.sites?.map((site) => site.name).join(' · ') || '등록 현장 없음';

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
        <header className="dashboard-header">
          <div className="header-leading">
            <button className="mobile-menu-button" onClick={() => setSidebarOpen(true)} aria-label="메뉴 열기">☰</button>
            <div className="breadcrumb"><span>대시보드</span><b>›</b><strong>안전 작업 현황</strong></div>
          </div>
          <div className="header-actions">
            <button className="notification" aria-label="알림">♧<i>3</i></button>
            <button className="theme-toggle" onClick={() => setDarkMode((value) => !value)} aria-label="다크모드 전환">{darkMode ? '☀' : '☾'}</button>
            <Link className="dashboard-account-link" to="/me" aria-label="내 정보">
              <div className="avatar" aria-hidden="true">{userInitial}</div>
            </Link>
            <div className="user-info"><strong>{userName}</strong><span>로그인 사용자</span></div>
            <button
              className="logout"
              onClick={doLogout}
            >
              ⇥ 로그아웃
            </button>
          </div>
        </header>
        <main className="dashboard-content">
          <div className="page-heading">
            <h1>안전 작업 현황</h1>
            <p>
              <span className="date-text">{dateText}</span>
              <span className="separator">·</span>
              <span className="site-name"><span className="factory-icon">▣</span>{userFactory}</span>
            </p>
          </div>
          {userError && (
            <div className="dashboard-error" role="alert">
              <span>{userError}</span>
              <button
                type="button"
                onClick={() => {
                  setLoadingUser(true);
                  setUserError('');
                  setRefreshKey((value) => value + 1);
                }}
              >
                다시 시도
              </button>
            </div>
          )}
          {loadingUser && <p className="dashboard-message" role="status">사용자 정보를 불러오는 중입니다...</p>}
          <section className="stat-grid" aria-label="안전관리 요약">
            <div className="stat-card"><span>등록 작업자</span><strong>{sampleWorkers.length}<small>명</small></strong></div>
            <div className="stat-card"><span>배치 현장</span><strong>2<small>곳</small></strong></div>
            <div className="stat-card"><span>아차사고 후속 경고</span><strong className="blue">1<small>건</small></strong></div>
            <div className="stat-card"><span>예정 개선조치</span><strong className="red">1<small>건</small></strong></div>
          </section>
          <section className="dashboard-panels safety-panels">
            <div className="panel">
              <h2>작업자 및 현장 배치 <small>정비팀 · INTERNAL</small></h2>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr><th>작업자</th><th>직종</th><th>배치 현장</th><th>교육·자격</th></tr>
                  </thead>
                  <tbody>
                    {sampleWorkers.map((worker) => (
                      <tr key={worker.name}>
                        <td>{worker.name}</td>
                        <td>{worker.jobType}</td>
                        <td>{worker.sites.join(', ')}</td>
                        <td>{worker.qualification}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="sample-note">김용접은 울산 공장 배치를 유지하면서 여수 공장에도 지원 배치된 시나리오입니다.</p>
            </div>
            <div className="panel">
              <h2>현장 유해화학물질</h2>
              <div className="detail-list">
                <div><span>물질명</span><strong>톨루엔</strong></div>
                <div><span>CAS No.</span><strong>108-88-3</strong></div>
                <div><span>보관 한도</span><strong>2,000 L</strong></div>
                <div><span>관리 위치</span><strong>울산 공장 · 지정 구역</strong></div>
              </div>
              <h3 className="subheading">작업자 자격</h3>
              <div className="qualification-row">
                <span><strong>김용접</strong><small>밀폐공간 특별교육 · 유효기간 제한 없음</small></span>
                <span className="pill status-approved">확인됨</span>
              </div>
            </div>
            <div className="panel incident-panel">
              <h2>아차사고 및 작업 경고 <small>near_misses · work_warnings</small></h2>
              <div className="incident-heading">
                <span className="pill status-blocked">아차사고</span>
                <strong>탱크 맨홀 근처 미끄러짐</strong>
                <small>{formatDate(daysFromToday(-3))}</small>
              </div>
              <p className="incident-description">맨홀 주변 기름 유출로 미끄러질 뻔함</p>
              <div className="warning-box">
                <strong>동일 구역 작업 경고</strong>
                <p>3일 전 같은 구역에서 미끄러짐 아차사고가 있었습니다.</p>
                <div className="acknowledgement"><span>작성자 확인 · 맨홀 주변 흡착포 설치</span><span className="pill status-approved">확인 완료</span></div>
              </div>
            </div>
            <div className="panel">
              <h2>개선조치</h2>
              <div className="action-card">
                <span className="action-icon" aria-hidden="true">!</span>
                <div>
                  <strong>맨홀 주변 유출 방지턱 설치</strong>
                  <p>아차사고 후속 조치 · 담당: 작성자</p>
                  <small>기한 {formatDate(daysFromToday(7))}</small>
                </div>
                <span className="pill status-waiting">진행 예정</span>
              </div>
            </div>
          </section>
          <p className="scenario-notice">주석 SQL 시나리오 기반 시연 데이터입니다. 실제 작업자·현장 데이터 연동은 아직 적용되지 않았습니다.</p>
        </main>
      </div>
    </div>
  );
}

export default JobSearch;
