import { useEffect, useMemo, useState } from 'react';
import { useWorkSite } from '../../api/workers';
import JobPageLayout, { JobPageHeading } from '../../components/job-page-layout';
import { JobSiteSelector } from './job-work-form';
import {
  dailySafetyDraft,
  dailySafetyEquipmentChecks,
  dailySafetyFindings,
  dailySafetyMissingItems,
  dailySafetyTeams,
} from '../../mocks/daily-safety';

const dailyLogStatuses = { DRAFT: '작성 중', PENDING: '승인 대기', APPROVED: '승인 완료' };

function roleOf(site) { return site?.role || site?.siteRole || ''; }

function Deadline() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60000);
    return () => window.clearInterval(timer);
  }, []);
  const deadline = new Date(now);
  deadline.setHours(18, 0, 0, 0);
  const minutes = Math.max(0, Math.floor((deadline - now) / 60000));
  return <span className="job-status-badge">마감까지 {Math.floor(minutes / 60)}시간 {minutes % 60}분</span>;
}

function MissingItems() {
  return <section className="panel" aria-labelledby="daily-missing-title">
    <div className="job-section-heading"><div><span className="job-eyebrow">INCOMPLETE ITEMS</span><h2 id="daily-missing-title">미완료 항목</h2></div></div>
    <div className="stat-grid">{dailySafetyMissingItems.map((item) => <div className={`stat-card${item.overdue ? ' is-overdue' : ''}`} key={item.type}>
      <span>{item.label}</span><strong>{item.count}<small>건</small></strong>{item.overdue && <small>지연</small>}
    </div>)}</div>
  </section>;
}

function TeamStatus() {
  return <section className="panel">
    <div className="job-section-heading"><div><span className="job-eyebrow">TEAM STATUS</span><h2>팀별 작성 현황</h2></div></div>
    <div className="table-scroll"><table><thead><tr><th>팀</th><th>안전일지</th><th>서명</th><th>측정값</th><th>사진</th></tr></thead><tbody>
      {dailySafetyTeams.map((team) => <tr key={team.teamId}><td>{team.teamName}</td><td>{dailyLogStatuses[team.status] || team.status}</td><td>{team.signatures ? `${team.signatures}건 누락` : '완료'}</td><td>{team.measurements ? `${team.measurements}건 누락` : '완료'}</td><td>{team.photos ? `${team.photos}건 누락` : '완료'}</td></tr>)}
    </tbody></table></div>
  </section>;
}

function EvidenceSummary() {
  return <div className="job-example"><h3>확인 필요</h3><ul>{dailySafetyDraft.checks.map((item) => <li key={item}>{item}</li>)}</ul><h3>근거 기록</h3><ul>{dailySafetyDraft.evidence.map((item) => <li key={item}>{item}</li>)}</ul></div>;
}

function WriterView({ savedDraft, onCreate, onSave }) {
  const [summary, setSummary] = useState(savedDraft?.summary || dailySafetyDraft.summary);
  const status = savedDraft?.status || 'DRAFT';
  const draft = savedDraft || dailySafetyDraft;
  return <>
    <section className="panel job-form"><div className="job-section-heading"><div><span className="job-eyebrow">WRITER</span><h2>안전일지 초안 작성</h2></div><span className="job-status-badge">{dailyLogStatuses[status]}</span></div>
      <fieldset disabled={status !== 'DRAFT'}><label>일일 안전일지 요약<textarea rows="5" value={summary} onChange={(event) => setSummary(event.target.value)} /></label><EvidenceSummary /><div className="job-form-actions"><span>작성자 확인 후 승인 요청합니다.</span><button type="button" onClick={() => { const next = { ...draft, summary, status: 'DRAFT' }; onSave(next); onCreate(next); }}>초안 저장</button><button type="button" onClick={() => { const next = { ...draft, summary, status: 'PENDING' }; onSave(next); onCreate(next); }}>승인 요청</button></div></fieldset>
    </section>
    {status === 'PENDING' && <p className="job-review-notice" role="status">승인 대기 상태입니다. 승인·반려는 기존 승인함에서 처리합니다.</p>}
  </>;
}

function ManagerView() {
  return <><MissingItems /><TeamStatus /><section className="panel"><div className="job-section-heading"><div><span className="job-eyebrow">MANAGER REVIEW</span><h2>관리자 검토</h2></div></div><ul>{dailySafetyFindings.map((finding) => <li key={finding.id}>전날 지적사항: {finding.title} · {finding.status}</li>)}{dailySafetyEquipmentChecks.map((check) => <li key={check.id}>장비 점검: {check.equipment} · {check.result}</li>)}</ul><div className="job-form-actions"><span>승인·반려는 기존 승인함으로 이동합니다.</span><a className="job-link-button" href="/approvals">승인함으로 이동</a></div></section></>;
}

export default function JobDailySafety() {
  const context = useWorkSite();
  const siteId = context.currentSite?.siteId;
  const role = roleOf(context.currentSite);
  const canApprove = ['APPROVER', 'SITE_ADMIN', 'ADMIN'].includes(role);
  const storageKey = `daily-safety-draft:${siteId || 'none'}`;
  const [savedDraft, setSavedDraft] = useState(null);
  const [notice, setNotice] = useState('');
  const [photo, setPhoto] = useState(null);
  const writerMode = !canApprove;

  useEffect(() => {
    if (!siteId) return;
    // 현장별 저장 초안을 화면 상태로 복원한다.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    try { setSavedDraft(JSON.parse(localStorage.getItem(storageKey) || 'null')); } catch { setSavedDraft(null); }
  }, [siteId, storageKey]);

  const onBeforeSelect = () => {
    if (!siteId) return;
    if (savedDraft) localStorage.setItem(storageKey, JSON.stringify(savedDraft));
    setNotice('이전 현장의 안전일지 초안을 브라우저에 임시 저장했습니다.');
  };

  const saveDraft = (draft) => { setSavedDraft(draft); localStorage.setItem(storageKey, JSON.stringify(draft)); };
  const photoName = useMemo(() => photo?.name || '', [photo]);

  return <JobPageLayout title="일일 안전일지" user={context.account?.user} contentClassName="job-management job-overview">
    <JobPageHeading title="일일 안전일지" description={`${new Date().toLocaleDateString('ko-KR')} · ${context.currentSite?.name ?? '현장 미선택'}`} actions={<Deadline />} />
    <JobSiteSelector context={context} onBeforeSelect={onBeforeSelect} />
    <p className="job-demo-notice">현재는 백엔드 연결 전 시연 화면입니다. 초안은 현장별로 브라우저에 임시 저장됩니다.</p>
    {notice && <p className="job-review-notice" role="status">{notice}</p>}
    {!siteId ? <p className="job-empty-state">현장을 선택해 주세요.</p> : <>
      {writerMode ? <WriterView savedDraft={savedDraft} onCreate={setSavedDraft} onSave={saveDraft} /> : <ManagerView />}
      {canApprove && <section className="panel job-form"><div className="job-section-heading"><div><span className="job-eyebrow">TBM PHOTO</span><h2>TBM 사진 확인</h2></div></div><label>사진 선택<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setPhoto(event.target.files?.[0] || null)} /></label>{photoName && <p className="job-help">선택된 사진: {photoName} · 실제 분석 API 연결 전입니다.</p>}</section>}
    </>}
  </JobPageLayout>;
}
