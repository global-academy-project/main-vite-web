import { api } from './client.js';
import { jobId, jobWrite } from './jobs.js';

const incidentPath = (id) => `/api/v1/near-misses/${jobId(id)}`;
const requireIncident = (incident) => {
  if (!incident || !Number.isSafeInteger(incident.nearMissId) || !Array.isArray(incident.tags)) {
    throw new Error('아차사고 보고 응답 형식이 올바르지 않습니다.');
  }
  return incident;
};
const requireIncidents = (incidents) => {
  if (!Array.isArray(incidents)) throw new Error('아차사고 목록 응답 형식이 올바르지 않습니다.');
  return incidents.map(requireIncident);
};
const requireWarnings = (warnings) => {
  if (!Array.isArray(warnings) || !warnings.every((warning) => warning
    && Number.isSafeInteger(warning.warningId) && Number.isSafeInteger(warning.workId)
    && ['NEAR_MISS'].includes(warning.sourceType)
    && ['WARN', 'CRITICAL'].includes(warning.severity)
    && typeof warning.message === 'string'
    && (warning.acknowledgedAt == null || typeof warning.acknowledgedAt === 'string'))) {
    throw new Error('작업 경고 응답 형식이 올바르지 않습니다.');
  }
  return warnings;
};

export const getTagCodes = () => api('/api/v1/tag-codes');
export const getSiteZones = (siteId) => api(`/api/v1/sites/${jobId(siteId)}/zones`);
export const getIncidents = async (siteId) => requireIncidents(
  await api(`/api/v1/sites/${jobId(siteId)}/near-misses`),
);
export const getIncident = async (id) => requireIncident(await api(incidentPath(id)));
export const createIncident = async (body) => jobWrite(async () =>
  requireIncident(await api('/api/v1/near-misses', { method: 'POST', body })));
export const reviewIncidentTags = async (id, lockVersion, tags) =>
  jobWrite(async () => requireIncident(await api(`${incidentPath(id)}/tags`, {
    method: 'PUT', body: { lockVersion, tags },
  })));
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
export const searchIncidents = async (body) => requireIncidents(
  await api('/api/v1/incident-search', { method: 'POST', body }),
);
export { getWork } from './jobs.js';
export const getWorkWarnings = async (workId) => requireWarnings(
  await api(`/api/v1/works/${jobId(workId)}/warnings`),
);
export const acknowledgeWarning = (id, note) => jobWrite(async () => {
  const request = { method: 'POST' };
  if (note != null) request.body = { note };
  return api(`/api/v1/warnings/${jobId(id)}/acknowledge`, request);
});
