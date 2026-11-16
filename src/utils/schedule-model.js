// 홈 일정 카드 계산 (순수 함수). 서버 작업 목록(/sites/{id}/works?from&to)만 쓴다. 31일을 넘는 범위는 만들지 않는다.
import { WORK_TYPE_LABELS } from './home-model.js';

export const SCHEDULE_VIEWS = Object.freeze([
  { key: 'day', label: '하루' },
  { key: 'week', label: '주간' },
  { key: 'month', label: '월간' },
  { key: 'list', label: '목록' },
]);
/** 종류 → 색 이름 (tokens.css --type-*) */
export const TYPE_KEYS = Object.freeze({ GENERAL: 'general', HOT: 'hot', HEIGHT: 'height', CONFINED: 'confined' });
export const TYPE_FILTERS = Object.freeze([
  { key: 'ALL', label: '전체' },
  ...['GENERAL', 'HOT', 'HEIGHT', 'CONFINED'].map((type) => ({ key: type, label: type === 'CONFINED' ? '밀폐' : WORK_TYPE_LABELS[type] })),
]);
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

const pad = (value) => String(value).padStart(2, '0');
/** 'yyyy-mm-dd' → Date (현지 자정) */
export const parseDate = (text) => { const [y, m, d] = text.split('-').map(Number); return new Date(y, m - 1, d); };
export const formatDate = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
export const addDays = (text, days) => { const date = parseDate(text); date.setDate(date.getDate() + days); return formatDate(date); };
export const addMonths = (text, months) => { const date = parseDate(text); const day = date.getDate(); date.setDate(1); date.setMonth(date.getMonth() + months); const last = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate(); date.setDate(Math.min(day, last)); return formatDate(date); };

/** 주는 일요일부터 (우리 달력 기준, 11/16) */
export function weekStart(text) {
  return addDays(text, -parseDate(text).getDay());
}

/** 보기별 조회 범위 [from, to] (월간도 한 달 = 31일 이하) */
export function rangeFor(view, anchor) {
  if (view === 'week') { const from = weekStart(anchor); return [from, addDays(from, 6)]; }
  if (view === 'month') {
    const date = parseDate(anchor);
    return [formatDate(new Date(date.getFullYear(), date.getMonth(), 1)), formatDate(new Date(date.getFullYear(), date.getMonth() + 1, 0))];
  }
  return [anchor, anchor];
}

/** 전·다음 이동 */
export function shiftAnchor(view, anchor, step) {
  if (view === 'week') return addDays(anchor, 7 * step);
  if (view === 'month') return addMonths(anchor, step);
  return addDays(anchor, step);
}

/** 보기마다 같은 형식(yyyy. mm. dd): 하루 "2026. 11. 16 (월)" · 주간 "2026. 11. 16 ~ 11. 22" · 월간 "2026. 11" */
export function rangeLabel(view, anchor) {
  const date = parseDate(anchor);
  if (view === 'week') {
    const [from, to] = rangeFor('week', anchor).map(parseDate);
    return `${from.getFullYear()}. ${pad(from.getMonth() + 1)}. ${pad(from.getDate())} ~ ${pad(to.getMonth() + 1)}. ${pad(to.getDate())}`;
  }
  if (view === 'month') return `${date.getFullYear()}. ${pad(date.getMonth() + 1)}`;
  return dayLabel(anchor, true);
}
export const dayLabel = (text, withYear = false) => {
  const date = parseDate(text);
  return `${withYear ? `${date.getFullYear()}. ` : ''}${withYear ? pad(date.getMonth() + 1) : date.getMonth() + 1}. ${withYear ? pad(date.getDate()) : date.getDate()} (${WEEKDAYS[date.getDay()]})`;
};
export const weekdayOf = (text) => WEEKDAYS[parseDate(text).getDay()];

/** 서버 LocalDateTime → 그날 0시부터 분 (없으면 null) */
export function minutesOf(value) {
  if (typeof value !== 'string' || value.length < 16) return null;
  const hours = Number(value.slice(11, 13));
  const minutes = Number(value.slice(14, 16));
  return Number.isFinite(hours) && Number.isFinite(minutes) ? hours * 60 + minutes : null;
}
/** 작업 날짜: workDate 가 있으면 그것, 없으면 startAt 날짜 */
export const workDay = (work) => work.workDate || (typeof work.startAt === 'string' ? work.startAt.slice(0, 10) : '');
export const hasTime = (work) => minutesOf(work.startAt) != null;

export function filterByType(works, type) {
  return type === 'ALL' ? works : works.filter((work) => work.workType === type);
}

/** 그날 시간표 세로 범위: 기본 06~18시, 작업이 더 이르거나 늦으면 넓힌다 (시 단위) */
export function hourRange(works) {
  let [start, end] = [6, 18];
  works.forEach((work) => {
    const from = minutesOf(work.startAt);
    const to = minutesOf(work.endAt);
    if (from != null) start = Math.min(start, Math.floor(from / 60));
    if (to != null) end = Math.max(end, Math.ceil(to / 60));
    else if (from != null) end = Math.max(end, Math.ceil(from / 60) + 1);
  });
  return [Math.max(0, start), Math.min(24, Math.max(end, start + 1))];
}

/**
 * 하루 보기 열 = 구역. 그날 작업이 있는 구역만, 구역 순서는 현장 설정 순서. 구역 없는 작업은 "구역 미지정" 열.
 * zones: [{ zoneId, name }]
 */
export function dayColumns(works, zones = []) {
  const used = new Set(works.map((work) => work.zoneId ?? null));
  const columns = zones.filter((zone) => used.has(zone.zoneId)).map((zone) => ({ key: String(zone.zoneId), zoneId: zone.zoneId, name: zone.name }));
  works.forEach((work) => {
    if (work.zoneId != null && !columns.some((column) => column.zoneId === work.zoneId)) {
      columns.push({ key: String(work.zoneId), zoneId: work.zoneId, name: `구역 #${work.zoneId}` });
    }
  });
  if (used.has(null)) columns.push({ key: 'none', zoneId: null, name: '구역 미지정' });
  return columns;
}

/**
 * 한 열 안 블록 위치. 겹치면 옆으로 나란히(lane). top·height 는 분 단위 (시작 시각 기준).
 * 끝 시각이 없으면 1시간으로 그린다. 반환: [{ work, start, end, lane, lanes }]
 */
export function layoutBlocks(works) {
  const items = works
    .map((work) => {
      const start = minutesOf(work.startAt);
      const rawEnd = minutesOf(work.endAt);
      const end = rawEnd != null && rawEnd > start ? rawEnd : start + 60;
      return { work, start, end };
    })
    .filter((item) => item.start != null)
    .sort((a, b) => a.start - b.start || b.end - a.end);
  const out = [];
  let group = [];
  let groupEnd = -1;
  const flush = () => {
    const lanes = [];
    group.forEach((item) => {
      let lane = lanes.findIndex((laneEnd) => laneEnd <= item.start);
      if (lane < 0) { lane = lanes.length; lanes.push(item.end); } else lanes[lane] = item.end;
      out.push({ ...item, lane });
    });
    out.slice(out.length - group.length).forEach((item) => { item.lanes = lanes.length; });
    group = [];
  };
  items.forEach((item) => {
    if (group.length && item.start >= groupEnd) flush();
    group.push(item);
    groupEnd = Math.max(groupEnd, item.end);
  });
  if (group.length) flush();
  return out;
}

/** 주간 7칸 */
export function weekDays(anchor) {
  const from = weekStart(anchor);
  return Array.from({ length: 7 }, (_, index) => addDays(from, index));
}

/** 월간 달력: 일요일 시작 주 단위 칸 (앞뒤 달 날짜는 outside) */
export function monthCells(anchor) {
  const [first, last] = rangeFor('month', anchor);
  const start = weekStart(first);
  const cells = [];
  for (let day = start; day <= last || cells.length % 7; day = addDays(day, 1)) {
    cells.push({ date: day, outside: day < first || day > last });
  }
  return cells;
}

/** 날짜별 묶음 { 'yyyy-mm-dd': [작업] } (시작 시각 순, 시간 미정은 뒤) */
export function byDay(works) {
  const map = {};
  works.forEach((work) => { const day = workDay(work); if (day) (map[day] ??= []).push(work); });
  Object.values(map).forEach((list) => list.sort((a, b) => (minutesOf(a.startAt) ?? 9999) - (minutesOf(b.startAt) ?? 9999)));
  return map;
}

/** "08:40" */
export const clockOf = (minutes) => `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
