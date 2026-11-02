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

export function getSafetyDashboardSummary(siteId, from, to) {
  const params = new URLSearchParams({ from, to });
  return api(`/api/v1/sites/${siteId}/dashboard/summary?${params}`);
}
