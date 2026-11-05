import { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { getApproval } from '../../api/approvals';
import SafetyPageLayout from '../../components/safety-page-layout';
import Icon from '../../components/ui/icon.jsx';
import StatusView from '../../components/ui/status-view.jsx';
import { APPROVER_ROLE_LABELS, nextStep } from '../../utils/approval-model.js';
import { APPROVAL_TARGET_LABELS } from '../../utils/home-model.js';
import { jobRecordPath } from '../../utils/job-forms.js';
import '../../styles/home.css';
import '../../styles/work.css';
import '../../styles/approvals.css';

const resultCopy = {
  APPROVED: { title: '승인 완료', description: '최종 승인되었습니다. 요청자에게 알림이 갑니다.', tone: 'done', icon: 'check' },
  PENDING: { title: '다음 단계 승인 대기', description: '이 단계는 승인되었고 다음 승인자의 처리를 기다리고 있습니다.', tone: 'wait', icon: 'check' },
  REJECTED: { title: '반려 완료', description: '문서가 반려되었습니다. 요청자는 사유를 확인한 뒤 새 판으로 다시 작성합니다.', tone: 'block', icon: 'alert' },
  CANCELED: { title: '회수됨', description: '요청자가 승인 요청을 회수했습니다.', tone: 'neutral', icon: 'info' },
};

/** 결재 처리 결과. 이전 화면에서 넘겨받은 결과가 없으면(새로고침·링크) 서버에서 다시 읽는다 */
function ApprovalResultContent() {
  const { approvalId } = useParams();
  const location = useLocation();
  const passed = location.state?.approval ?? null;
  const [loaded, setLoaded] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (passed) return undefined;
    let cancelled = false;
    getApproval(approvalId)
      .then((data) => { if (!cancelled) setLoaded(data); })
      .catch((requestError) => { if (!cancelled) setError(requestError.message); });
    return () => { cancelled = true; };
  }, [passed, approvalId]);

  const approval = passed ?? loaded;
  if (error) return <StatusView kind="error" message={error} onRetry={() => window.location.reload()} />;
  if (!approval) return <StatusView kind="loading" title="처리 결과를 불러오는 중입니다" />;

  const summary = approval.summary || approval;
  const status = location.state?.decisionType || summary.status;
  const copy = resultCopy[status] || resultCopy.PENDING;
  const next = nextStep(approval);
  const docPath = jobRecordPath(summary.targetType, summary.targetId);

  return (
    <section className={`home-panel appr-done appr-done--${copy.tone}`} aria-labelledby="appr-done-title">
      <span className="appr-done__icon" aria-hidden="true"><Icon name={copy.icon} size={28} strokeWidth={2.4} /></span>
      <p className="appr-done__eyebrow">{APPROVAL_TARGET_LABELS[summary.targetType] ?? summary.targetType} #{summary.targetId}</p>
      <h1 id="appr-done-title" className="appr-done__title">{copy.title}</h1>
      <p className="appr-done__desc">{copy.description}</p>
      {summary.title && <p className="appr-done__doc">{summary.title}</p>}
      {next && status === 'PENDING' && (
        <div className="appr-done__box"><span>다음 승인 단계</span><strong>{next.label}</strong><small>{APPROVER_ROLE_LABELS[next.requiredRole] ?? next.requiredRole}의 처리를 기다리고 있습니다.</small></div>
      )}
      {summary.comment && (
        <div className="appr-done__box"><span>{status === 'REJECTED' ? '반려 사유' : '처리 의견'}</span><p>{summary.comment}</p></div>
      )}
      <div className="appr-done__actions">
        {status === 'REJECTED' && <Link className="ui-btn ui-btn--primary ui-btn--lg" to={`/approvals/${approvalId}/revision`} state={{ approval }}>새 판으로 다시 작성</Link>}
        <Link className="ui-btn ui-btn--secondary ui-btn--lg" to="/approvals">승인함으로</Link>
        {docPath && <Link className="ui-btn ui-btn--ghost ui-btn--lg" to={docPath}>문서 화면 열기</Link>}
      </div>
    </section>
  );
}

export default function ApprovalResult() {
  return <SafetyPageLayout title="승인 처리 결과">{() => <ApprovalResultContent />}</SafetyPageLayout>;
}
