import { useEffect, useState } from 'react';
import Sidebar from '../../components/sidebar';
import './job-dashboard.css';

const jobs = [
  ['배관 플랜지 교체', 'R-201', '화기', '승인 차단'],
  ['저장탱크 내부 점검', 'T-105', '밀폐', '승인 대기'],
  ['배관 랙 도장', 'P-03', '고소', '승인'],
  ['펌프 윤활유 교체', 'U-12', '일반', '승인'],
];

const typeClass = { 화기: 'type-hot', 밀폐: 'type-closed', 고소: 'type-height', 일반: 'type-normal' };
const statusClass = { '승인 차단': 'status-blocked', '승인 대기': 'status-waiting', 승인: 'status-approved' };

function Stat({ title, value, unit, className = '' }) {
  return <div className="stat-card"><span>{title}</span><strong className={className}>{value}<small>{unit}</small></strong></div>;
}

export default function JobSearch() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('dashboard-theme') === 'dark');

  useEffect(() => {
    document.documentElement.classList.toggle('dark-mode', darkMode);
    localStorage.setItem('dashboard-theme', darkMode ? 'dark' : 'light');
    return () => document.documentElement.classList.remove('dark-mode');
  }, [darkMode]);

  return (
    <div className="dashboard-shell">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="dashboard-main">
        <header className="dashboard-header">
          <div className="header-leading">
            <button className="mobile-menu-button" onClick={() => setSidebarOpen(true)} aria-label="메뉴 열기">☰</button>
            <div className="breadcrumb"><span>대시보드</span><b>›</b><strong>오늘 현황</strong></div>
          </div>
          <div className="header-actions">
            <button className="theme-toggle" onClick={() => setDarkMode((value) => !value)} aria-label="다크모드 전환">{darkMode ? '☀' : '☾'}</button>
            <button className="notification" aria-label="알림">♧<i>3</i></button>
            <div className="avatar">홍</div>
            <div className="user-info"><strong>홍길동</strong><span>작성자</span></div>
            <button className="logout">⇥ 로그인</button>
          </div>
        </header>
        <main className="dashboard-content">
          <div className="page-heading">
            <h1>오늘 현황</h1>
            <p>
              <span className="date-text">2026-10-26</span>
              <span className="separator">·</span>
              <span className="site-name"><span className="factory-icon">▤</span>울산 2공장</span>
              <span className="separator">·</span>
              <em className="verified-status"><span className="verified-dot">✓</span> 검증됨</em>
            </p>
          </div>
          <section className="stat-grid">
            <Stat title="오늘 등록 작업" value="12" unit="건" />
            <Stat title="승인 대기" value="4" unit="건" className="blue" />
            <Stat title="승인 차단" value="1" unit="건" className="red" />
            <Stat title="TBM 실시율" value="83" unit="%" />
          </section>
          <section className="dashboard-panels">
            <div className="panel jobs-panel">
              <h2>오늘 작업</h2>
              <table><thead><tr><th>작업</th><th>구역</th><th>구분</th><th>상태</th></tr></thead><tbody>
                {jobs.map(([name, area, type, status]) => <tr key={name}><td>{name}</td><td>{area}</td><td><span className={`pill ${typeClass[type]}`}>{type}</span></td><td><span className={`pill ${statusClass[status]}`}>{status}</span></td></tr>)}
              </tbody></table>
            </div>
            <div className="panel tasks-panel">
              <h2>오늘 할 일</h2>
              <ul><li><span>일일 위험성평가</span><b>10 / 12</b></li><li><span>장비·구역 점검</span><b>7 / 9</b></li><li><span>TBM 실시 기록</span><b>10 / 12</b></li><li><span>일일 안전일지</span><mark>작성 전</mark></li></ul>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
