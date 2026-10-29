import { api } from './client.js';
import { jobId } from './jobs.js';

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
export async function autoTagIncident(id, lockVersion) {
  if (!Number.isSafeInteger(lockVersion) || lockVersion < 0) {
    throw new Error('보고의 최신 버전 번호가 필요합니다.');
  }
  const started = await api(`${incidentPath(jobId(id))}/auto-tags`, { method: 'POST', body: { lockVersion } });
  if (!Number.isSafeInteger(started?.runId) || started.runId < 1) {
    throw new Error('자동 태깅 실행 시작 응답 형식이 올바르지 않습니다.');
  }
  return started;
}
export const searchIncidents = (body) => api('/api/v1/incident-search', { method: 'POST', body });
export { getWork } from './jobs.js';
export const getWorkWarnings = (workId) => api(`/api/v1/works/${encodeURIComponent(workId)}/near-miss-warnings`);
export const syncWorkWarnings = (workId) =>
  api(`/api/v1/works/${encodeURIComponent(workId)}/near-miss-warnings`, { method: 'POST' });
export const acknowledgeWarning = (id, note) =>
  api(`/api/v1/work-warnings/${encodeURIComponent(id)}/acknowledge`, { method: 'POST', body: { note } });
