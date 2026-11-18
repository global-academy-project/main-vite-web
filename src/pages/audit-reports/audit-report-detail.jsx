import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import SafetyPageLayout from '../../components/safety-page-layout';
import PageHeader from '../../components/ui/page-header.jsx';
import StatusView from '../../components/ui/status-view.jsx';
import { useToast } from '../../components/ui/toast-context.js';
import { getAuditReport, retryAuditReportSummary, updateAuditReport } from '../../api/audit-reports.js';
import { STAT_LABELS, VERIFICATION_LABELS, statEntries } from '../../utils/audit-report-model.js';
import '../../styles/audit-reports.css';

// 요약 중(GENERATING)일 때 다시 조회하는 간격
const POLL_MS = 5000;

export default function AuditReportDetail() {
  return (
    <SafetyPageLayout title="감사보고서">
      {(site) => <Detail site={site} />}
    </SafetyPageLayout>
  );
}

function Detail({ site }) {
  const { reportId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState('');
  const siteId = site.currentSite?.siteId;
  const allowed = site.account?.user?.role === 'ADMIN'
    || ['ADMIN', 'SITE_ADMIN'].includes(site.currentSite?.role);
  const generating = report?.status === 'GENERATING';

  useEffect(() => {
    if (!siteId || !allowed) return undefined;
    let active = true;
    getAuditReport(siteId, reportId)
      .then((data) => { if (active) setReport(data); })
      .catch((requestError) => { if (active) setError(requestError.message || '감사보고서를 불러오지 못했습니다.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [siteId, reportId, allowed]);

  // AI 요약이 끝날 때까지 다시 조회한다. 요약 중에는 편집을 막아 두므로 받은 값으로 바로 바꿔도 고친 내용이 사라지지 않는다.
  // 요약 중에도 받아 두는 것은 오래 멈추면 서버가 summaryRetryable 을 켜 주기 때문
  useEffect(() => {
    if (!generating || !siteId) return undefined;
    const timer = setInterval(() => {
      getAuditReport(siteId, reportId).then(setReport).catch(() => {});
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [generating, siteId, reportId]);

  if (!allowed) {
    return <StatusView kind="forbidden" title="관리자만 감사보고서를 이용할 수 있습니다" />;
  }
  if (loading) {
    return <StatusView kind="loading" title="보고서를 불러오는 중입니다" />;
  }
  if (error || !report) {
    return (
      <StatusView
        kind="error"
        title="보고서를 불러오지 못했습니다"
        message={error}
        action={{ label: '목록으로', onClick: () => navigate('/audit-reports') }}
      />
    );
  }

  const items = Array.isArray(report.items) ? report.items : [];
  const edit = (patch) => { setReport({ ...report, ...patch }); setDirty(true); };

  const save = async () => {
    setSaving(true);
    try {
      const saved = await updateAuditReport(siteId, reportId, {
        title: report.title,
        summary: report.summary ?? null,
        items: items.map((item) => ({ queryType: item.queryType, summary: item.summary ?? '' })),
        lockVersion: report.lockVersion,
      });
      setReport(saved);
      setDirty(false);
      toast.show({ tone: 'success', message: '감사보고서를 저장했습니다.' });
    } catch (requestError) {
      const conflict = requestError.code === 'CONFLICT_MODIFIED';
      toast.show({ tone: 'error', message: conflict ? '다른 사람이 먼저 저장했습니다. 새로 고침한 뒤 다시 고쳐 주세요.' : requestError.message || '저장에 실패했습니다.' });
    } finally {
      setSaving(false);
    }
  };

  const retry = async () => {
    try {
      setReport(await retryAuditReportSummary(siteId, reportId));
      toast.show({ tone: 'success', message: 'AI 요약을 다시 시작했습니다. 잠시 뒤 채워집니다.' });
    } catch (requestError) {
      toast.show({ tone: 'error', message: requestError.message || '다시 요약하지 못했습니다.' });
    }
  };

  return (
    <div className="audit-page">
      <PageHeader
        title={report.title || `감사보고서 #${reportId}`}
        description={`${report.dateFrom} ~ ${report.dateTo} · 만든 사람 ${report.createdByName ?? '-'}`}
        context={site}
        actions={(
          <>
            <Link className="ui-btn ui-btn--ghost" to="/audit-reports">목록</Link>
            <Link className="ui-btn ui-btn--ghost" to={`/records/actions?new=1&sourceType=AUDIT&sourceId=${report.reportId}`}>개선조치 등록</Link>
            <button type="button" className="ui-btn ui-btn--secondary" disabled={dirty} onClick={() => window.print()}>인쇄·PDF 저장</button>
            <button type="button" className="ui-btn ui-btn--primary" disabled={saving || generating || !dirty} onClick={save}>
              {saving ? '저장 중…' : '변경 저장'}
            </button>
          </>
        )}
      />

      <section className="audit-card">
        <div className="audit-card__head">
          <div>
            <h2>감사보고서</h2>
            <p>집계 수치는 만든 순간의 공식 기록 그대로이며 고칠 수 없습니다. 제목·종합 의견·항목별 요약만 고칠 수 있습니다.{dirty ? ' 저장하지 않은 변경이 있습니다(인쇄는 저장 후).' : ''}</p>
          </div>
          <span className={`audit-status audit-status--${String(report.status).toLowerCase()}`}>{report.statusLabel ?? report.status}</span>
        </div>

        {generating && !report.summaryRetryable && <p className="audit-notice" role="status">AI가 항목별 요약과 수치 검증을 만드는 중입니다. 끝나면 이 화면이 저절로 바뀝니다.</p>}
        {generating && report.summaryRetryable && (
          <p className="audit-notice" role="alert">AI 요약이 너무 오래 걸리고 있습니다. 멈췄을 수 있으니 다시 요약해 주세요.
            <button type="button" className="ui-btn ui-btn--ghost" onClick={retry}>AI 요약 다시 하기</button></p>
        )}
        {report.status === 'FAILED' && (
          <p className="audit-notice" role="alert">AI 요약을 만들지 못했습니다{report.failureReason ? `: ${report.failureReason}` : ''}. 집계는 남아 있으니 직접 요약을 쓰거나 다시 요약하세요.
            {report.summaryRetryable && <button type="button" className="ui-btn ui-btn--ghost" onClick={retry}>AI 요약 다시 하기</button>}</p>
        )}
        {report.status === 'REVIEW_REQUIRED' && <p className="audit-notice" role="note">AI 요약의 수치가 집계와 맞지 않는 항목이 있습니다. 항목의 "불일치"를 확인하고 요약을 고쳐 주세요.</p>}

        <label className="audit-editor">
          제목
          <input maxLength={200} value={report.title ?? ''} disabled={generating} onChange={(event) => edit({ title: event.target.value })} />
        </label>
        <label className="audit-editor">
          종합 의견
          <textarea value={report.summary ?? ''} rows={5} disabled={generating} onChange={(event) => edit({ summary: event.target.value })} />
        </label>

        <div className="audit-items">
          {items.map((item, index) => (
            <article className="audit-item" key={item.queryType ?? index}>
              <div className="audit-item__title">
                <h3>{item.title || item.queryType}</h3>
                <span className={`audit-status audit-status--${String(item.verification?.status ?? 'pending').toLowerCase()}`}>
                  {VERIFICATION_LABELS[item.verification?.status] ?? '검증 전'}
                </span>
              </div>
              <dl className="audit-stats">
                {statEntries(item.stats).map(([key, value]) => (
                  <div key={key}><dt>{STAT_LABELS[key] ?? key}</dt><dd>{value}</dd></div>
                ))}
              </dl>
              {item.verification?.mismatches?.length > 0 && (
                <ul className="audit-evidence">{item.verification.mismatches.map((text, i) => <li key={i}>불일치: {text}</li>)}</ul>
              )}
              <label className="audit-editor">
                요약
                <textarea
                  value={item.summary || ''}
                  disabled={generating}
                  onChange={(event) => edit({
                    items: items.map((current, itemIndex) => (itemIndex === index ? { ...current, summary: event.target.value } : current)),
                  })}
                  rows={4}
                />
              </label>
              <p className="audit-evidence">근거 기록 {item.evidence?.length ?? 0}건{item.truncated ? ` · 전체 ${item.total}건 중 일부만 담김` : ''}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
