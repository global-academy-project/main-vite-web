import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { clearToken, getCurrentUser } from '../../api/client';
import { getDocuments } from '../../api/documents';
import Sidebar from '../../components/sidebar';
import '../../style/job/job-dashboard.css';

const PAGE_SIZE = 50;

const documentStatusLabels = {
  UPLOADED: '업로드 완료',
  PROCESSING: '처리 중',
  DONE: '처리 완료',
  FAILED: '처리 실패',
};

const documentStatusClass = {
  UPLOADED: 'status-uploaded',
  PROCESSING: 'status-processing',
  DONE: 'status-done',
  FAILED: 'status-failed',
};

const documentStatusOrder = ['UPLOADED', 'PROCESSING', 'DONE', 'FAILED'];

function Stat({ title, value, unit, className = '' }) {
  return <div className="stat-card"><span>{title}</span><strong className={className}>{value}<small>{unit}</small></strong></div>;
}

function formatDocumentStatus(status) {
  return documentStatusLabels[status] ?? status ?? '상태 없음';
}

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('ko-KR');
}

export default function JobSearch() {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('dashboard-theme') === 'dark');
  const [user, setUser] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [totalDocuments, setTotalDocuments] = useState(0);
  const [loadedKey, setLoadedKey] = useState('');
  const [loadError, setLoadError] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const requestKey = String(refreshKey);
  const loading = loadedKey !== requestKey;
  const error = loadError?.key === requestKey ? loadError.message : '';
  const today = new Date();
  const dateText = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  useEffect(() => {
    document.documentElement.classList.toggle('dark-mode', darkMode);
    localStorage.setItem('dashboard-theme', darkMode ? 'dark' : 'light');
    return () => document.documentElement.classList.remove('dark-mode');
  }, [darkMode]);

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      getCurrentUser(),
      getDocuments({ page: 0, size: PAGE_SIZE, sort: 'createdAt,desc' }),
    ])
      .then(([currentUser, result]) => {
        if (cancelled) return;
        if (!Array.isArray(result?.content)) {
          throw new Error('문서 목록 응답 형식이 올바르지 않습니다.');
        }
        setUser(currentUser);
        setDocuments(result.content);
        setTotalDocuments(result.totalElements);
        setLoadError(null);
      })
      .catch((requestError) => {
        if (!cancelled) {
          setLoadError({
            key: requestKey,
            message: requestError.message || '현황 데이터를 불러오지 못했습니다.',
          });
        }
      })
      .finally(() => {
        if (!cancelled) setLoadedKey(requestKey);
      });

    return () => {
      cancelled = true;
    };
  }, [refreshKey, requestKey]);

  const statusCounts = documentStatusOrder.reduce((counts, status) => {
    counts[status] = documents.filter((item) => item.status === status).length;
    return counts;
  }, {});
  const userName = user?.name || user?.email || '사용자';
  const userInitial = Array.from(userName)[0];

  return (
    <div className="dashboard-shell">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="dashboard-main">
        <header className="dashboard-header">
          <div className="header-leading">
            <button className="mobile-menu-button" onClick={() => setSidebarOpen(true)} aria-label="메뉴 열기">☰</button>
            <div className="breadcrumb"><span>대시보드</span><b>›</b><strong>문서 현황</strong></div>
          </div>
          <div className="header-actions">
            <button className="theme-toggle" onClick={() => setDarkMode((value) => !value)} aria-label="다크모드 전환">{darkMode ? '☀' : '☾'}</button>
            <div className="avatar" aria-hidden="true">{userInitial}</div>
            <div className="user-info"><strong>{userName}</strong><span>로그인 사용자</span></div>
            <button
              className="logout"
              onClick={() => {
                clearToken();
                navigate('/signin', { replace: true });
              }}
            >
              ⇥ 로그아웃
            </button>
          </div>
        </header>
        <main className="dashboard-content">
          <div className="page-heading">
            <h1>문서 현황</h1>
            <p>
              <span className="date-text">{dateText}</span>
              <span className="separator">·</span>
              <span className="site-name">{user?.email || '내 문서'}</span>
            </p>
          </div>
          {error && (
            <div className="dashboard-error" role="alert">
              <span>{error}</span>
              <button type="button" onClick={() => setRefreshKey((value) => value + 1)}>다시 시도</button>
            </div>
          )}
          {loading ? (
            <p className="dashboard-message" role="status">서버에서 문서 현황을 불러오는 중입니다...</p>
          ) : !error && (
            <>
              <section className="stat-grid" aria-label="문서 처리 통계">
                <Stat title="전체 문서" value={totalDocuments} unit="건" />
                <Stat title={`최근 ${PAGE_SIZE}건 처리 중`} value={statusCounts.PROCESSING} unit="건" className="blue" />
                <Stat title={`최근 ${PAGE_SIZE}건 처리 완료`} value={statusCounts.DONE} unit="건" />
                <Stat title={`최근 ${PAGE_SIZE}건 처리 실패`} value={statusCounts.FAILED} unit="건" className="red" />
              </section>
              <section className="dashboard-panels">
                <div className="panel jobs-panel">
                  <h2>최근 업로드 문서</h2>
                  {documents.length === 0 ? (
                    <p className="dashboard-message">아직 업로드한 문서가 없습니다.</p>
                  ) : (
                    <table>
                      <thead>
                        <tr>
                          <th>문서</th>
                          <th>페이지</th>
                          <th>OCR 엔진</th>
                          <th>처리 상태</th>
                        </tr>
                      </thead>
                      <tbody>
                        {documents.slice(0, 8).map((item) => (
                          <tr key={item.documentId}>
                            <td>
                              <button
                                className="document-link"
                                type="button"
                                onClick={() => navigate(`/documents/${item.documentId}`)}
                              >
                                {item.originalName}
                              </button>
                              <small className="document-date">{formatDate(item.createdAt)}</small>
                            </td>
                            <td>{item.pageCount ?? '-'}</td>
                            <td>{item.latestEngine ?? '-'}</td>
                            <td>
                              <span className={`pill ${documentStatusClass[item.status] ?? ''}`}>
                                {formatDocumentStatus(item.status)}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
                <div className="panel tasks-panel">
                  <h2>처리 상태 <small>(최근 {documents.length}건)</small></h2>
                  <ul>
                    {documentStatusOrder.map((status) => (
                      <li key={status}>
                        <span>{formatDocumentStatus(status)}</span>
                        <b>{statusCounts[status]}건</b>
                      </li>
                    ))}
                  </ul>
                </div>
              </section>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
