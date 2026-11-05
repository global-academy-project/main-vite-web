import { useCallback, useEffect, useState } from 'react';
import { getPendingApprovals, getRequestedApprovals } from '../api/approvals';

const settle = (result) => {
  if (result.status === 'rejected') return { status: 'error', rows: [], error: result.reason?.message || '불러오지 못했습니다.', code: result.reason?.status };
  if (!Array.isArray(result.value)) return { status: 'error', rows: [], error: '승인 목록 응답 형식이 올바르지 않습니다.' };
  return { status: 'ready', rows: result.value, error: '' };
};

/**
 * 승인함 두 목록을 동시에 부른다: 내 승인 대기(pending) · 내가 요청한 문서(mine=requested).
 * 서버가 주는 목록은 이 둘뿐이다. 한쪽이 실패해도 다른 쪽은 보인다.
 * 응답에 현장 번호를 같이 기억해, 현장이 바뀐 직후 이전 현장 목록이 보이지 않게 한다.
 */
export function useApprovalInbox(siteId) {
  const [state, setState] = useState({ siteId: null, pending: null, requested: null });
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!siteId) return undefined;
    let cancelled = false;
    Promise.allSettled([getPendingApprovals(siteId), getRequestedApprovals(siteId)]).then(([pending, requested]) => {
      if (!cancelled) setState({ siteId, pending: settle(pending), requested: settle(requested) });
    });
    return () => { cancelled = true; };
  }, [siteId, revision]);
  const loading = { status: 'loading', rows: [], error: '' };
  const fresh = state.siteId === siteId;
  const reload = useCallback(() => setRevision((value) => value + 1), []);
  return { pending: fresh ? state.pending : loading, requested: fresh ? state.requested : loading, reload };
}
