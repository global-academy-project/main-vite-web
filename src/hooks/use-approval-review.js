import { useCallback, useEffect, useRef, useState } from 'react';
import { approveApproval, cancelApproval, getApproval, getApprovalPreview, rejectApproval } from '../api/approvals';

/**
 * 결재 한 건 검토: 상세(결재선·할 수 있는 일)와 문서 미리보기를 동시에 부르고, 승인·반려·회수를 한다.
 * 호출은 기존 api/approvals.js 그대로. 반려 사유 필수(500자), 의견 500자, 누락 항목 30개 이하는 서버 규칙과 같다.
 */
export function useApprovalReview(approvalId) {
  const [state, setState] = useState({ id: null, detail: null, preview: null, error: '', previewError: '' });
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState('');
  const [actionError, setActionError] = useState('');
  const pending = useRef(false);

  useEffect(() => {
    if (!approvalId) return undefined;
    let cancelled = false;
    Promise.allSettled([getApproval(approvalId), getApprovalPreview(approvalId)]).then(([detail, preview]) => {
      if (cancelled) return;
      setState({
        id: approvalId,
        detail: detail.status === 'fulfilled' ? detail.value : null,
        preview: preview.status === 'fulfilled' ? preview.value : null,
        error: detail.status === 'rejected' ? (detail.reason?.message || '결재 정보를 불러오지 못했습니다.') : '',
        errorCode: detail.status === 'rejected' ? detail.reason?.status : null,
        previewError: preview.status === 'rejected' ? (preview.reason?.message || '미리보기를 불러오지 못했습니다.') : '',
      });
    });
    return () => { cancelled = true; };
  }, [approvalId, revision]);

  const reload = useCallback(() => setRevision((value) => value + 1), []);

  /** action: 'approve' | 'reject' | 'cancel'. 성공하면 최신 상세를 돌려준다 */
  const decide = useCallback(async (action, { comment = '', missingItems = [] } = {}) => {
    if (pending.current) return null;
    const text = comment.trim();
    if (action === 'reject' && !text) { setActionError('반려 사유를 입력해 주세요.'); return null; }
    if (text.length > 500) { setActionError('의견은 500자까지 쓸 수 있습니다.'); return null; }
    if (missingItems.length > 30) { setActionError('누락 항목은 30개까지 고를 수 있습니다.'); return null; }
    pending.current = true;
    setBusy(action);
    setActionError('');
    try {
      if (action === 'approve') await approveApproval(approvalId, text);
      if (action === 'reject') await rejectApproval(approvalId, text, missingItems);
      if (action === 'cancel') await cancelApproval(approvalId, text);
      const latest = await getApproval(approvalId);
      setState((prev) => ({ ...prev, detail: latest }));
      return latest;
    } catch (error) {
      setActionError(error.message || '처리하지 못했습니다.');
      return null;
    } finally {
      pending.current = false;
      setBusy('');
    }
  }, [approvalId]);

  const fresh = state.id === approvalId;
  return {
    status: !fresh ? 'loading' : state.detail ? 'ready' : 'error',
    detail: fresh ? state.detail : null,
    preview: fresh ? state.preview : null,
    error: fresh ? state.error : '',
    errorCode: fresh ? state.errorCode : null,
    previewError: fresh ? state.previewError : '',
    busy, actionError, decide, reload,
  };
}
