import { useSyncExternalStore } from 'react';
import { BREAKPOINTS, breakpointOf } from '../utils/breakpoints.js';

function subscribe(onChange) {
  const queries = [
    window.matchMedia(`(max-width: ${BREAKPOINTS.mobile}px)`),
    window.matchMedia(`(max-width: ${BREAKPOINTS.tablet}px)`),
  ];
  queries.forEach((query) => query.addEventListener('change', onChange));
  return () => queries.forEach((query) => query.removeEventListener('change', onChange));
}

const snapshot = () => breakpointOf(window.innerWidth);
const serverSnapshot = () => 'desktop';

/** 지금 화면 크기 구간 'mobile' | 'tablet' | 'desktop'. 분기점을 넘을 때만 다시 그린다. */
export function useBreakpoint() {
  return useSyncExternalStore(subscribe, snapshot, serverSnapshot);
}
