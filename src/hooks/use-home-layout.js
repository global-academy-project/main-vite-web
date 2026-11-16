import { useCallback, useState, useSyncExternalStore } from 'react';
import { DEFAULT_LAYOUT, isCustomLayout, readLayout, sanitizeLayout, writeLayout } from '../utils/home-layout.js';

const storage = () => { try { return window.localStorage; } catch { return null; } };

/**
 * 홈 배치(칸 순서·AI 폭·위치·접힘·일정 보기). 이 브라우저에 사용자별로 기억한다 (utils/home-layout.js).
 * 사용자가 바뀌면(로그인 계정이 달라지면) 그 사용자의 배치를 다시 읽는다.
 */
export function useHomeLayout(userId) {
  const [state, setState] = useState(() => ({ userId, layout: readLayout(storage(), userId) }));
  const current = state.userId === userId ? state.layout : readLayout(storage(), userId);
  if (state.userId !== userId) setState({ userId, layout: current });

  const update = useCallback((patch) => {
    setState((prev) => {
      const next = sanitizeLayout({ ...prev.layout, ...(typeof patch === 'function' ? patch(prev.layout) : patch) });
      writeLayout(storage(), prev.userId, next);
      return { ...prev, layout: next };
    });
  }, []);
  // 기본 배치로: PC 배치만 되돌린다 (일정 보기 종류·모바일 접힘은 그대로)
  const reset = useCallback(() => update((layout) => ({ ...DEFAULT_LAYOUT, top: [...DEFAULT_LAYOUT.top], view: layout.view, mobileOpen: layout.mobileOpen })), [update]);
  return { layout: current, custom: isCustomLayout(current), update, reset };
}

/** 미디어 쿼리 하나 (좁은 PC 에서 AI 자동 접힘 등) */
export function useMediaQuery(query) {
  return useSyncExternalStore(
    (onChange) => { const list = window.matchMedia(query); list.addEventListener('change', onChange); return () => list.removeEventListener('change', onChange); },
    () => window.matchMedia(query).matches,
    () => false,
  );
}
