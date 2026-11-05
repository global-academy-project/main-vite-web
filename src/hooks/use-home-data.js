import { useCallback, useEffect, useState } from 'react';
import { getPendingApprovals, getRequestedApprovals } from '../api/approvals';
import { getSafetyDashboard } from '../api/dashboard';
import { getSiteWorks } from '../api/jobs';
import { getJobZones } from '../api/job-reference';
import { localDate } from '../utils/home-model.js';

const idle = { status: 'loading', data: null, error: '' };
const requireRows = (rows) => {
  if (!Array.isArray(rows)) throw new Error('승인 목록 응답 형식이 올바르지 않습니다.');
  return rows;
};
const settle = (result) => (result.status === 'fulfilled'
  ? { status: 'ready', data: result.value, error: '' }
  : { status: 'error', data: null, error: result.reason?.message || '불러오지 못했습니다.', code: result.reason?.status });

/**
 * 홈에 필요한 것을 동시에 부른다 (Promise.allSettled). 한 칸이 실패해도 나머지 칸은 보인다.
 * 승인함은 역할과 상관없이 두 목록(결재 대기 · 내 요청)을 다 부른다 (홈 카드 모양을 역할마다 같게).
 */
export function useHomeData(siteId) {
  const [state, setState] = useState({ dashboard: idle, works: idle, pending: idle, requested: idle, zones: idle });
  const [revision, setRevision] = useState(0);
  const date = localDate();

  useEffect(() => {
    if (!siteId) return undefined;
    let cancelled = false;
    Promise.allSettled([
      getSafetyDashboard(siteId, date),
      getSiteWorks(siteId, date),
      getPendingApprovals(siteId).then(requireRows),
      getRequestedApprovals(siteId).then(requireRows),
      getJobZones(siteId),
    ]).then(([dashboard, works, pending, requested, zones]) => {
      if (!cancelled) setState({ dashboard: settle(dashboard), works: settle(works), pending: settle(pending), requested: settle(requested), zones: settle(zones) });
    });
    return () => { cancelled = true; };
  }, [siteId, date, revision]);

  // 다시 부를 때는 이전 값을 그대로 보여 주다가 바꾼다 (깜빡임 방지)
  const reload = useCallback(() => setRevision((value) => value + 1), []);
  return { ...state, date, reload };
}
