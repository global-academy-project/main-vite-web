import { useLocation, useNavigate, useParams } from 'react-router-dom';
import SafetyPageLayout from '../../components/safety-page-layout';
import '../../style/records.css';

function RevisionContent() {
  const { approvalId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const mode = location.state?.mode === 'REVISION_REQUESTED' ? '보완' : '반려';
  const approval = location.state?.approval;

  return (
    <section className="panel revision-page">
      <p className="approval-result-eyebrow">{approval?.targetType || '문서'} #{approval?.targetId || approvalId}</p>
      <h1>{mode} 문서 {mode === '반려' ? '재작성' : '수정'}</h1>
      <p>현재는 후속 화면의 진입점이 구성되어 있습니다. 실제 입력 양식은 스키마 렌더러와 문서별 API 연결 후 표시됩니다.</p>
      {approval?.comment && <div className="approval-result-comment"><span>{mode} 사유</span><p>{approval.comment}</p></div>}
      <div className="revision-checklist">
        <strong>처리 전 확인</strong>
        <label><input type="checkbox" /> {mode === '반려' ? '새 revision으로 작성합니다.' : '보완 요청 항목을 수정합니다.'}</label>
        <label><input type="checkbox" /> 수정 후 재제출합니다.</label>
      </div>
      <div className="approval-result-actions">
        <button type="button" disabled onClick={() => navigate(`/records/${approval?.targetType}/${approval?.targetId}`)}>문서 수정 화면 열기</button>
        <button type="button" className="secondary-button" onClick={() => navigate(`/approvals/${approvalId}/result`, { state: { approval, decisionType: mode === '반려' ? 'REJECTED' : 'REVISION_REQUESTED' } })}>처리 결과로 돌아가기</button>
      </div>
    </section>
  );
}

export default function ApprovalRevision() {
  return <SafetyPageLayout title="문서 재작성">{() => <RevisionContent />}</SafetyPageLayout>;
}
