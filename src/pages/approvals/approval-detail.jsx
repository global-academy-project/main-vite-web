import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { approveApproval, getApproval, rejectApproval } from '../../api/approvals';
import SafetyPageLayout from '../../components/safety-page-layout';
import ApprovalActions from './components/approval-actions';
import ApprovalSummary from './components/approval-summary';
import ApprovalTimeline from './components/approval-timeline';
import '../../style/records.css';

function Detail() {
  const { approvalId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () => getApproval(approvalId).then(setData).catch((e) => setError(e.message));
  useEffect(load, [approvalId]);

  const decide = async (action, comment = '', missingItems = []) => {
    if (action === 'reject' && !comment.trim()) { setError('반려 사유를 입력해 주세요.'); return; }
    setBusy(true); setError('');
    try {
      if (action === 'approve') await approveApproval(approvalId, comment);
      if (action === 'reject') await rejectApproval(approvalId, comment, missingItems);
      const result = await getApproval(approvalId);
      navigate(`/approvals/${approvalId}/result`, {
        state: { approval: result, decisionType: result.summary?.status },
      });
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };

  if (!data) return error ? <p className="dashboard-error">{error}</p> : <p>승인 정보를 불러오는 중입니다...</p>;
  return (
    <>
      <div className="page-heading"><h1>승인 상세</h1><p>{data.summary?.targetType} #{data.summary?.targetId}</p></div>
      {error && <p className="dashboard-error" role="alert">{error}</p>}
      <ApprovalSummary approval={data} />
      <ApprovalTimeline steps={data.steps} />
      {data.canDecide && <ApprovalActions
        busy={busy}
        onApprove={(comment) => decide('approve', comment)}
        onReject={(comment, missingItems) => decide('reject', comment, missingItems)}
      />}
    </>
  );
}

export default function ApprovalDetail() { return <SafetyPageLayout title="승인 상세">{() => <Detail />}</SafetyPageLayout>; }
