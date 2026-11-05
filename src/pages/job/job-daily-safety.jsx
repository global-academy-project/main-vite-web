import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getSafetyDashboard } from '../../api/dashboard';
import {
  createDailySafetyLogDraft, getDailySafetyLog, getDailySafetyLogs,
  submitDailySafetyLog, updateDailySafetyLog,
} from '../../api/records';
import { useWorkSite } from '../../api/workers';
import JobPageLayout, { JobPageHeading } from '../../components/job-page-layout';
import { jobRecordPath, localDate } from '../../utils/job-forms';

const statusLabel = { DRAFT: '작성 중', PENDING: '승인 대기', APPROVED: '승인 완료', REJECTED: '반려됨' };
const approverRoles = ['APPROVER', 'SITE_ADMIN', 'ADMIN'];
const roleOf = (site) => site?.role || site?.siteRole || '';

function errorMessage(error) {
  if (error?.code === 'CONFLICT_MODIFIED') return '다른 사용자가 일지를 수정했습니다. 최신 내용을 다시 불러와 주세요.';
  if (error?.code === 'INVALID_STATE') return '현재 상태에서는 이 작업을 할 수 없습니다. 최신 일지 상태를 확인하세요.';
  return error?.message || '안전일지를 처리하지 못했습니다.';
}

function Deadline({ dashboard }) {
  const deadline = dashboard?.deadlines?.dailyLogDeadline;
  if (!deadline) return null;
  return <span className={`job-status-badge${dashboard.deadlines.dailyLogPassed ? ' is-overdue' : ''}`}>
    {dashboard.deadlines.dailyLogPassed ? '안전일지 마감 지남' : `안전일지 마감 ${deadline.slice(11, 16)}`}
  </span>;
}

function IncompleteItems({ items = [] }) {
  if (!items.length) return <p className="job-help">확인할 미완료 항목이 없습니다.</p>;
  return <div className="stat-grid" aria-label="미완료 항목 집계">{items.map((item) => <div className={`stat-card${item.overdue ? ' is-overdue' : ''}`} key={item.type}>
    <span>{item.label || item.type}</span><strong>{item.count}<small>건</small></strong>{item.overdue && <small>지연</small>}
  </div>)}</div>;
}

function TeamStatus({ teams = [] }) {
  if (!teams.length) return <p className="job-help">팀별 집계가 없습니다.</p>;
  return <div className="table-scroll"><table><thead><tr><th>팀</th><th>안전일지</th><th>서명</th><th>측정값</th><th>사진</th></tr></thead><tbody>
    {teams.map((team, index) => <tr key={team.teamId ?? team.name ?? index}>
      <td>{team.teamName || team.name || '팀 미지정'}</td>
      <td>{statusLabel[team.dailyLogStatus || team.status] || team.dailyLogStatus || team.status || '-'}</td>
      <td>{team.signatures ?? team.signatureMissing ?? '-'}</td>
      <td>{team.measurements ?? team.measurementMissing ?? '-'}</td>
      <td>{team.photos ?? team.photoMissing ?? '-'}</td>
    </tr>)}
  </tbody></table></div>;
}

function RecordLinks({ title, entries = [] }) {
  if (!entries.length) return null;
  return <section className="job-example"><h3>{title}</h3><ul>{entries.map((entry, index) => {
    const path = jobRecordPath(entry.targetType, entry.targetId);
    const label = entry.title || entry.label || `${entry.targetType} #${entry.targetId}`;
    return <li key={`${entry.targetType}-${entry.targetId}-${index}`}>{path ? <Link to={path}>{label}</Link> : label}{entry.detail ? ` · ${entry.detail}` : ''}</li>;
  })}</ul></section>;
}

function DailyLogDetail({ log }) {
  if (!log) return null;
  const checkEntries = (log.checks || []).flatMap((check) => check.entries || []);
  return <><section className="panel" aria-labelledby="daily-check-title"><div className="job-section-heading"><div><span className="job-eyebrow">CHECKS</span><h2 id="daily-check-title">확인 필요 항목</h2></div></div>
    <IncompleteItems items={log.checks} />
    <RecordLinks title="관련 기록" entries={checkEntries} />
  </section><RecordLinks title="요약 근거 기록" entries={log.evidence} /></>;
}

function WriterView({ log, summary, onSummaryChange, dirty, busy, onCreate, onSave, onSubmit }) {
  const editable = log?.status === 'DRAFT';
  return <>{!log && <section className="panel job-form"><div className="job-section-heading"><div><span className="job-eyebrow">WRITER</span><h2>안전일지 초안 생성</h2></div></div>
    <p className="job-help">선택한 날짜의 작업·허가·TBM·점검·미완료 항목을 서버가 집계해 초안을 만듭니다.</p>
    <button type="button" onClick={onCreate} disabled={busy}>서버에서 초안 생성</button>
  </section>}
  {log && <section className="panel job-form"><div className="job-section-heading"><div><span className="job-eyebrow">WRITER</span><h2>안전일지 초안</h2></div><span className="job-status-badge">{statusLabel[log.status] || log.status}</span></div>
    <label>일일 안전일지 요약<textarea rows="6" value={summary} disabled={!editable || busy} onChange={(event) => onSummaryChange(event.target.value)} /></label>
    {editable && <div className="job-form-actions"><span>{dirty ? '저장하지 않은 수정 내용이 있습니다.' : '서버에 저장된 최신 초안입니다.'}</span>
      <button type="button" onClick={onSave} disabled={busy || !dirty}>요약 저장</button>
      <button type="button" onClick={onSubmit} disabled={busy || !summary.trim()}>승인 요청</button>
    </div>}
    {log.status === 'PENDING' && <p className="job-review-notice" role="status">승인 대기 상태입니다. 승인 또는 회수는 승인함에서 처리합니다.</p>}
    {log.status === 'APPROVED' && <p className="job-review-notice" role="status">승인 완료된 안전일지는 수정할 수 없습니다.</p>}
    {log.approvalId && <Link className="job-link-button" to={`/approvals/${log.approvalId}`}>승인 상세 보기</Link>}
  </section>}
  <DailyLogDetail log={log} /></>;
}

function ManagerView({ dashboard, dashboardLoading, log, busy, onCreate }) {
  return <><section className="panel"><div className="job-section-heading"><div><span className="job-eyebrow">INCOMPLETE ITEMS</span><h2>미완료 항목</h2></div></div>
    {dashboardLoading ? <p role="status">미완료 항목을 불러오는 중입니다...</p> : <IncompleteItems items={dashboard?.items} />}
  </section>
  <section className="panel"><div className="job-section-heading"><div><span className="job-eyebrow">TEAM STATUS</span><h2>팀별 작성 현황</h2></div></div><TeamStatus teams={dashboard?.teams} /></section>
  {log ? <><DailyLogDetail log={log} /><section className="panel"><div className="job-section-heading"><div><span className="job-eyebrow">MANAGER REVIEW</span><h2>관리자 검토</h2></div><span className="job-status-badge">{statusLabel[log.status] || log.status}</span></div>
    <p>{log.summary}</p>{log.approvalId && <Link className="job-link-button" to={`/approvals/${log.approvalId}`}>승인함에서 검토</Link>}</section></>
    : <section className="panel job-form"><p className="job-empty-state">선택한 날짜에 생성된 안전일지가 없습니다.</p><button type="button" onClick={onCreate} disabled={busy}>서버에서 초안 생성</button></section>}
  </>;
}

export default function JobDailySafety() {
  const context = useWorkSite();
  const siteId = context.currentSite?.siteId;
  const [date, setDate] = useState(localDate);
  const [log, setLog] = useState(null);
  const [summary, setSummary] = useState('');
  const [dirty, setDirty] = useState(false);
  const [loading, setLoading] = useState(false);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [dashboard, setDashboard] = useState(null);
  const canApprove = approverRoles.includes(roleOf(context.currentSite));

  const load = useCallback(async () => {
    if (!siteId || !date) return;
    setLoading(true); setError(''); setNotice(''); setLog(null); setSummary(''); setDirty(false);
    try {
      const logs = await getDailySafetyLogs(siteId, { from: date, to: date });
      const list = Array.isArray(logs) ? logs : [];
      const selected = list.find((item) => item.date === date) || list[0];
      if (!selected?.dailyLogId) return;
      const detail = await getDailySafetyLog(selected.dailyLogId);
      setLog(detail); setSummary(detail.summary || '');
    } catch (requestError) { setError(errorMessage(requestError)); } finally { setLoading(false); }
  }, [date, siteId]);

  // API 응답으로 화면 상태를 동기화한다.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!siteId || !date) return undefined;
    let cancelled = false;
    // 서버 집계의 로딩 상태를 표시한다.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDashboardLoading(true);
    getSafetyDashboard(siteId, date).then((data) => { if (!cancelled) setDashboard(data); })
      .catch(() => { if (!cancelled) setDashboard(null); })
      .finally(() => { if (!cancelled) setDashboardLoading(false); });
    return () => { cancelled = true; };
  }, [date, siteId]);

  const createDraft = async () => {
    if (!siteId) return;
    setBusy(true); setError(''); setNotice('');
    try {
      await createDailySafetyLogDraft(siteId, { date });
      setNotice('서버 집계로 안전일지 초안을 생성했습니다.');
      await load();
    } catch (requestError) { setError(errorMessage(requestError)); } finally { setBusy(false); }
  };
  const saveSummary = async () => {
    if (!log) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const updated = await updateDailySafetyLog(log.dailyLogId, { lockVersion: log.lockVersion, summary });
      setLog(updated); setSummary(updated.summary || ''); setDirty(false); setNotice('요약을 서버에 저장했습니다.');
    } catch (requestError) { setError(errorMessage(requestError)); } finally { setBusy(false); }
  };
  const submit = async () => {
    if (!log) return;
    setBusy(true); setError(''); setNotice('');
    try {
      let latest = log;
      if (dirty) latest = await updateDailySafetyLog(log.dailyLogId, { lockVersion: log.lockVersion, summary });
      const submitted = await submitDailySafetyLog(latest.dailyLogId, latest.lockVersion);
      setLog(submitted); setSummary(submitted.summary || summary); setDirty(false); setNotice('승인 요청을 보냈습니다.');
    } catch (requestError) { setError(errorMessage(requestError)); } finally { setBusy(false); }
  };

  return <JobPageLayout title="일일 안전일지" user={context.account?.user} contentClassName="job-management job-overview">
    <JobPageHeading title="일일 안전일지" description={date} actions={<Deadline dashboard={dashboard} />} context={context}
      onBeforeSelect={() => dirty && setNotice('저장하지 않은 요약 수정 내용은 현장을 바꾸면 사라집니다. 현장을 바꾸기 전에 저장해 주세요.')} />
    <section className="panel job-form"><label>기준 날짜<input type="date" max="9999-12-31" value={date} onChange={(event) => setDate(event.target.value)} disabled={busy} /></label></section>
    {error && <p className="dashboard-error" role="alert">{error} <button type="button" onClick={() => void load()} disabled={loading || busy}>다시 조회</button></p>}
    {notice && <p className="job-review-notice" role="status">{notice}</p>}
    {!siteId ? <p className="job-empty-state">현장을 선택해 주세요.</p> : loading ? <p role="status">안전일지를 불러오는 중입니다...</p>
      : canApprove ? <ManagerView dashboard={dashboard} dashboardLoading={dashboardLoading} log={log} busy={busy} onCreate={createDraft} />
        : <WriterView log={log} summary={summary} onSummaryChange={(value) => { setSummary(value); setDirty(value !== (log?.summary || '')); }} dirty={dirty} busy={busy} onCreate={createDraft} onSave={saveSummary} onSubmit={submit} />}
  </JobPageLayout>;
}
