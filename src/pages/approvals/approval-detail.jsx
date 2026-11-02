import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { approveApproval, cancelApproval, getApproval, getApprovalPreview, rejectApproval } from '../../api/approvals';
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
  const [preview, setPreview] = useState(null);
  const [previewError, setPreviewError] = useState('');

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

  const cancel = async () => {
    if (!window.confirm('이 승인 요청을 회수하시겠습니까?')) return;
    setBusy(true); setError('');
    try { setData(await cancelApproval(approvalId)); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };

  const loadPreview = async () => {
    setPreviewError('');
    try { setPreview(await getApprovalPreview(approvalId)); }
    catch (e) { setPreview(null); setPreviewError(e.message || '미리보기를 불러오지 못했습니다.'); }
  };

  if (!data) return error ? <p className="dashboard-error">{error}</p> : <p>승인 정보를 불러오는 중입니다...</p>;
  return (
    <>
      <div className="page-heading"><h1>승인 상세</h1><p>{data.summary?.targetType} #{data.summary?.targetId}</p></div>
      {error && <p className="dashboard-error" role="alert">{error}</p>}
      <ApprovalSummary approval={data} />
      <ApprovalTimeline steps={data.steps} />
      <section className="panel approval-preview" aria-labelledby="approval-preview-title">
        <div className="records-panel-heading"><h2 id="approval-preview-title">문서 미리보기</h2><button type="button" className="secondary-button" onClick={loadPreview}>불러오기</button></div>
        {previewError && <p className="dashboard-error" role="alert">{previewError}</p>}
        {preview && <PreviewContent preview={preview} />}
      </section>
      {data.canDecide && <ApprovalActions
        busy={busy}
        onApprove={(comment) => decide('approve', comment)}
        onReject={(comment, missingItems) => decide('reject', comment, missingItems)}
      />}
      {data.canCancel && <button type="button" className="secondary-button" disabled={busy} onClick={cancel}>승인 요청 회수</button>}
    </>
  );
}

function PreviewContent({ preview }) {
  const markLabels = { DRAFT: '작성 중 · 정식 문서 아님', PENDING: '승인 전 미리보기', REJECTED: '반려됨 · 정식 문서 아님', SUPERSEDED: '이전 판 · 정식 문서 아님' };
  const content = preview.content || preview.data || {};
  return <div className="approval-preview-content">
    {preview.mark && <p className="approval-preview-mark" role="status">{markLabels[preview.mark] || preview.mark}</p>}
    <dl>{Object.entries(content).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value ?? '-')}</dd></div>)}</dl>
  </div>;
}

export default function ApprovalDetail() { return <SafetyPageLayout title="승인 상세">{() => <Detail />}</SafetyPageLayout>; }
