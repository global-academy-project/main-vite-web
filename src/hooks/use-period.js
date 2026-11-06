import { useCallback, useState } from 'react';
import { localDate } from '../utils/job-forms.js';
import { MAX_PERIOD_DAYS, parseStoredPeriod, periodError, presetOf, presetRange } from '../utils/period-model.js';

const read = (key, maxDays) => {
  try { return parseStoredPeriod(window.sessionStorage.getItem(key), maxDays); } catch { return null; }
};
const write = (key, value) => {
  try { window.sessionStorage.setItem(key, JSON.stringify(value)); } catch { /* 저장 못 해도 화면은 그대로 */ }
};

/**
 * 목록 기간(from~to). 다른 메뉴에 다녀와도 같은 탭에서는 고른 기간이 남는다 (sessionStorage `period:${storageKey}`).
 * 처음이거나 저장값이 틀렸으면 오늘. 잘못 고른 기간은 바꾸지 않고 error 로 알린다.
 */
export function usePeriod(storageKey, { maxDays = MAX_PERIOD_DAYS } = {}) {
  const key = `period:${storageKey}`;
  const today = localDate();
  const [period, setPeriodState] = useState(() => read(key, maxDays) ?? { from: today, to: today });
  const [error, setError] = useState('');

  const setPeriod = useCallback((from, to) => {
    const message = periodError(from, to, maxDays);
    setError(message);
    if (message) return;
    const next = { from, to };
    setPeriodState(next); write(key, next);
  }, [key, maxDays]);

  const pick = useCallback((days) => { const range = presetRange(days); setPeriod(range.from, range.to); }, [setPeriod]);

  return { from: period.from, to: period.to, preset: presetOf(period.from, period.to, today), error, setPeriod, pick };
}
