import { api } from './client';

export function getSafetyDashboard(siteId, date) {
  return api(`/api/v1/sites/${siteId}/dashboard?date=${encodeURIComponent(date)}`);
}

export function getSafetyDashboardSummary(siteId, from, to) {
  const params = new URLSearchParams({ from, to });
  return api(`/api/v1/sites/${siteId}/dashboard/summary?${params}`);
}
