// 작업 현황 화면용 계산 (서버 대시보드 응답만 쓴다)
import { jobRecordPath } from './job-forms.js';
import { TODO_TYPES, WORK_STATUS_LABELS, toneOf } from './home-model.js';

const STATUS_ORDER = ['DRAFT', 'PENDING', 'APPROVED', 'IN_PROGRESS', 'BLOCKED', 'REJECTED', 'DONE'];

/** byStatus → 순서 있는 막대 조각 [{ status, label, count, tone, ratio }] (0건 제외) */
export function statusSegments(byStatus = {}) {
  const keys = [...STATUS_ORDER, ...Object.keys(byStatus).filter((key) => !STATUS_ORDER.includes(key))];
  const total = Object.values(byStatus).reduce((sum, count) => sum + count, 0);
  return keys.filter((key) => byStatus[key] > 0).map((status) => ({
    status, label: WORK_STATUS_LABELS[status] ?? status, count: byStatus[status], tone: toneOf(status),
    ratio: total ? byStatus[status] / total : 0,
  }));
}

/** 미완료 한 건이 열 화면. 안전일지 미작성은 기록이 없어 그날 안전일지로 */
export function entryPath(entry, date) {
  if (entry.targetType === 'DAILY_LOG' && entry.targetId == null) return `/job/daily-safety?date=${date}`;
  if (entry.targetType === 'CORRECTIVE_ACTION') return null;
  return jobRecordPath(entry.targetType, entry.targetId);
}

/** "HH:MM" (서버 LocalDateTime 문자열에서) */
export const clockOf = (value) => (typeof value === 'string' && value.length >= 16 ? value.slice(11, 16) : '');

/** 마감 시각 줄: [{ key, label, time, passed }] */
export function deadlineRows(deadlines) {
  if (!deadlines) return [];
  return [
    { key: 'tbm', label: 'TBM 마감', time: clockOf(deadlines.tbmDeadline), passed: deadlines.tbmPassed },
    { key: 'log', label: '안전일지 마감', time: clockOf(deadlines.dailyLogDeadline), passed: deadlines.dailyLogPassed },
    { key: 'approval', label: '결재 처리 기한', time: `${deadlines.approvalDueMinutes}분`, passed: false },
  ];
}

/** 팀별: 미완료·차단 많은 순 */
export function teamRows(teams = []) {
  return [...teams].sort((a, b) => b.incomplete - a.incomplete || b.blocked - a.blocked || b.works - a.works);
}

/** 기간 요약 → 날짜별 막대 [{ date, label, works, blocked, incomplete }] 와 가장 큰 값 */
export function summaryBars(summary) {
  const days = (summary?.days ?? []).map((day) => ({
    date: day.date, label: day.date.slice(5).replace('-', '/'), works: day.works, blocked: day.blocked,
    incomplete: Object.values(day.incomplete ?? {}).reduce((sum, count) => sum + count, 0),
  }));
  const max = Math.max(1, ...days.map((day) => Math.max(day.works, day.incomplete)));
  return { days, max };
}

/** 기간 합계를 화면 순서대로 (날짜와 무관한 두 항목은 서버가 빼므로 제외) */
export function summaryTotals(totals = {}) {
  return TODO_TYPES.filter(({ type }) => type in totals).map(({ type, label }) => ({ type, label, count: totals[type] }));
}

/** 기준일로 끝나는 n일 범위 */
export function rangeEnding(date, days = 7) {
  const end = new Date(`${date}T00:00:00`);
  const start = new Date(end);
  start.setDate(end.getDate() - (days - 1));
  const iso = (value) => `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
  return { from: iso(start), to: iso(end) };
}
