import { useMemo, useState } from 'react';
import JobPageLayout from '../../components/job-page-layout.jsx';
import PageHeader from '../../components/ui/page-header.jsx';
import { Badge } from '../../components/home/panel.jsx';
import StatusView from '../../components/ui/status-view.jsx';
import { useWorkSite } from '../../api/workers.js';
import { AUDIT_QUERY_TYPES, auditReportFixture } from '../../mocks/audit-report.js';
import { allItemsMatch, canExport, numericStats, verificationLabel } from '../../utils/audit-report-model.js';
import '../../styles/work.css';
import '../../styles/records.css';

export default function AuditReport() {
  const context = useWorkSite();
  const [from, setFrom] = useState('2026-11-01');
  const [to, setTo] = useState('2026-11-13');
  const [selected, setSelected] = useState(() => new Set(AUDIT_QUERY_TYPES.map((item) => item.key)));
  const [report, setReport] = useState(null);
  const [reviewed, setReviewed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const site = context.currentSite;
  const displayReport = useMemo(() => report ? { ...report, status: reviewed ? 'REVIEWED' : report.status } : null, [report, reviewed]);

  const toggle = (key) => setSelected((current) => { const next = new Set(current); if (next.has(key)) next.delete(key); else next.add(key); return next; });
  const createReport = async () => {
    if (!from || !to || from > to || selected.size === 0) { setError('기간과 조회 항목을 확인하세요.'); return; }
    setBusy(true); setError(''); await new Promise((resolve) => window.setTimeout(resolve, 250));
    setReport({ ...auditReportFixture, siteId: site?.siteId || 1, from, to, items: auditReportFixture.items.filter((item) => selected.has(item.queryType)) }); setReviewed(false); setBusy(false);
  };
  const review = () => { if (displayReport && allItemsMatch(displayReport)) setReviewed(true); };
  const print = () => { if (canExport(displayReport)) window.print(); };

  return <JobPageLayout title="감사보고서" user={context.account?.user} contentClassName="work-page"><div className="work-list rec-page">
    <PageHeader title="감사보고서" description="기간별 공식 조회 결과를 항목별로 검토하고 출력합니다." context={context} actions={<button type="button" className="ui-btn ui-btn--primary" disabled={!canExport(displayReport)} onClick={print}>인쇄 PDF</button>} />
    <section className="home-panel"><header className="home-panel__head"><h2 className="home-panel__title">보고서 조건</h2><Badge tone="neutral">서버 API 연결 전 미리보기</Badge></header><div className="home-panel__body rec-pad">
      <div className="work-filters"><label>시작일 <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label><label>종료일 <input type="date" value={to} onChange={(event) => setTo(event.target.value)} /></label></div>
      <fieldset><legend>조회 항목</legend>{AUDIT_QUERY_TYPES.map((item) => <label key={item.key} style={{ display: 'block', margin: '8px 0' }}><input type="checkbox" checked={selected.has(item.key)} onChange={() => toggle(item.key)} /> {item.label}</label>)}</fieldset>
      {error && <p className="work-form__error" role="alert">{error}</p>}<button type="button" className="ui-btn ui-btn--primary" disabled={busy} onClick={createReport}>{busy ? '보고서 생성 중…' : '감사보고서 생성'}</button>
    </div></section>
    {!displayReport ? <StatusView kind="empty" title="보고서를 생성해 주세요" message="서버 연결 후에는 선택한 기간의 공식 집계 결과로 대체됩니다." /> : <>
      <section className="home-panel"><header className="home-panel__head"><h2 className="home-panel__title">항목별 초안<span className="home-panel__count">{displayReport.items.length}</span></h2><Badge tone={reviewed ? 'done' : 'neutral'}>{reviewed ? '검토 완료' : '검토 필요'}</Badge></header><div className="home-panel__body rec-pad">
        {displayReport.items.map((item) => <article key={item.queryType} style={{ borderBottom: '1px solid var(--line, #ddd)', padding: '16px 0' }}><div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}><h3>{item.title}</h3><Badge tone="done">{verificationLabel(item)}</Badge></div><p className="rec-text">{item.summary}</p><div>{numericStats(item.stats).map(({ key, value }) => <span key={key} style={{ marginRight: 16 }}><strong>{key}</strong> {value}</span>)}</div><details><summary>근거 {item.evidence?.length || 0}건</summary><pre>{JSON.stringify(item.evidence, null, 2)}</pre></details></article>)}
      </div></section>
      <section className="home-panel"><header className="home-panel__head"><h2 className="home-panel__title">전날 미조치 지적사항<span className="home-panel__count">{displayReport.previousUnresolvedItems.length}</span></h2></header><div className="home-panel__body rec-pad"><ul className="rec-links">{displayReport.previousUnresolvedItems.map((item) => <li key={item.id}><strong>{item.title}</strong><span className="rec-links__detail">기한 {item.dueDate} · {item.status}</span></li>)}</ul></div></section>
      <div className="rec-log__actions"><span className="rec-log__state">{reviewed ? '검토가 완료되어 출력할 수 있습니다.' : '수치와 근거를 확인한 뒤 검토 완료를 누르세요.'}</span><button type="button" className="ui-btn ui-btn--primary" disabled={reviewed || !allItemsMatch(displayReport)} onClick={review}>검토 완료</button></div>
    </>}
  </div></JobPageLayout>;
}
