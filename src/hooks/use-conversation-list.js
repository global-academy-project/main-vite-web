import { useCallback, useEffect, useState } from 'react';
import { getAgentConversations } from '../api/agents';

/** 내 지난 대화 목록 (현장 · 대화 종류별). reload() 로 다시 받는다 */
export function useConversationList({ siteId, taskType }) {
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState({ key: null, items: [], error: '' });
  const key = `${siteId}:${taskType}:${revision}`;
  useEffect(() => {
    if (!siteId) return undefined;
    let active = true;
    getAgentConversations({ siteId, taskType }).then((items) => { if (active) setState({ key, items, error: '' }); })
      .catch((requestError) => {
        // 서버에 목록 API 가 아직 없으면(404) 오류 대신 안내만 (대화 자체는 그대로 쓸 수 있다)
        const message = requestError.status === 404 ? '지난 대화 목록은 서버 업데이트 후 볼 수 있습니다.' : requestError.message || '지난 대화를 불러오지 못했습니다.';
        if (active) setState({ key, items: [], error: message, unavailable: requestError.status === 404 });
      });
    return () => { active = false; };
  }, [siteId, taskType, key]);
  const reload = useCallback(() => setRevision((value) => value + 1), []);
  const ready = state.key === key;
  // 다시 받는 동안에는 이전 목록을 그대로 보여 준다 (깜빡임 방지)
  return { items: state.items, error: ready ? state.error : '', unavailable: ready && Boolean(state.unavailable), loading: Boolean(siteId) && !ready && !state.items.length, reload };
}
