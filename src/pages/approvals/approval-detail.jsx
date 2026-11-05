import { Link, useNavigate, useParams } from 'react-router-dom';
import SafetyPageLayout from '../../components/safety-page-layout';
import ApprovalReview from '../../components/approvals/approval-review.jsx';
import PageHeader from '../../components/ui/page-header.jsx';
import '../../styles/home.css';
import '../../styles/work.css';
import '../../styles/approvals.css';

/**
 * 결재 상세 전체 화면 (알림·공유 링크로 들어오는 곳). 승인함 드로어와 같은 검토 부품을 쓴다.
 * 승인·반려 뒤에는 기존처럼 처리 결과 화면(/approvals/:id/result)으로 간다. 회수는 이 화면에 남는다.
 */
function Detail() {
  const { approvalId } = useParams();
  const navigate = useNavigate();
  return (
    <div className="work-hub appr-page">
      <PageHeader title="결재 검토" description={`결재 #${approvalId}`} actions={<Link className="ui-btn ui-btn--ghost" to="/approvals">승인함 목록</Link>} />
      <ApprovalReview layout="page" approvalId={approvalId} onDecided={(latest, action) => {
        if (action === 'cancel') return;
        navigate(`/approvals/${approvalId}/result`, { state: { approval: latest, decisionType: latest.summary?.status } });
      }} />
    </div>
  );
}

export default function ApprovalDetail() {
  return <SafetyPageLayout title="결재 검토">{() => <Detail />}</SafetyPageLayout>;
}
