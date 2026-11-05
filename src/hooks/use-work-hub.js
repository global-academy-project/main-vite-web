import { useCallback, useEffect, useState } from 'react';
import { getSiteWorks, getWork, requireWork } from '../api/jobs';
import { getJobZones } from '../api/job-reference';

/**
 * 작업 허브 데이터. 작업 상세(GET /works/{id})로 날짜를 알고, 그날 목록에서 붙은 문서 요약(허가·평가·TBM)을 찾는다.
 * 서버에 새 경로를 만들지 않고 있는 API 두 개로 채운다.
 */
export function useWorkHub(siteId, workId) {
  const [state, setState] = useState({ status: 'loading', work: null, zones: [], error: '' });
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!siteId || !workId) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const detail = requireWork(await getWork(workId), siteId);
        const [list, zones] = await Promise.allSettled([getSiteWorks(siteId, detail.workDate), getJobZones(siteId)]);
        const brief = list.status === 'fulfilled' ? list.value.find((item) => item.workId === detail.workId) : null;
        if (!cancelled) {
          setState({
            status: 'ready',
            work: { permits: [], riskAssessment: null, tbm: null, ...brief, ...detail, briefMissing: !brief },
            zones: zones.status === 'fulfilled' ? zones.value : [],
            error: list.status === 'rejected' ? '붙은 문서 목록을 불러오지 못했습니다.' : '',
          });
        }
      } catch (error) {
        if (!cancelled) setState({ status: 'error', work: null, zones: [], error: error.message || '작업을 불러오지 못했습니다.', code: error.status });
      }
    })();
    return () => { cancelled = true; };
  }, [siteId, workId, revision]);
  const reload = useCallback(() => setRevision((value) => value + 1), []);
  return { ...state, reload };
}
