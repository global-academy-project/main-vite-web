import { api } from './client';

const incidentPath = (id) => `/api/v1/near-misses/${encodeURIComponent(id)}`;
const requireIncident = (incident) => {
  if (!incident || !Number.isSafeInteger(incident.nearMissId) || !Array.isArray(incident.tags)) {
    throw new Error('아차사고 보고 응답 형식이 올바르지 않습니다.');
  }
  return incident;
};

export const getTagCodes = (siteId) => api(`/api/v1/tag-codes?siteId=${encodeURIComponent(siteId)}`);
export const getSiteZones = (siteId) => api(`/api/v1/sites/${encodeURIComponent(siteId)}/zones`);
export const getIncidents = (siteId) => api(`/api/v1/near-misses?siteId=${encodeURIComponent(siteId)}`);
export const getIncident = async (id) => requireIncident(await api(incidentPath(id)));
export const createIncident = async (body) => requireIncident(await api('/api/v1/near-misses', { method: 'POST', body }));
export const reviewIncidentTags = async (id, lockVersion, tags) =>
  requireIncident(await api(`${incidentPath(id)}/tags`, { method: 'PUT', body: { lockVersion, tags } }));
export const autoTagIncident = async (id, lockVersion) =>
  requireIncident(await api(`${incidentPath(id)}/auto-tags`, { method: 'POST', body: { lockVersion } }));
export const searchIncidents = (body) => api('/api/v1/incident-search', { method: 'POST', body });
export { getWork } from './jobs.js';
export const getWorkWarnings = (workId) => api(`/api/v1/works/${encodeURIComponent(workId)}/near-miss-warnings`);
export const syncWorkWarnings = (workId) =>
  api(`/api/v1/works/${encodeURIComponent(workId)}/near-miss-warnings`, { method: 'POST' });
export const acknowledgeWarning = (id, note) =>
  api(`/api/v1/work-warnings/${encodeURIComponent(id)}/acknowledge`, { method: 'POST', body: { note } });
