import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useWorkSite } from '../../api/workers';
import { getSafetyDashboard } from '../../api/dashboard';
import JobPageLayout, { JobPageHeading } from '../../components/job-page-layout';
import { JobSiteSelector } from './job-work-form';
import JobWorkList from '../../components/job-work-list';
import { localDate } from '../../utils/job-forms';

export default function JobDashboard() {
  const context = useWorkSite();
  const [dashboard, setDashboard] = useState(null);
  const [dashboardError, setDashboardError] = useState('');
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const workDate = localDate();
  const currentDashboard = !dashboardLoading && !dashboardError
    && dashboard?.siteId === context.currentSite?.siteId && dashboard?.date === workDate ? dashboard : null;

  useEffect(() => {
    const siteId = context.currentSite?.siteId;
    if (!siteId) {
      return undefined;
    }
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDashboardLoading(true);
    setDashboardError('');
    // API: GET /api/v1/sites/{siteId}/dashboard?date=YYYY-MM-DD
    // FLOW: 현장 선택 → work_date 기준 미완료 항목 조회
    getSafetyDashboard(siteId, workDate).then((data) => {
      if (!cancelled) setDashboard(data);
    }).catch((requestError) => {
      if (!cancelled) {
        setDashboard(null);
        setDashboardError(requestError.status === 404
          ? '대시보드 미완료 집계 API가 아직 연결되지 않았습니다.'
          : requestError.message || '대시보드 집계를 불러오지 못했습니다.');
      }
    }).finally(() => {
      if (!cancelled) setDashboardLoading(false);
    });
    return () => { cancelled = true; };
  }, [context.currentSite?.siteId, workDate]);

  return (
    <JobPageLayout title="작업 현황" user={context.account?.user} contentClassName="job-management job-overview">
      <JobPageHeading title="안전 작업 현황" description={`${new Date().toLocaleDateString('ko-KR')} · ${context.currentSite?.name ?? '현장 미선택'}`} />
      <JobSiteSelector context={context} />
      <p className="scenario-notice">선택 현장과 권한은 실제 사용자 API 정보입니다. 업무 조회 API가 없는 항목은 0건이나 가상 작업으로 대체하지 않습니다.</p>
      <section className="stat-grid" aria-label="안전관리 요약">
        <div className="stat-card"><span>접근 가능 현장</span><strong>{context.account ? context.account.sites.length : '미조회'}<small>곳</small></strong></div>
        <div className="stat-card"><span>오늘 작업</span><strong>{currentDashboard?.works.total ?? '미조회'}<small>건</small></strong></div>
        <div className="stat-card"><span>차단된 작업</span><strong>{currentDashboard?.works.blocked ?? '미조회'}<small>건</small></strong></div>
        <div className="stat-card"><span>작업 상태별 건수</span>{currentDashboard
          ? Object.entries(currentDashboard.works.byStatus).map(([status, count]) => <p key={status}>{status}: {count}건</p>)
          : <strong>미조회</strong>}</div>
      </section>
      <section className="dashboard-panels" aria-label="현장 안전 현황">
        <div className="panel"><h2>오늘 작업</h2><p className="job-help">아래 작업 목록에서 인원·상태와 연결된 허가서·위험성평가·TBM을 확인하세요.</p><Link className="job-link-button" to="/job/workspace">작업 등록·조회 <span aria-hidden="true">→</span></Link></div>
        <div className="panel"><h2>현장 취급 물질</h2><p className="job-help">site_chemicals · work_materials 조회 API가 필요합니다. 물질·수량·단위는 선택 현장 및 작업 ID와 함께 조회해야 합니다.</p></div>
        <div className="panel"><h2>아차사고·작업 경고</h2><p className="job-help">near_misses · record_tags · work_warnings 조회 API가 필요합니다. 등록된 실제 사고가 있는지는 아직 확인할 수 없습니다.</p></div>
        <div className="panel"><h2>허가·필수 조치</h2><p className="job-help">미완료 항목은 서버 집계이며, 개별 허가서의 판정·승인 요청은 작업 목록의 허가서 링크로 진행하세요.</p></div>
      </section>
      <section className="panel" aria-labelledby="incomplete-items-title">
        <div className="job-section-heading">
          <div><span className="job-eyebrow">INCOMPLETE ITEMS</span><h2 id="incomplete-items-title">미완료 항목</h2><p className="job-help">기준일: {workDate} · work_date 기준 서버 집계</p></div>
        </div>
        {dashboardLoading && <p role="status">미완료 항목을 불러오는 중입니다...</p>}
        {dashboardError && <p className="dashboard-error" role="alert">{dashboardError}</p>}
        {!dashboardLoading && !dashboardError && !dashboard && <p className="job-help">대시보드 API 응답이 없어 집계값을 표시하지 않습니다.</p>}
        {currentDashboard && (
          <div className="stat-grid" aria-label="미완료 항목 집계">
            {currentDashboard.items.map((item) => <div className={`stat-card${item.overdue ? ' is-overdue' : ''}`} key={item.type}>
              <span>{item.label || item.type}</span><strong>{item.count}</strong>{item.overdue && <small> 지연</small>}
            </div>)}
          </div>
        )}
      </section>
      {context.currentSite && <JobWorkList key={context.currentSite.siteId} siteId={context.currentSite.siteId}
        disabled={context.selecting || context.loading} />}
    </JobPageLayout>
  );
}
