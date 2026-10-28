import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { logout } from '../../api/auth';
import { clearToken, getCurrentUser } from '../../api/client';
import DashboardHeader from '../../components/dashboard-header';
import Sidebar from '../../components/sidebar';
import { useTheme } from '../../contexts/theme-context';
import '../../style/job/job-dashboard.css';
import '../../style/job/job-search.css';

const EMPTY_SITES = [];

function JobSearch() {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { darkMode, setDarkMode } = useTheme();
  const [user, setUser] = useState(null);
  const [userError, setUserError] = useState('');
  const [loadingUser, setLoadingUser] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [search, setSearch] = useState('');

  useEffect(() => {
    let cancelled = false;
    getCurrentUser()
      .then((currentUser) => {
        if (!cancelled) {
          setUser(currentUser);
          setUserError('');
        }
      })
      .catch((requestError) => {
        if (!cancelled) setUserError(requestError.message || '현장 목록을 불러오지 못했습니다.');
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
  const sites = Array.isArray(user?.sites) ? user.sites : EMPTY_SITES;
  const filteredSites = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('ko-KR');
    if (!query) return sites;
    return sites.filter((site) => `${site.name ?? site.siteName ?? ''} ${site.address ?? ''} ${site.siteId ?? ''}`
      .toLocaleLowerCase('ko-KR')
      .includes(query));
  }, [search, sites]);

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
          title="현장목록"
        />
        <main className="dashboard-content">
          <div className="page-heading">
            <h1>현장목록</h1>
          </div>
          {userError && (
            <div className="dashboard-error" role="alert">
              <span>{userError}</span>
              <button
                type="button"
                onClick={() => {
                  setLoadingUser(true);
                  setRefreshKey((value) => value + 1);
                }}
              >
                다시 시도
              </button>
            </div>
          )}
          <section className="panel site-list-panel" aria-label="등록된 현장 목록">
            <div className="site-list-toolbar">
              <h2>등록된 현장 <small>{sites.length}곳</small></h2>
              <label>
                <span className="sr-only">현장 검색</span>
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="현장명 검색"
                />
              </label>
            </div>
            {loadingUser ? (
              <p className="dashboard-message" role="status">현장 목록을 불러오는 중입니다...</p>
            ) : filteredSites.length ? (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr><th>현장명</th><th>현장 ID</th><th>주소</th><th>상태</th></tr>
                  </thead>
                  <tbody>
                    {filteredSites.map((site, index) => (
                      <tr key={site.siteId ?? site.id ?? `${site.name ?? site.siteName}-${index}`}>
                        <td>{site.name ?? site.siteName ?? '이름 없음'}</td>
                        <td>{site.siteId ?? site.id ?? '-'}</td>
                        <td>{site.address ?? '-'}</td>
                        <td>
                          <span className={`pill ${site.active === false ? 'status-blocked' : 'status-approved'}`}>
                            {site.active === false ? '비활성' : site.active === true ? '활성' : '상태 미지정'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="site-list-empty">
                <h3>{sites.length ? '검색 결과가 없습니다' : '등록된 현장이 없습니다'}</h3>
                <p>{sites.length ? '검색어를 바꾸어 다시 확인해 주세요.' : '현장이 계정에 등록되면 이곳에 표시됩니다.'}</p>
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}

export default JobSearch;
