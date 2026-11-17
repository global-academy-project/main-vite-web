import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import SafetyPageLayout from '../../components/safety-page-layout';
import PageHeader from '../../components/ui/page-header.jsx';
import StatusView from '../../components/ui/status-view.jsx';
import { useToast } from '../../components/ui/toast-context.js';
import { exportAuditReportPdf, getAuditReport, updateAuditReport } from '../../api/audit-reports.js';
import '../../styles/audit-reports.css';

export default function AuditReportDetail() { return <SafetyPageLayout title="감사보고서">{(site) => <Detail site={site} />}</SafetyPageLayout>; }

function Detail({ site }) {
  const { reportId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const allowed = site.account?.user?.role === 'ADMIN' || ['ADMIN', 'SITE_ADMIN'].includes(site.currentSite?.role);
  useEffect(() => { if (!site.currentSite?.siteId || !allowed) return; getAuditReport(site.currentSite.siteId, reportId).then(setReport).catch((requestError) => setError(requestError.message || '감사보고서를 불러오지 못했습니다.')).finally(() => setLoading(false)); }, [site.currentSite?.siteId, reportId, allowed]);
  if (!allowed) return <StatusView kind="forbidden" title="관리자만 감사보고서를 이용할 수 있습니다" />;
  if (loading) return <StatusView kind="loading" title="보고서를 불러오는 중입니다" />;
  if (error || !report) return <StatusView kind="error" title="보고서를 불러오지 못했습니다" message={error} action={{ label: '목록으로', onClick: () => navigate('/audit-reports') }} />;
  const items = report.items ?? report.sections ?? [];
  const save = async () => { setSaving(true); try { const saved = await updateAuditReport(site.currentSite.siteId, reportId, { title: report.title, summary: report.summary, items }); setReport(saved); toast.show({ tone: 'success', message: '감사보고서를 저장했습니다.' }); } catch (requestError) { toast.show({ tone: 'error', message: requestError.message || '저장에 실패했습니다.' }); } finally { setSaving(false); } };
  const print = async () => { try { const blob = await exportAuditReportPdf(site.currentSite.siteId, reportId); const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = `audit-report-${reportId}.pdf`; anchor.click(); URL.revokeObjectURL(url); } catch (requestError) { toast.show({ tone: 'error', message: requestError.message || 'PDF 출력에 실패했습니다.' }); } };
  return <div className="audit-page"><PageHeader title={report.title || `감사보고서 #${reportId}`} description={`${report.dateFrom || report.date_from} ~ ${report.dateTo || report.date_to}`} context={site} actions={<><Link className="ui-btn ui-btn--ghost" to="/audit-reports">목록</Link><button type="button" className="ui-btn ui-btn--secondary" onClick={print}>PDF 출력</button><button type="button" className="ui-btn ui-btn--primary" disabled={saving} onClick={save}>{saving ? '저장 중…' : '변경 저장'}</button></>} />
    <section className="audit-card"><div className="audit-card__head"><div><h2>감사보고서 초안</h2><p>관리자는 항목별 내용을 편집할 수 있습니다. 서버 연동 후 실제 집계·검증 결과가 표시됩니다.</p></div><span className={`audit-status audit-status--${String(report.status || 'DRAFT').toLowerCase()}`}>{report.status || 'DRAFT'}</span></div>
      {report.summary != null && <label className="audit-editor">종합 의견<textarea value={report.summary || ''} onChange={(event) => setReport({ ...report, summary: event.target.value })} rows={5} /></label>}
      <div className="audit-items">{items.map((item, index) => <article className="audit-item" key={item.id ?? item.queryType ?? index}><div className="audit-item__title"><h3>{item.title || item.queryType || `항목 ${index + 1}`}</h3><span className={`audit-status audit-status--${String(item.verification?.status || item.status || 'PENDING').toLowerCase()}`}>{item.verification?.status || item.status || '검토 대기'}</span></div><label className="audit-editor">요약<textarea value={item.summary || ''} onChange={(event) => setReport({ ...report, items: items.map((current, itemIndex) => itemIndex === index ? { ...current, summary: event.target.value } : current) })} rows={4} /></label><p className="audit-evidence">근거 {item.evidence?.length ?? 0}건 · 집계 수치 {item.stats ? JSON.stringify(item.stats) : '서버 연동 대기'}</p></article>)}</div>
    </section></div>;
}
