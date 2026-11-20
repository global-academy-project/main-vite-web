import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import SafetyPageLayout from '../../components/safety-page-layout';
import PageHeader from '../../components/ui/page-header.jsx';
import StatusView from '../../components/ui/status-view.jsx';
import { confirmAction } from '../../components/ui/confirm-store.js';
import { useToast } from '../../components/ui/toast-context.js';
import { createAuditReport, deleteAuditReport, listAuditReports } from '../../api/audit-reports.js';
import { defaultAuditPeriod } from '../../utils/audit-report-model.js';
import '../../styles/audit-reports.css';

const QUERY_TYPES = [
  ['risk_assessment_rate', '위험성평가 실시율'],
  ['permit_approval_statistics', '작업허가 승인 현황'],
  ['corrective_action_rate', '지적사항 조치율'],
  ['blocked_records', '차단 기록'],
  ['missing_measurements', '측정값 없이 승인된 허가'],
];

const roleAllowed = (account, site) => account?.user?.role === 'ADMIN'
  || ['ADMIN', 'SITE_ADMIN'].includes(site?.role);

export default function AuditReports() {
  return (
    <SafetyPageLayout title="감사 대응">
      {(site) => <AuditReportHome site={site} />}
    </SafetyPageLayout>
  );
}

function AuditReportHome({ site }) {
  const location = useLocation();
  const navigate = useNavigate();
  const toast = useToast();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(() => ({
    ...defaultAuditPeriod(),
    queryTypes: QUERY_TYPES.map(([key]) => key),
  }));
  const siteId = site.currentSite?.siteId;
  const allowed = roleAllowed(site.account, site.currentSite);
  const isNew = location.pathname.endsWith('/new');

  const load = () => {
    if (!siteId || !allowed) return;
    setLoading(true);
    setError('');
    listAuditReports(siteId)
      .then((data) => setReports(Array.isArray(data) ? data : data?.items ?? []))
      .catch((requestError) => setError(requestError.message || '감사 대응 보고서 목록을 불러오지 못했습니다.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!siteId || !allowed) return undefined;
    let active = true;
    listAuditReports(siteId)
      .then((data) => {
        if (active) setReports(Array.isArray(data) ? data : data?.items ?? []);
      })
      .catch((requestError) => {
        if (active) setError(requestError.message || '감사 대응 보고서 목록을 불러오지 못했습니다.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [siteId, allowed]);

  const toggle = (key) => {
    setForm((current) => ({
      ...current,
      queryTypes: current.queryTypes.includes(key)
        ? current.queryTypes.filter((item) => item !== key)
        : [...current.queryTypes, key],
    }));
  };

  const create = async (event) => {
    event.preventDefault();
    if (!form.queryTypes.length) {
      toast.show({ tone: 'error', message: '조회 항목을 하나 이상 선택하세요.' });
      return;
    }
    setCreating(true);
    try {
      const report = await createAuditReport(siteId, {
        dateFrom: form.dateFrom,
        dateTo: form.dateTo,
        queryTypes: form.queryTypes,
      });
      navigate(`/audit-reports/${report.reportId ?? report.id}`);
    } catch (requestError) {
      toast.show({ tone: 'error', message: requestError.message || '감사 대응 보고서 생성 요청에 실패했습니다.' });
    } finally {
      setCreating(false);
    }
  };

  const remove = async (report) => {
    const confirmed = await confirmAction({
      title: '감사 대응 보고서를 삭제할까요?',
      message: '삭제한 보고서는 목록에서 숨겨지고 되돌릴 수 없습니다. 현장 관리자 이상만 할 수 있습니다.',
      confirmLabel: '삭제',
      tone: 'warn',
    });
    if (!confirmed) return;
    const reportId = report.reportId ?? report.id;
    try {
      await deleteAuditReport(siteId, reportId);
      setReports((current) => current.filter((item) => (item.reportId ?? item.id) !== reportId));
      toast.show({ tone: 'success', message: '감사 대응 보고서를 삭제했습니다.' });
    } catch (requestError) {
      toast.show({ tone: 'error', message: requestError.message || '삭제에 실패했습니다.' });
    }
  };

  if (!allowed) {
    return <StatusView kind="forbidden" title="관리자만 감사 대응 보고서를 이용할 수 있습니다" message="현장 관리자 또는 회사 관리자 권한이 필요합니다." />;
  }

  return (
    <div className="audit-page">
      <PageHeader
        title="감사 대응"
        description="현장 기록과 관련 문서를 모아 부족한 항목을 확인하고 보고서로 관리합니다."
        context={site}
        actions={<button type="button" className="ui-btn ui-btn--primary" onClick={() => navigate('/audit-reports/new')}>새 감사 대응 보고서</button>}
      />
      {isNew ? (
        <form className="audit-card audit-create" onSubmit={create}>
          <div className="audit-card__head">
            <div>
              <h2>감사 대응 보고서 생성</h2>
              <p>기간과 조회 항목을 확인한 뒤 생성합니다. 서버가 기록을 집계해 저장하고, AI 요약은 잠시 뒤 채워집니다.</p>
            </div>
            <Link className="ui-btn ui-btn--ghost" to="/audit-reports">목록으로</Link>
          </div>
          <div className="audit-form-grid">
            <label>조회 시작일<input type="date" value={form.dateFrom} onChange={(event) => setForm({ ...form, dateFrom: event.target.value })} required /></label>
            <label>조회 종료일<input type="date" value={form.dateTo} onChange={(event) => setForm({ ...form, dateTo: event.target.value })} required /></label>
          </div>
          <fieldset>
            <legend>보고서에 포함할 항목</legend>
            <div className="audit-checks">
              {QUERY_TYPES.map(([key, label]) => (
                <label key={key}>
                  <input type="checkbox" checked={form.queryTypes.includes(key)} onChange={() => toggle(key)} />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="audit-actions"><button type="submit" className="ui-btn ui-btn--primary" disabled={creating}>{creating ? '생성 요청 중…' : '감사 대응 보고서 생성'}</button></div>
        </form>
      ) : (
        <section className="audit-card">
          <div className="audit-card__head">
            <div>
              <h2>보관된 보고서</h2>
              <p>생성된 감사 대응 보고서는 이곳에서 조회·편집·삭제할 수 있습니다.</p>
            </div>
          </div>
          {loading ? <StatusView kind="loading" title="목록을 불러오는 중입니다" />
            : error ? <StatusView kind="error" title="목록을 불러오지 못했습니다" message={error} onRetry={load} />
              : reports.length === 0 ? (
                <StatusView
                  kind="empty"
                  title="생성된 감사 대응 보고서가 없습니다"
                  message="새 감사 대응 보고서를 생성하면 이곳에 보관됩니다."
                  action={{ label: '새 감사 대응 보고서', onClick: () => navigate('/audit-reports/new') }}
                />
              )
                : <div className="audit-list">{reports.map((report) => <ReportRow key={report.reportId ?? report.id} report={report} onRemove={remove} />)}</div>}
        </section>
      )}
    </div>
  );
}

function ReportRow({ report, onRemove }) {
  const reportId = report.reportId ?? report.id;
  return (
    <article className="audit-row">
      <div>
        <Link to={`/audit-reports/${reportId}`} className="audit-row__title">{report.title || `감사 대응 보고서 #${reportId}`}</Link>
        <p>{report.dateFrom || report.date_from} ~ {report.dateTo || report.date_to}</p>
      </div>
      <div className="audit-row__meta">
        <span className={`audit-status audit-status--${String(report.status || 'DRAFT').toLowerCase()}`}>{report.statusLabel || report.status || '초안'}</span>
        <button type="button" className="ui-btn ui-btn--danger ui-btn--sm" onClick={() => onRemove(report)}>삭제</button>
      </div>
    </article>
  );
}
