import { useEffect, useState } from 'react';
import { getSiteWorks } from '../api/jobs';
import { rangeFor } from '../utils/schedule-model.js';

const idle = { status: 'loading', data: null, error: '' };

/**
 * 일정 카드가 보여 줄 작업. 오늘 하루(하루·목록 보기)는 홈이 이미 부른 오늘 작업을 그대로 쓰고,
 * 다른 날·주간·월간은 같은 작업 목록 API 를 범위(from~to, 31일 이하)로 부른다. 서버는 바꾸지 않는다.
 */
export function useScheduleWorks(siteId, view, anchor, today, todayWorks, revision) {
  const [from, to] = rangeFor(view, anchor);
  const own = !(from === today && to === today);
  const [state, setState] = useState({ key: '', section: idle });
  const key = `${siteId}:${from}:${to}:${revision}`;

  useEffect(() => {
    if (!own || !siteId) return undefined;
    let cancelled = false;
    getSiteWorks(siteId, from, to)
      .then((data) => { if (!cancelled) setState({ key, section: { status: 'ready', data, error: '' } }); })
      .catch((error) => { if (!cancelled) setState({ key, section: { status: 'error', data: null, error: error?.message || '불러오지 못했습니다.', code: error?.status } }); });
    return () => { cancelled = true; };
  }, [own, siteId, from, to, key]);

  if (!own) return { section: todayWorks, from, to };
  // 범위를 바꾼 직후에는 이전 목록을 흐리게 두지 않고 불러오는 중으로 보인다 (다른 날 작업이 섞여 보이지 않게)
  return { section: state.key === key ? state.section : idle, from, to };
}
