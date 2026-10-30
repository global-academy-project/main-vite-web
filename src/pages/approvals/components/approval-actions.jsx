import { useState } from 'react';

export default function ApprovalActions({ busy = false, onApprove, onReject, missingItemOptions = [] }) {
  const [comment, setComment] = useState('');
  const [missingItems, setMissingItems] = useState([]);
  const [error, setError] = useState('');

  const run = (action) => {
    if (action !== 'approve' && !comment.trim()) {
      setError('반려 사유를 입력해 주세요.');
      return;
    }
    setError('');
    if (action === 'approve') onApprove(comment);
    if (action === 'reject') onReject(comment, missingItems);
  };

  return (
    <section className="panel approval-actions">
      <h2>결재 처리</h2>
      <label htmlFor="approval-comment">처리 의견 <span className="required-mark">반려 시 필수 · 500자</span></label>
      <textarea id="approval-comment" maxLength={500} value={comment} onChange={(event) => { setComment(event.target.value); setError(''); }} placeholder="승인 의견 또는 반려 사유" />
      {missingItemOptions.length > 0 && <fieldset className="approval-missing-items"><legend>누락 항목 (선택)</legend>{missingItemOptions.map((item) => <label key={item.key}><input type="checkbox" checked={missingItems.includes(item.key)} onChange={(event) => setMissingItems((current) => event.target.checked ? [...current, item.key] : current.filter((key) => key !== item.key))} />{item.label}</label>)}</fieldset>}
      {error && <p className="approval-action-error" role="alert">{error}</p>}
      <div>
        <button type="button" disabled={busy} onClick={() => run('approve')}>승인</button>
        <button type="button" className="danger" disabled={busy} onClick={() => run('reject')}>반려(보완 요청)</button>
      </div>
    </section>
  );
}
