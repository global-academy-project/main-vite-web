import { useEffect, useState } from 'react';

/** 다시 보내기 같은 버튼을 잠깐 잠근다. start() 후 seconds 동안 remaining 이 줄어든다 */
export function useCooldown(seconds = 60) {
  const [until, setUntil] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (until <= now) return undefined;
    const timer = setTimeout(() => setNow(Date.now()), 1000);
    return () => clearTimeout(timer);
  }, [until, now]);
  const remaining = Math.max(0, Math.ceil((until - now) / 1000));
  return { remaining, start: () => { const at = Date.now(); setNow(at); setUntil(at + seconds * 1000); } };
}
