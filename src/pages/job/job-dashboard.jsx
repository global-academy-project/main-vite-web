import { useEffect, useState } from 'react';
import { getSafetyDashboard } from '../../api/dashboard';
import SafetyPageLayout from '../../components/safety-page-layout';
import '../../style/job/job-dashboard.css';
import '../../style/records.css';

const today = () => new Date().toISOString().slice(0, 10);
function Metric({ label, value, tone = '' }) { return <div className="stat-card"><span>{label}</span><strong className={tone}>{value ?? 0}<small>건</small></strong></div>; }
function DashboardContent({ site }) {
  const [date, setDate] = useState(today);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const siteId = site.currentSite?.siteId;
  const requestKey = `${siteId || 'none'}:${date}`;
  const data = result?.key === requestKey ? result.data : null;
  useEffect(() => {
    if (!siteId) return undefined;
    let cancelled = false;
    getSafetyDashboard(siteId, date).then((dashboard) => { if (!cancelled) { setResult({ key: requestKey, data: dashboard }); setError(''); } }).catch((requestError) => { if (!cancelled) { setResult({ key: requestKey, data: null }); setError(requestError.message); } });
    return () => { cancelled = true; };
  }, [siteId, date, requestKey]);
  return <>
    <div className="page-heading records-heading"><div><h1>안전 작업 현황</h1><p>현장 기록에서 계산한 승인·점검·TBM 현황입니다.</p></div><div className="dashboard-live-filters"><input type="date" value={date} onChange={(event) => setDate(event.target.value)} /><select value={siteId || ''} onChange={(event) => site.selectSite(event.target.value)} disabled={site.loading || site.selecting}>{(site.account?.sites || []).map((item) => <option key={item.siteId} value={item.siteId}>{item.name}</option>)}</select></div></div>
    {error && <p className="dashboard-error" role="alert">{error}</p>}
    {!data && siteId && !error && <p role="status">대시보드 데이터를 불러오는 중입니다...</p>}
    {data && <><section className="stat-grid" aria-label="안전관리 요약"><Metric label="전체 작업" value={data.workCounts?.total} /><Metric label="승인 완료" value={data.workCounts?.approved} tone="blue" /><Metric label="승인 대기" value={data.workCounts?.pending} /><Metric label="차단 작업" value={data.workCounts?.blocked} tone="red" /><Metric label="위험성평가" value={data.riskCounts?.total} /><Metric label="작업허가" value={data.permitCounts?.total} /><Metric label="점검표" value={data.inspectionCounts?.total} /><Metric label="TBM" value={data.tbmCounts?.total} /></section><section className="dashboard-panels safety-panels"><div className="panel"><h2>미완료 항목</h2><div className="detail-list">{Object.entries({ '미완료 개선조치': data.incomplete?.correctiveActions, '서명 누락': data.incomplete?.signatures, 'LEL 측정값 누락': data.incomplete?.gasMeasurements, '사진 누락': data.incomplete?.photos, '점검 미완료': data.incomplete?.inspections, TBM: data.incomplete?.tbm }).map(([label, value]) => <div key={label}><span>{label}</span><strong>{value ?? 0}건</strong></div>)}</div></div><div className="panel"><h2>팀별 작성 현황</h2>{data.teamStatus?.length ? <div className="table-scroll"><table><thead><tr><th>팀</th><th>작업</th><th>승인</th><th>대기</th></tr></thead><tbody>{data.teamStatus.map((row) => <tr key={row.teamId || row.teamName}><td>{row.teamName || '미지정'}</td><td>{row.total}</td><td>{row.approved}</td><td>{row.pending}</td></tr>)}</tbody></table></div> : <p className="records-empty">해당 날짜의 팀별 작업이 없습니다.</p>}</div><div className="panel"><h2>최근 승인 요청</h2>{data.recentApprovals?.length ? <ul className="dashboard-record-list">{data.recentApprovals.map((row) => <li key={row.approvalId}><strong>{row.targetType} #{row.targetId}</strong><span>{row.status} · {row.requestedAt?.replace('T', ' ')}</span></li>)}</ul> : <p className="records-empty">최근 승인 요청이 없습니다.</p>}</div><div className="panel"><h2>최근 차단 기록</h2>{data.recentBlocked?.length ? <ul className="dashboard-record-list">{data.recentBlocked.map((row) => <li key={`${row.recordType}-${row.recordId}`}><strong>{row.title}</strong><span>{row.recordType} #{row.recordId}</span></li>)}</ul> : <p className="records-empty">최근 차단 기록이 없습니다.</p>}</div></section></>}
  </>;
}
export default function JobDashboard() { return <SafetyPageLayout title="작업 현황">{(site) => <DashboardContent site={site} />}</SafetyPageLayout>; }
