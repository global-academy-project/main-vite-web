import { useCallback, useState } from 'react';

// 날짜 화면의 목록 기간: 고른 날짜까지 오늘(1) · 7일 · 30일. 같은 탭에서는 다른 메뉴에 다녀와도 남는다
export const SPANS = Object.freeze([1, 7, 30]);
export const spanLabel = (days) => (days === 1 ? '오늘' : `${days}일`);

const read = (key) => {
  try { const value = Number(window.sessionStorage.getItem(key)); return SPANS.includes(value) ? value : 1; } catch { return 1; }
};

/** storageKey 예: `tbm:${siteId}`. fixed 가 true 면(특정 문서로 바로 들어온 경우) 저장값 대신 하루 */
export function useSpan(storageKey, { fixed = false } = {}) {
  const key = `span:${storageKey}`;
  const [span, setSpanState] = useState(() => (fixed ? 1 : read(key)));
  const setSpan = useCallback((next) => {
    if (!SPANS.includes(next)) return;
    setSpanState(next);
    try { window.sessionStorage.setItem(key, String(next)); } catch { /* 저장 못 해도 화면은 그대로 */ }
  }, [key]);
  return [span, setSpan];
}
