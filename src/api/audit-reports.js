import { api } from './client';

// Spring 감사보고서 API 계약. 현재 서버가 준비되면 이 어댑터의 경로만 유지해서 연결한다.
const base = (siteId) => `/api/v1/sites/${encodeURIComponent(siteId)}/audit-reports`;

export const listAuditReports = (siteId) => api(base(siteId));
export const getAuditReport = (siteId, reportId) => api(`${base(siteId)}/${encodeURIComponent(reportId)}`);
export const createAuditReport = (siteId, body) => api(base(siteId), { method: 'POST', body });
export const updateAuditReport = (siteId, reportId, body) => api(`${base(siteId)}/${encodeURIComponent(reportId)}`, { method: 'PATCH', body });
export const deleteAuditReport = (siteId, reportId) => api(`${base(siteId)}/${encodeURIComponent(reportId)}`, { method: 'DELETE' });
export const exportAuditReportPdf = (siteId, reportId) => api(`${base(siteId)}/${encodeURIComponent(reportId)}/export`, { method: 'POST', responseType: 'blob' });
