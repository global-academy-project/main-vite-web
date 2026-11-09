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
 * 날짜 화면(TBM·점검표)의 목록 기간 from~to. 끝 날짜(to)가 그 화면의 기준 날짜(새로 만들 때 기본 날짜)다.
 * 같은 탭에서는 다른 메뉴에 다녀와도 남는다 (sessionStorage `period:${storageKey}`).
 * fixed: 주소로 날짜·문서를 정해 들어온 경우 저장값 대신 그날 하루.
 * 결과의 period 는 components/period-bar.jsx 에 그대로 넘긴다.
 */
export function useDateRange(storageKey, initialDate, { fixed = false, maxDays = MAX_PERIOD_DAYS } = {}) {
  const key = `period:${storageKey}`;
  const [range, setRange] = useState(() => (!fixed && read(key, maxDays)) || { from: initialDate, to: initialDate });
  const [error, setError] = useState('');

  const apply = useCallback((next) => { setError(''); setRange(next); write(key, next); }, [key]);

  /** 사용자가 기간을 고름: 틀리면 바꾸지 않고 안내. guard 는 바꾸기 전 확인(저장 안 한 내용 등) */
  const setPeriod = useCallback((from, to) => {
    const message = periodError(from, to, maxDays);
    if (message) { setError(message); return; }
    apply({ from, to });
  }, [apply, maxDays]);

  /** 저장한 문서 날짜가 지금 기간 밖이면 그날 하루로 옮긴다 (기간 안이면 그대로) */
  const include = useCallback((day) => {
    if (!day) return;
    setRange((current) => {
      if (day >= current.from && day <= current.to) return current;
      const next = { from: day, to: day }; write(key, next); return next;
    });
  }, [key]);

  const period = {
    from: range.from, to: range.to, error, preset: presetOf(range.from, range.to, localDate()),
    setPeriod, pick: (days) => { const next = presetRange(days); setPeriod(next.from, next.to); },
  };
  return { from: range.from, to: range.to, period, setPeriod, include };
}
