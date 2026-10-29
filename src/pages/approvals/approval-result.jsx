import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { getApproval } from '../../api/approvals';
import SafetyPageLayout from '../../components/safety-page-layout';
import '../../style/records.css';

const resultCopy = {
  APPROVED: {
    title: '승인 완료',
    description: '현재 결재 단계가 승인되었습니다.',
    tone: 'approved',
  },
  PENDING: {
    title: '다음 단계 승인 대기',
    description: '현재 단계가 승인되었으며 다음 승인자의 처리를 기다리고 있습니다.',
    tone: 'waiting',
  },
  REJECTED: {
    title: '반려 완료',
    description: '문서가 반려되었습니다. 반려 사유를 확인한 뒤 다시 작성해 주세요.',
    tone: 'rejected',
  },
  REVISION_REQUESTED: {
    title: '보완 요청 완료',
    description: '보완이 필요한 항목이 작성자에게 전달되었습니다.',
    tone: 'revision',
  },
};

function ApprovalResultContent() {
  const { approvalId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [approval, setApproval] = useState(location.state?.approval || null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (approval) return undefined;
    let cancelled = false;
    getApproval(approvalId).then((data) => {
      if (!cancelled) setApproval(data);
    }).catch((requestError) => {
      if (!cancelled) setError(requestError.message);
    });
    return () => { cancelled = true; };
  }, [approval, approvalId]);

  if (error) return <p className="dashboard-error" role="alert">{error}</p>;
  if (!approval) return <p role="status">처리 결과를 불러오는 중입니다...</p>;

  const decisionType = location.state?.decisionType;
  const status = decisionType || approval.decisionType || approval.status;
  const copy = resultCopy[status] || resultCopy.PENDING;
  const currentStep = approval.steps?.find((step) => step.status === 'PENDING');

  return (
    <section className={`panel approval-result approval-result-${copy.tone}`}>
      <div className="approval-result-icon" aria-hidden="true">{copy.tone === 'approved' || copy.tone === 'waiting' ? '✓' : '!'}</div>
      <p className="approval-result-eyebrow">{approval.targetType} #{approval.targetId}</p>
      <h1>{copy.title}</h1>
      <p className="approval-result-description">{copy.description}</p>
      {approval.title && <p className="approval-result-document">{approval.title}</p>}
      {currentStep && (
        <div className="approval-next-step">
          <span>다음 승인 단계</span>
          <strong>{currentStep.label}</strong>
          <small>{currentStep.requiredRole}의 처리를 기다리고 있습니다.</small>
        </div>
      )}
      {approval.comment && (
        <div className="approval-result-comment">
          <span>{status === 'REVISION_REQUESTED' ? '보완 요청 사유' : '처리 의견'}</span>
          <p>{approval.comment}</p>
        </div>
      )}
      <div className="approval-result-actions">
        {(status === 'REJECTED' || status === 'REVISION_REQUESTED') && (
          <button type="button" onClick={() => navigate(`/approvals/${approvalId}/revision`, { state: { approval, mode: status } })}>
            {status === 'REJECTED' ? '새 revision 작성' : '보완 항목 수정'}
          </button>
        )}
        <Link className="secondary-button" to="/approvals">승인함으로 이동</Link>
        <Link className="secondary-button" to={`/records/${approval.targetType}/${approval.targetId}`}>기록 상세 보기</Link>
      </div>
    </section>
  );
}

export default function ApprovalResult() {
  return <SafetyPageLayout title="승인 처리 결과">{() => <ApprovalResultContent />}</SafetyPageLayout>;
}
