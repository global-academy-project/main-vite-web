import { api } from './client.js';
import { jobId } from './jobs.js';

export async function getSafetyDashboard(siteId, date) {
  const site = jobId(siteId);
  const data = await api(`/api/v1/sites/${site}/dashboard${date ? `?date=${encodeURIComponent(date)}` : ''}`);
  const nonnegative = (value) => Number.isSafeInteger(value) && value >= 0;
  if (data?.siteId !== site || typeof data.date !== 'string'
    || !nonnegative(data.works?.total) || !nonnegative(data.works?.blocked)
    || !data.works.byStatus || typeof data.works.byStatus !== 'object'
    || !Object.values(data.works.byStatus).every(nonnegative)
    || !Array.isArray(data.items) || !data.items.every((item) => item && typeof item.type === 'string'
      && nonnegative(item.count) && typeof item.overdue === 'boolean' && Array.isArray(item.entries))) {
    throw new Error('대시보드 응답 형식 또는 현장이 올바르지 않습니다.');
  }
  return data;
}

/** GET /sites/{site}/dashboard/summary?from=&to= : 기간 날짜별 작업·차단·미완료 건수, 기간 합계, 지금 기준 현황 */
export async function getSafetyDashboardSummary(siteId, from, to) {
  const site = jobId(siteId);
  const params = new URLSearchParams({ from, to });
  const data = await api(`/api/v1/sites/${site}/dashboard/summary?${params}`);
  const nonnegative = (value) => Number.isSafeInteger(value) && value >= 0;
  const counts = (map) => map && typeof map === 'object' && Object.values(map).every(nonnegative);
  if (data?.siteId !== site || !Array.isArray(data.days)
    || !data.days.every((day) => day && typeof day.date === 'string' && nonnegative(day.works) && nonnegative(day.blocked) && counts(day.incomplete))
    || !counts(data.totals) || !nonnegative(data.current?.correctiveOpen) || !nonnegative(data.current?.correctiveOverdue)
    || !nonnegative(data.current?.approvalOverdue)) {
    throw new Error('기간 요약 응답 형식 또는 현장이 올바르지 않습니다.');
  }
  return data;
}
