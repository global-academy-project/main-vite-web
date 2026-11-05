import { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { refreshWorkSite } from '../api/workers';
import SafetyPageLayout from '../components/safety-page-layout';
import { ROLE_LABELS, effectiveRole } from '../components/app-shell/nav-config.js';
import AssistantPanel from '../components/home/assistant-panel.jsx';
import { AlertsPanel, ApprovalsPanel, TodayWorksPanel, TodoPanel, WorkStatusPanel } from '../components/home/home-panels.jsx';
import ErrorBoundary from '../components/ui/error-boundary.jsx';
import StatusView from '../components/ui/status-view.jsx';
import { useToast } from '../components/ui/toast-context.js';
import { useHomeData } from '../hooks/use-home-data.js';
import { alertsOf } from '../utils/home-model.js';
import '../styles/home.css';

const APPROVERS = ['ADMIN', 'SITE_ADMIN', 'APPROVER'];

/**
 * 홈 = 대시보드 + AI 도우미 (첫 화면). PC 는 화면 높이에 고정되고 카드 안쪽만 스크롤된다.
 * 태블릿·모바일은 카드가 세로로 쌓이고 페이지가 스크롤된다.
 */
export default function Dashboard() {
  return (
    <SafetyPageLayout title="홈" fixed>
      {(site) => <Home site={site} />}
    </SafetyPageLayout>
  );
}

function Home({ site }) {
  const toast = useToast();
  const siteId = site.currentSite?.siteId ?? null;
  const role = effectiveRole(site.account?.user?.role, site.currentSite?.role);
  const approver = APPROVERS.includes(role);
  const data = useHomeData(siteId, { approver });
  const [newWorkId, setNewWorkId] = useState(null);
  const alerts = useMemo(() => alertsOf(data.dashboard.data, data.works.data ?? []), [data.dashboard.data, data.works.data]);
  const { reload } = data;

  const onDraftSaved = useCallback((workId) => { setNewWorkId(workId); reload(); }, [reload]);

  const changeSite = async (event) => {
    await site.selectSite(event.target.value);
    refreshWorkSite();
    toast.show({ tone: 'info', message: '현장을 바꿨습니다. AI 도우미는 새 대화로 시작합니다.' });
  };

  if (site.loading && !site.account) return <StatusView kind="loading" title="현장 정보를 불러오는 중입니다" />;
  if (!siteId) {
    return <StatusView kind="empty" title="선택할 수 있는 현장이 없습니다" message="관리자에게 현장 권한을 요청하세요." action={{ label: '내 정보', onClick: () => window.location.assign('/me') }} />;
  }

  const userName = site.account?.user?.name || '사용자';
  return (
    <div className="home">
      <header className="home-hero">
        <div className="home-hero__who">
          <h1 className="home-hero__title">{userName}님, 안녕하세요</h1>
          <p className="home-hero__meta">
            {role && <span className="home-hero__role">{ROLE_LABELS[role]}</span>}
            <span>{data.date.replace(/-/g, '. ')}</span>
          </p>
        </div>
        <div className="home-hero__actions">
          {site.account?.sites?.length > 1 ? (
            <label className="home-site">
              <span className="sr-only">현장 선택</span>
              <select value={siteId} onChange={changeSite} disabled={site.selecting}>
                {site.account.sites.map((item) => <option key={item.siteId} value={item.siteId}>{item.name}</option>)}
              </select>
            </label>
          ) : <span className="home-site home-site--static">{site.currentSite?.name}</span>}
          <Link className="ui-btn ui-btn--secondary" to="/job/workspace">단계별로 만들기</Link>
          <button type="button" className="ui-btn ui-btn--primary" onClick={() => document.getElementById('home-composer')?.focus()}>대화로 만들기</button>
        </div>
      </header>

      <div className="home-grid">
        <div className="home-cell home-cell--todo"><ErrorBoundary compact resetKeys={[siteId]}><TodoPanel section={data.dashboard} onRetry={reload} /></ErrorBoundary></div>
        <div className="home-cell home-cell--status"><ErrorBoundary compact resetKeys={[siteId]}><WorkStatusPanel dashboard={data.dashboard} works={data.works} onRetry={reload} /></ErrorBoundary></div>
        <div className="home-cell home-cell--ai">
          <ErrorBoundary compact resetKeys={[siteId]} title="AI 도우미를 표시하지 못했습니다">
            <AssistantPanel siteId={siteId} siteName={site.currentSite?.name} zones={data.zones.data ?? []} onDraftSaved={onDraftSaved} onDraftChanged={reload} />
          </ErrorBoundary>
        </div>
        <div className="home-cell home-cell--works"><ErrorBoundary compact resetKeys={[siteId]}><TodayWorksPanel section={data.works} zones={data.zones} highlightId={newWorkId} onRetry={reload} /></ErrorBoundary></div>
        <div className="home-cell home-cell--side">
          <ErrorBoundary compact resetKeys={[siteId]}><ApprovalsPanel section={data.approvals} approver={approver} onRetry={reload} /></ErrorBoundary>
          <ErrorBoundary compact resetKeys={[siteId]}><AlertsPanel alerts={alerts} section={data.works.status === 'ready' ? data.dashboard : data.works} onRetry={reload} /></ErrorBoundary>
        </div>
      </div>
    </div>
  );
}
