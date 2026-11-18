import { api } from './client';

// Spring 감사보고서 API (현장 관리자 이상). 만들면 바로 GENERATING 으로 돌아오고, AI 요약은 서버가 따로 한 뒤 상태가 바뀐다.
const base = (siteId) => `/api/v1/sites/${encodeURIComponent(siteId)}/audit-reports`;

export const listAuditReports = (siteId) => api(base(siteId));
export const getAuditReport = (siteId, reportId) => api(`${base(siteId)}/${encodeURIComponent(reportId)}`);
/** body: { dateFrom, dateTo, queryTypes } */
export const createAuditReport = (siteId, body) => api(base(siteId), { method: 'POST', body });
/** body: { title, summary, items: [{ queryType, summary }], lockVersion } — 집계·검증 결과는 바뀌지 않는다 */
export const updateAuditReport = (siteId, reportId, body) => api(`${base(siteId)}/${encodeURIComponent(reportId)}`, { method: 'PATCH', body });
export const deleteAuditReport = (siteId, reportId) => api(`${base(siteId)}/${encodeURIComponent(reportId)}`, { method: 'DELETE' });
/** AI 요약 다시 하기 (요약 실패 또는 요약 중으로 오래 멈춘 보고서) */
export const retryAuditReportSummary = (siteId, reportId) => api(`${base(siteId)}/${encodeURIComponent(reportId)}/summarize`, { method: 'POST' });
