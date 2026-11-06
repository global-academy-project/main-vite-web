import { localDate } from './job-forms.js';

// 목록 기간 버튼: 오늘 / 7일 / 30일 (오늘 포함, 끝은 오늘)
export const PERIOD_PRESETS = Object.freeze([
  { key: 'today', label: '오늘', days: 1 },
  { key: '7', label: '7일', days: 7 },
  { key: '30', label: '30일', days: 30 },
]);
export const MAX_PERIOD_DAYS = 31;

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const toDate = (value) => new Date(`${value}T00:00:00`);

export function validDate(value) {
  return typeof value === 'string' && ISO.test(value) && !Number.isNaN(toDate(value).getTime());
}

/** 끝 날짜에서 days 일(끝 포함) 거슬러 간 기간 */
export function presetRange(days, today = localDate()) {
  const start = toDate(today); start.setDate(start.getDate() - (days - 1));
  return { from: localDate(start), to: today };
}

/** 지금 기간이 어느 버튼과 같은지 (없으면 null) */
export function presetOf(from, to, today = localDate()) {
  return PERIOD_PRESETS.find((preset) => {
    const range = presetRange(preset.days, today);
    return range.from === from && range.to === to;
  })?.key ?? null;
}

/** 두 날짜 사이 일수 (끝 포함) */
export function periodDays(from, to) {
  return Math.round((toDate(to) - toDate(from)) / 86400000) + 1;
}

/** 기간 검사: 문제가 있으면 안내 문구, 없으면 '' */
export function periodError(from, to, maxDays = MAX_PERIOD_DAYS) {
  if (!validDate(from) || !validDate(to)) return '날짜를 확인하세요.';
  if (to < from) return '끝 날짜는 시작 날짜와 같거나 뒤여야 합니다.';
  if (maxDays && periodDays(from, to) > maxDays) return `기간은 최대 ${maxDays}일까지 볼 수 있습니다.`;
  return '';
}

/** 기간 안의 날짜 목록 (최신 날짜부터) */
export function datesBetween(from, to) {
  const dates = [];
  const day = toDate(to); const first = toDate(from);
  while (day >= first) { dates.push(localDate(day)); day.setDate(day.getDate() - 1); }
  return dates;
}

/** 저장해 둔 기간 읽기: 형식이 틀렸으면 null */
export function parseStoredPeriod(raw, maxDays = MAX_PERIOD_DAYS) {
  try {
    const value = JSON.parse(raw ?? 'null');
    if (!value || periodError(value.from, value.to, maxDays)) return null;
    return { from: value.from, to: value.to };
  } catch { return null; }
}
