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
/**
 * 자동 태깅 시작 (POST /near-misses/{id}/auto-tags → 202 {runId}). 보고자 본인 또는 승인자 이상, 사람이 아직 태그를 저장하지 않은 보고만.
 * AI 태그는 제안으로 저장되고, 사람이 태그를 저장해야 확정된다.
 */
export async function autoTagIncident(id, lockVersion) {
  if (!Number.isSafeInteger(lockVersion) || lockVersion < 0) {
    throw new Error('보고의 최신 버전 번호가 필요합니다.');
  }
  return jobWrite(async () => {
    const started = await api(`${incidentPath(jobId(id))}/auto-tags`, { method: 'POST', body: { lockVersion } });
    if (!Number.isSafeInteger(started?.runId) || started.runId < 1) {
      throw new Error('자동 태깅 실행 시작 응답 형식이 올바르지 않습니다.');
    }
    return started;
  });
}

const AUTO_TAG_STATUSES = ['PROCESSING', 'DONE', 'FAILED'];
/**
 * 자동 태깅 실행 상태 (GET /agent/runs/{runId}, 실행 종류 NEAR_MISS_TAG, 대화 없음).
 * DONE 이면 result: { nearMissId, savedCount, skipped[], taggingSource, model, ... }, FAILED 이면 errorMessage
 */
export async function getAutoTagRun(runId, nearMissId) {
  const id = jobId(runId);
  const data = await api(`/api/v1/agent/runs/${id}`);
  if (!data || data.runId !== id || data.taskType !== 'NEAR_MISS_TAG' || !AUTO_TAG_STATUSES.includes(data.status)
    || (data.status === 'DONE' && (!data.result || data.result.nearMissId !== jobId(nearMissId)
      || !Number.isSafeInteger(data.result.savedCount)))) {
    throw new Error('자동 태깅 실행 응답 형식이 올바르지 않습니다.');
  }
  return data;
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
