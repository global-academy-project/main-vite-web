import { useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { getDocumentPreview, PREVIEW_TYPES } from '../../api/records';
import { useWorkSite } from '../../api/workers';
import ApprovalPreview from '../../components/approvals/approval-preview.jsx';
import SafetyInspectionLogForm from '../../components/daily-safety/safety-inspection-log-form.jsx';
import JobPageLayout from '../../components/job-page-layout';
import PageHeader from '../../components/ui/page-header.jsx';
import { Badge } from '../../components/home/panel.jsx';
import Icon from '../../components/ui/icon.jsx';
import StatusView, { Skeleton } from '../../components/ui/status-view.jsx';
import {
  APPROVAL_STATUS_LABELS, APPROVER_ROLE_LABELS, approvalTone, shortDateTime, STEP_STATUS_LABELS, stepTone,
} from '../../utils/approval-model.js';
import { APPROVAL_TARGET_LABELS } from '../../utils/home-model.js';
import { jobRecordPath } from '../../utils/job-forms.js';
import { normalizeDailyLogDocument } from '../../utils/daily-log-document.js';
import '../../styles/home.css';
import '../../styles/work.css';
import '../../styles/records.css';
import '../../styles/approvals.css';
import '../../styles/tbm.css';
import '../../styles/document.css';

/** 문서를 고치는 화면 (안전일지는 기록이 날짜별이라 날짜로 연다) */
const editPath = (preview) => (preview.targetType === 'DAILY_LOG'
  ? `/job/daily-safety${preview.content?.date ? `?date=${preview.content.date}` : ''}`
  : jobRecordPath(preview.targetType, preview.targetId));

/**
 * 문서 보기 (/records/:recordType/:recordId). GET /previews/{type}/{id} 로 작업허가·위험성평가·TBM·점검표·안전일지를
 * 승인함과 같은 모양으로 읽기 전용으로 보여 주고, 결재 이력과 인쇄를 더했다. 저장하지 않는 미리보기다.
 * 미리보기가 없는 작업·결재는 그 화면으로 바로 보낸다(예전 주소도 살아 있게).
 */
export default function RecordDetail() {
  const { recordType, recordId } = useParams();
  const type = String(recordType ?? '').toUpperCase();
  if (!PREVIEW_TYPES.includes(type)) {
    const path = /^\d+$/.test(recordId ?? '') ? jobRecordPath(type, Number(recordId)) : null;
    if (path) return <Navigate to={path} replace />;
  }
  return <DocumentPage key={`${type}:${recordId}`} type={type} id={recordId} />;
}

function DocumentPage({ type, id }) {
  const context = useWorkSite();
  const [state, setState] = useState({ key: null, data: null, error: '' });
  const [revision, setRevision] = useState(0);
  const key = `${type}:${id}:${revision}`;
  const supported = PREVIEW_TYPES.includes(type);

  useEffect(() => {
    if (!supported) return undefined;
    let active = true;
    getDocumentPreview(type, id).then((data) => { if (active) setState({ key, data, error: '' }); })
      .catch((error) => { if (active) setState({ key, data: null, error: error.status === 404 ? '문서를 찾을 수 없습니다. 지워졌거나 다른 현장의 문서일 수 있습니다.' : error.message || '문서를 불러오지 못했습니다.' }); });
    return () => { active = false; };
  }, [type, id, key, supported]);

  const loading = supported && state.key !== key;
  const preview = loading ? null : state.data;
  const dailyLogContent = normalizeDailyLogDocument(preview);
  const label = APPROVAL_TARGET_LABELS[type] ?? type;
  const summary = preview?.approval?.summary;
  const steps = preview?.approval?.steps ?? [];

  return (
    <JobPageLayout title="문서 보기" user={context.account?.user} contentClassName="work-page">
      <div className="work-list rec-page doc-page">
        <PageHeader title={preview?.title || `${label} #${id}`}
          badges={<>
            <Badge tone="info">{label}</Badge>
            {preview && (preview.official ? <Badge tone="done">정식 문서</Badge> : <Badge tone="warn">미리보기</Badge>)}
          </>}
          description="저장하지 않는 읽기 전용 문서입니다. 고치려면 문서 화면으로 가세요."
          actions={<>
            <button type="button" className="ui-btn ui-btn--ghost" disabled={loading} onClick={() => setRevision((value) => value + 1)}><Icon name="refresh" size={16} />새로고침</button>
            {preview && <button type="button" className="ui-btn ui-btn--ghost" onClick={() => window.print()}>인쇄</button>}
            {preview && editPath(preview) && <Link className="ui-btn ui-btn--primary" to={editPath(preview)}>문서 화면으로</Link>}
          </>} />

        {!supported && <section className="home-panel"><StatusView kind="empty" title="볼 수 없는 문서 종류입니다" message="문서 보기는 작업허가·위험성평가·TBM·점검표·안전일지만 지원합니다." /></section>}
        {loading && <section className="home-panel"><div className="home-panel__pad"><Skeleton lines={8} /></div></section>}
        {!loading && state.error && <section className="home-panel"><StatusView kind="error" message={state.error} onRetry={() => setRevision((value) => value + 1)} /></section>}

        {preview && (
          <div className="doc-grid">
            <section className="home-panel tbm-card doc-sheet" aria-label="문서 내용">
              <header className="doc-sheet__head">
                <div>
                  <span className="rec-help">{label} #{preview.targetId}{preview.formSchemaVersion ? ` · 양식 ${preview.formSchemaVersion}` : ''}</span>
                  <h2>{preview.title}</h2>
                </div>
                <span className="rec-help doc-sheet__time">생성 {shortDateTime(preview.generatedAt)}</span>
              </header>
              {type === 'DAILY_LOG'
                ? <SafetyInspectionLogForm log={dailyLogContent} preview />
                : <ApprovalPreview preview={preview} />}
            </section>

            <aside className="doc-side">
              <section className="home-panel tbm-card" aria-labelledby="doc-approval">
                <header className="tbm-card__head"><div><h2 id="doc-approval">결재</h2>
                  <p className="rec-help">{summary ? '이 문서의 가장 최근 결재입니다.' : '아직 결재 요청이 없습니다.'}</p></div>
                  {summary && <div className="tbm-card__actions"><Link className="ui-btn ui-btn--ghost site-edit" to={`/approvals/${summary.approvalId}`}>결재 보기</Link></div>}
                </header>
                {summary && (
                  <div className="doc-approval">
                    <p><Badge tone={approvalTone(summary.status)}>{APPROVAL_STATUS_LABELS[summary.status] ?? summary.status}</Badge>
                      {summary.selfApproval && <> <Badge tone="warn">자기 승인</Badge></>}</p>
                    <dl className="rec-facts">
                      <div><dt>요청자</dt><dd>{summary.requestedByName || '-'}</dd></div>
                      <div><dt>요청 시각</dt><dd>{shortDateTime(summary.requestedAt) || '-'}</dd></div>
                    </dl>
                    {steps.length > 0 && (
                      <ol className="appr-line">
                        {steps.map((step) => (
                          <li key={step.stepNo} className={`appr-line__step appr-line__step--${stepTone(step.status)}`}>
                            <span className="appr-line__dot" aria-hidden="true">{step.status === 'APPROVED' ? <Icon name="check" size={12} strokeWidth={3} /> : step.status === 'REJECTED' ? '!' : step.stepNo}</span>
                            <div>
                              <p className="appr-line__label"><strong>{step.label}</strong> <span>{APPROVER_ROLE_LABELS[step.requiredRole] ?? step.requiredRole}</span></p>
                              <p className="appr-line__meta">{STEP_STATUS_LABELS[step.status] ?? step.status}{step.decidedByName ? ` · ${step.decidedByName}` : ''}{step.decidedAt ? ` · ${shortDateTime(step.decidedAt)}` : ''}</p>
                              {step.comment && <p className="appr-line__comment">{step.comment}</p>}
                            </div>
                          </li>
                        ))}
                      </ol>
                    )}
                  </div>
                )}
              </section>
            </aside>
          </div>
        )}
      </div>
    </JobPageLayout>
  );
}
