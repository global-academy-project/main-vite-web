import { api } from './client';

function queryString(filters) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== '' && value !== null && value !== undefined) params.set(key, value);
  });
  return params.toString();
}

export function searchRecords(siteId, filters) {
  return api(`/api/v1/sites/${siteId}/records?${queryString(filters)}`);
}

export function getRecordDetail(recordType, recordId) {
  return api(`/api/v1/records/${recordType}/${recordId}`);
}

export function askRecordQuestion(siteId, request) {
  return api(`/api/v1/sites/${siteId}/record-queries`, { method: 'POST', body: request });
}

export function createAuditReportDraft(siteId, request) {
  return api(`/api/v1/sites/${siteId}/audit-reports/draft`, { method: 'POST', body: request });
}

export function getDailySafetyLogs(siteId) {
  return api(`/api/v1/sites/${siteId}/daily-safety-logs`);
}

export function createDailySafetyLogDraft(siteId, request) {
  return api(`/api/v1/sites/${siteId}/daily-safety-logs/draft`, { method: 'POST', body: request });
}

export function submitDailySafetyLog(logId) {
  return api(`/api/v1/daily-safety-logs/${logId}/submit`, { method: 'POST' });
}
