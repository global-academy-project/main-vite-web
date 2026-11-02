import { api } from './client.js';
import { jobId, jobWrite } from './jobs.js';

const sitePath = (siteId) => `/api/v1/sites/${jobId(siteId)}`;

function requireEntry(entry, idField, siteId) {
  if (!entry || !Number.isSafeInteger(entry[idField]) || entry[idField] < 1
    || typeof entry.name !== 'string'
    || (siteId != null && entry.siteId !== jobId(siteId))) {
    throw new Error('기준 정보 응답 형식 또는 현장이 올바르지 않습니다.');
  }
  return entry;
}

async function list(path, idField, siteId) {
  const entries = await api(path);
  if (!Array.isArray(entries)) throw new Error('기준 정보 목록 응답 형식이 올바르지 않습니다.');
  return entries.map((entry) => requireEntry(entry, idField, siteId));
}

export const getTeams = (includeInactive = false) =>
  list(`/api/v1/teams?includeInactive=${includeInactive}`, 'teamId');
export const getJobZones = (siteId, includeInactive = false) =>
  list(`${sitePath(siteId)}/zones?includeInactive=${includeInactive}`, 'zoneId', siteId);

export async function saveTeam(id, body) {
  const path = id == null ? '/api/v1/admin/teams' : `/api/v1/admin/teams/${jobId(id)}`;
  return jobWrite(async () => requireEntry(await api(path, {
    method: id == null ? 'POST' : 'PUT', body,
  }), 'teamId'));
}

export async function saveZone(siteId, id, body) {
  const path = `${sitePath(siteId)}/zones${id == null ? '' : `/${jobId(id)}`}`;
  return jobWrite(async () => requireEntry(await api(path, {
    method: id == null ? 'POST' : 'PUT', body,
  }), 'zoneId', siteId));
}

export async function saveWorker(siteId, id, body) {
  if (id != null && (!Number.isInteger(body.lockVersion) || body.lockVersion < 0)) {
    throw new Error('작업자 수정에는 최신 lockVersion이 필요합니다. 작업자 목록을 다시 조회하세요.');
  }
  const path = `${sitePath(siteId)}/workers${id == null ? '' : `/${jobId(id)}`}`;
  return jobWrite(async () => requireEntry(await api(path, {
    method: id == null ? 'POST' : 'PUT', body,
  }), 'workerId'));
}

export async function changeWorkerAssignment(siteId, workerId, action, date) {
  if (!['assign', 'leave'].includes(action)) throw new Error('작업자 배치 동작이 올바르지 않습니다.');
  const path = `${sitePath(siteId)}/workers/${jobId(workerId)}/${action}`;
  return jobWrite(() => api(path, { method: 'POST', body: date ? { date } : {} }));
}

export function referencePermissions(user, site) {
  return {
    manageSite: user?.role === 'ADMIN' || ['ADMIN', 'SITE_ADMIN'].includes(site?.role),
    manageTeams: user?.role === 'ADMIN',
  };
}
