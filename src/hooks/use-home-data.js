import { useCallback, useEffect, useState } from 'react';
import { getPendingApprovals, getRequestedApprovals } from '../api/approvals';
import { getSafetyDashboard } from '../api/dashboard';
import { getSiteWorks } from '../api/jobs';
import { getJobZones } from '../api/job-reference';
import { localDate } from '../utils/home-model.js';

const idle = { status: 'loading', data: null, error: '' };
const settle = (result) => (result.status === 'fulfilled'
  ? { status: 'ready', data: result.value, error: '' }
  : { status: 'error', data: null, error: result.reason?.message || '불러오지 못했습니다.', code: result.reason?.status });

/**
 * 홈에 필요한 것을 동시에 부른다 (Promise.allSettled). 한 칸이 실패해도 나머지 칸은 보인다.
 * approver 이면 승인 대기 목록, 아니면 내가 올린 요청 목록.
 */
export function useHomeData(siteId, { approver = false } = {}) {
  const [state, setState] = useState({ dashboard: idle, works: idle, approvals: idle, zones: idle });
  const [revision, setRevision] = useState(0);
  const date = localDate();

  useEffect(() => {
    if (!siteId) return undefined;
    let cancelled = false;
    Promise.allSettled([
      getSafetyDashboard(siteId, date),
      getSiteWorks(siteId, date),
      (approver ? getPendingApprovals : getRequestedApprovals)(siteId).then((rows) => {
        if (!Array.isArray(rows)) throw new Error('승인 목록 응답 형식이 올바르지 않습니다.');
        return rows;
      }),
      getJobZones(siteId),
    ]).then(([dashboard, works, approvals, zones]) => {
      if (!cancelled) setState({ dashboard: settle(dashboard), works: settle(works), approvals: settle(approvals), zones: settle(zones) });
    });
    return () => { cancelled = true; };
  }, [siteId, approver, date, revision]);

  // 다시 부를 때는 이전 값을 그대로 보여 주다가 바꾼다 (깜빡임 방지)
  const reload = useCallback(() => setRevision((value) => value + 1), []);
  return { ...state, date, reload };
}
