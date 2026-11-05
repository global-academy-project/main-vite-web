import { useCallback, useEffect, useState } from 'react';
import { getSiteWorks } from '../api/jobs';
import { getJobZones } from '../api/job-reference';

/** 현장 작업 목록(기간) + 구역 이름. 두 요청은 동시에, 하나가 실패해도 다른 하나는 보인다 */
export function useWorkList(siteId, from, to) {
  const [state, setState] = useState({ works: { status: 'loading' }, zones: { status: 'loading' } });
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!siteId || !from || !to) return undefined;
    let cancelled = false;
    Promise.allSettled([getSiteWorks(siteId, from, to), getJobZones(siteId)]).then(([works, zones]) => {
      if (cancelled) return;
      const settle = (r) => (r.status === 'fulfilled' ? { status: 'ready', data: r.value } : { status: 'error', error: r.reason?.message || '불러오지 못했습니다.', code: r.reason?.status });
      setState({ works: settle(works), zones: settle(zones) });
    });
    return () => { cancelled = true; };
  }, [siteId, from, to, revision]);
  const reload = useCallback(() => setRevision((value) => value + 1), []);
  return { ...state, reload };
}
