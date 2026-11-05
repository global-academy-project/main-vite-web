import { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { getApproval } from '../../api/approvals';
import SafetyPageLayout from '../../components/safety-page-layout';
import Icon from '../../components/ui/icon.jsx';
import PageHeader from '../../components/ui/page-header.jsx';
import StatusView from '../../components/ui/status-view.jsx';
import { APPROVAL_TARGET_LABELS } from '../../utils/home-model.js';
import { jobRecordPath } from '../../utils/job-forms.js';
import '../../styles/home.css';
import '../../styles/work.css';
import '../../styles/approvals.css';

// 문서 화면에서 반려 문서를 새 판으로 다시 만드는 방법 (각 화면에 이미 있는 기능)
const howTo = {
  RISK: '위험성평가 화면에서 "반려 평가 새 판 작성"을 누르면 반려된 내용을 복사한 새 판이 만들어집니다. 고친 뒤 다시 승인 요청하세요.',
  PERMIT: '작업허가 화면에서 반려 사유에 맞춰 측정값·확인 항목을 고치고 다시 판정한 뒤 승인 요청하세요.',
  TBM: '반려된 TBM은 작성 중으로 돌아갑니다. TBM 화면에서 내용을 고친 뒤 "TBM 확인 요청"을 다시 누르세요.',
};

/** 반려 문서 다시 작성 안내: 반려 사유·누락 항목을 보여 주고 해당 문서 화면으로 보낸다 */
function RevisionContent() {
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
  if (!approval) return <StatusView kind="loading" />;
  const summary = approval.summary || approval;
  const docPath = jobRecordPath(summary.targetType, summary.targetId);

  return (
    <>
      <PageHeader title="반려 문서 다시 작성" description={`결재 #${approvalId}`} actions={<Link className="ui-btn ui-btn--ghost" to="/approvals">승인함 목록</Link>} />
    <section className="home-panel appr-done appr-done--block" aria-labelledby="revision-title">
      <span className="appr-done__icon" aria-hidden="true"><Icon name="records" size={26} /></span>
      <p className="appr-done__eyebrow">{APPROVAL_TARGET_LABELS[summary.targetType] ?? summary.targetType} #{summary.targetId}</p>
      <h1 id="revision-title" className="appr-done__title">반려 문서 다시 작성</h1>
      {summary.title && <p className="appr-done__doc">{summary.title}</p>}
      {summary.comment && <div className="appr-done__box"><span>반려 사유</span><p>{summary.comment}</p></div>}
      {approval.missingItems?.length > 0 && <div className="appr-done__box"><span>누락 항목</span><ul>{approval.missingItems.map((key) => <li key={key}>{key}</li>)}</ul></div>}
      <p className="appr-done__desc">{howTo[summary.targetType] ?? '문서 화면에서 반려 사유에 맞춰 고친 뒤 다시 승인 요청하세요.'}</p>
      <div className="appr-done__actions">
        {docPath ? <Link className="ui-btn ui-btn--primary ui-btn--lg" to={docPath}>문서 화면에서 다시 작성</Link> : <span className="appr-hint">이 문서 종류는 아직 웹 화면이 없습니다.</span>}
        <Link className="ui-btn ui-btn--ghost ui-btn--lg" to={`/approvals/${approvalId}/result`} state={{ approval, decisionType: 'REJECTED' }}>처리 결과로 돌아가기</Link>
      </div>
    </section>
    </>
  );
}

export default function ApprovalRevision() {
  return <SafetyPageLayout title="문서 재작성">{() => <RevisionContent />}</SafetyPageLayout>;
}
