import { useState } from 'react';

export default function ApprovalActions({ busy = false, onApprove, onRequestRevision, onReject }) {
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');

  const run = (action) => {
    if (action !== 'approve' && !comment.trim()) {
      setError(action === 'reject' ? '반려 사유를 입력해 주세요.' : '보완 요청 사유를 입력해 주세요.');
      return;
    }
    setError('');
    if (action === 'approve') onApprove(comment);
    if (action === 'revision') onRequestRevision(comment);
    if (action === 'reject') onReject(comment);
  };

  return (
    <section className="panel approval-actions">
      <h2>결재 처리</h2>
      <label htmlFor="approval-comment">처리 의견 <span className="required-mark">반려·보완 요청 시 필수</span></label>
      <textarea id="approval-comment" value={comment} onChange={(event) => { setComment(event.target.value); setError(''); }} placeholder="승인 의견 또는 반려·보완 사유" />
      {error && <p className="approval-action-error" role="alert">{error}</p>}
      <div>
        <button type="button" disabled={busy} onClick={() => run('approve')}>승인</button>
        <button type="button" className="secondary" disabled={busy} onClick={() => run('revision')}>보완 요청</button>
        <button type="button" className="danger" disabled={busy} onClick={() => run('reject')}>반려</button>
      </div>
    </section>
  );
}
