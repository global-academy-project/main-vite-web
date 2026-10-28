import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { logout } from '../../api/auth';
import { clearToken, getCurrentUser } from '../../api/client';
import DashboardHeader from '../../components/dashboard-header';
import Sidebar from '../../components/sidebar';
import { getTagEntries, sampleNearMiss } from '../../utils/agentic-rag-tags';
// Styles for job dashboard and job search pages
import '../../style/job/job-dashboard.css';
import '../../style/job/job-search.css';

const sampleWorkers = [
  {
    status: 'ACTIVE',
    name: '김용접',
    jobType: '용접',
    team: { name: '정비팀', teamType: 'INTERNAL' },
    sites: [
      { siteId: 1, name: '울산 공장', active: true },
      { siteId: 2, name: '여수 공장', active: true },
    ],
    qualification: { qualType: 'TRAINING', qualCode: 'CONFINED_SPACE_SPECIAL', qualName: '밀폐공간 특별교육', issuedOn: daysFromToday(-30), expiresOn: null },
  },
  {
    status: 'ACTIVE',
    name: '이감시',
    jobType: '감시인',
    team: { name: '정비팀', teamType: 'INTERNAL' },
    sites: [{ siteId: 1, name: '울산 공장', active: true }],
    qualification: null,
  },
];

function daysFromToday(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
}

function formatDate(value) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
}

const sampleSiteChemical = {
  siteId: 1,
  zoneId: 1,
  casNo: '108-88-3',
  name: '톨루엔',
  maxQuantity: 2000,
  unit: 'L',
  active: true,
};

const sampleWork = { id: 1, siteId: 1, zoneId: 1, workType: 'CONFINED' };

const sampleWarning = {
  siteId: 1,
  workId: sampleWork.id,
  sourceType: 'NEAR_MISS',
  nearMissId: sampleNearMiss.id,
  severity: 'WARN',
  message: '3일 전 같은 구역에서 미끄러짐 아차사고가 있었습니다.',
  acknowledgedBy: 1,
  acknowledgedAt: new Date(),
  ackNote: '맨홀 주변 흡착포 설치',
  acknowledgedByName: '작성자',
};

const sampleCorrectiveAction = {
  siteId: 1,
  sourceType: 'NEAR_MISS',
  sourceId: sampleNearMiss.id,
  title: '맨홀 주변 유출 방지턱 설치',
  assigneeId: 1,
  assigneeName: '작성자',
  dueDate: daysFromToday(7),
  status: 'OPEN',
  createdBy: 2,
};

const nearMissTagEntries = getTagEntries(sampleNearMiss.tags);

function JobDashboard() {
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
        <DashboardHeader
          userInitial={userInitial}
          userName={userName}
          darkMode={darkMode}
          setDarkMode={setDarkMode}
          doLogout={doLogout}
          setSidebarOpen={setSidebarOpen}
          title="작업 현황"
        />
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
            <div className="stat-card"><span>활성 작업자</span><strong>{sampleWorkers.filter((worker) => worker.status === 'ACTIVE').length}<small>명</small></strong></div>
            <div className="stat-card"><span>배치 현장</span><strong>2<small>곳</small></strong></div>
            <div className="stat-card"><span>아차사고 후속 경고</span><strong className="blue">{sampleWarning.acknowledgedAt ? '확인' : '미확인'}</strong></div>
            <div className="stat-card"><span>미완료 개선조치</span><strong className="red">{sampleCorrectiveAction.status === 'OPEN' ? '1' : '0'}<small>건</small></strong></div>
          </section>
          <section className="dashboard-panels safety-panels">
            <div className="panel">
              <h2>작업자 및 현장 배치</h2>
              <div className="table-scroll">
                <table>
                  <thead><tr><th>작업자</th><th>소속</th><th>직종</th><th>활성 현장 배치</th><th>교육·자격</th></tr></thead>
                  <tbody>
                    {sampleWorkers.map((worker) => (
                      <tr key={worker.name}>
                        <td>{worker.name}</td>
                        <td>{worker.team.name}<small className="table-meta">{worker.team.teamType}</small></td>
                        <td>{worker.jobType}</td>
                        <td>{worker.sites.filter((site) => site.active).map((site) => site.name).join(', ')}</td>
                        <td>
                          {worker.qualification ? (
                            <>
                              {worker.qualification.qualName}
                              <small className="table-meta">{worker.qualification.qualType} · {worker.qualification.qualCode}</small>
                              <small className="table-meta">유효기간 {worker.qualification.expiresOn ? formatDate(worker.qualification.expiresOn) : '없음'}</small>
                            </>
                          ) : '등록된 자격 없음'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="sample-note">현장 배치는 worker_sites.active, 작업자 상태는 workers.status 기준입니다.</p>
            </div>
            <div className="panel">
              <h2>현장 취급 물질 <small>site_chemicals</small></h2>
              <div className="detail-list">
                <div><span>물질명</span><strong>{sampleSiteChemical.name}</strong></div>
                <div><span>CAS No.</span><strong>{sampleSiteChemical.casNo}</strong></div>
                <div><span>보관 한도</span><strong>{sampleSiteChemical.maxQuantity.toLocaleString('ko-KR')} {sampleSiteChemical.unit}</strong></div>
                <div><span>관리 위치</span><strong>울산 공장 · T-105</strong></div>
                <div><span>활성 상태</span><strong>{sampleSiteChemical.active ? 'ACTIVE' : 'INACTIVE'}</strong></div>
              </div>
              <h3 className="subheading">작업자 자격</h3>
              <div className="qualification-row">
                <span><strong>김용접 · {sampleWorkers[0].qualification.qualName}</strong><small>{sampleWorkers[0].qualification.qualCode} · 발급 {formatDate(sampleWorkers[0].qualification.issuedOn)} · 만료일 미지정</small></span>
                <span className="pill status-approved">{sampleWorkers[0].qualification.qualType}</span>
              </div>
            </div>
            <div className="panel incident-panel">
              <h2>아차사고 및 작업 경고 <small>near_misses · record_tags · work_warnings</small></h2>
              <div className="incident-heading">
                <span className={`pill ${sampleNearMiss.status === 'CLOSED' ? 'status-approved' : 'status-waiting'}`}>{sampleNearMiss.status}</span>
                <strong>{sampleNearMiss.title}</strong>
                <small>{formatDate(sampleNearMiss.occurredAt)}</small>
              </div>
              <p className="incident-description">{sampleNearMiss.description}</p>
              <div className="incident-tags" aria-label="record_tags 분류 축">
                {nearMissTagEntries.map(({ axis, label, values }) => (
                  <div className="incident-tag-axis" key={axis}>
                    <span>{label}</span>
                    <div className="tag-chip-list">
                      {values.length ? values.map(({ code, label: valueLabel, source, confidence }) => (
                        <span className="tag-chip" key={code} title={`${source}${confidence === null ? '' : ` · 신뢰도 ${Math.round(confidence * 100)}%`}`}>
                          {valueLabel}
                        </span>
                      )) : <span className="tag-unspecified">미분류</span>}
                    </div>
                  </div>
                ))}
              </div>
              {sampleNearMiss.immediateAction && <p className="incident-description">즉시 조치: {sampleNearMiss.immediateAction}</p>}
              <div className="warning-box">
                <strong>{sampleWarning.sourceType} · {sampleWarning.severity} 경고 · 작업 #{sampleWarning.workId}</strong>
                <p>{sampleWarning.message}</p>
                <div className="acknowledgement">
                  <span>{sampleWarning.acknowledgedByName} · {sampleWarning.ackNote}</span>
                  <span className={`pill ${sampleWarning.acknowledgedAt ? 'status-approved' : 'status-waiting'}`}>{sampleWarning.acknowledgedAt ? '확인 완료' : '미확인'}</span>
                </div>
              </div>
            </div>
            <div className="panel">
              <h2>개선조치 <small>corrective_actions</small></h2>
              <div className="action-card">
                <span className="action-icon" aria-hidden="true">!</span>
                <div>
                  <strong>{sampleCorrectiveAction.title}</strong>
                  <p>{sampleCorrectiveAction.sourceType} #{sampleCorrectiveAction.sourceId} 후속 조치 · 담당: {sampleCorrectiveAction.assigneeName}</p>
                  <small>기한 {formatDate(sampleCorrectiveAction.dueDate)}</small>
                </div>
                <span className={`pill ${sampleCorrectiveAction.status === 'OPEN' ? 'status-waiting' : 'status-approved'}`}>{sampleCorrectiveAction.status}</span>
              </div>
            </div>
          </section>
          <p className="scenario-notice">주석 SQL 시나리오 기반 시연 데이터입니다. 실제 작업자·현장 데이터 연동은 아직 적용되지 않았습니다.</p>
        </main>
      </div>
    </div>
  );
}

export default JobDashboard;
