import { api } from './client.js';
import { jobId, jobWrite } from './jobs.js';

const tbmStatuses = ['DRAFT', 'DONE', 'PENDING', 'APPROVED'];

function requireTbm(tbm, siteId) {
  if (!tbm || !Number.isSafeInteger(tbm.tbmId) || tbm.tbmId < 1
    || !Number.isSafeInteger(tbm.siteId) || !tbmStatuses.includes(tbm.status)
    || !Number.isInteger(tbm.lockVersion) || !Array.isArray(tbm.attendees)
    || !Array.isArray(tbm.works) || typeof tbm.tbmDate !== 'string') {
    throw new Error('TBM 응답 형식이 올바르지 않습니다.');
  }
  if (siteId != null && tbm.siteId !== jobId(siteId)) {
    throw new Error('선택한 현장의 TBM이 아닙니다.');
  }
  return tbm;
}

export async function getTbm(id, siteId) {
  return requireTbm(await api(`/api/v1/tbm/${jobId(id)}`), siteId);
}

export async function getSiteTbms(siteId, date) {
  const site = jobId(siteId);
  const query = date ? `?date=${encodeURIComponent(date)}` : '';
  const records = await api(`/api/v1/sites/${site}/tbm${query}`);
  if (!Array.isArray(records)) throw new Error('TBM 목록 응답 형식이 올바르지 않습니다.');
  return records.map((record) => requireTbm(record, site));
}

export async function getSiteWorkers(siteId) {
  const site = jobId(siteId);
  const workers = await api(`/api/v1/sites/${site}/workers`);
  if (!Array.isArray(workers) || !workers.every((worker) => worker
    && Number.isSafeInteger(worker.workerId) && worker.workerId > 0
    && typeof worker.name === 'string'
    && (worker.lockVersion == null || (Number.isInteger(worker.lockVersion) && worker.lockVersion >= 0)))) {
    throw new Error('현장 작업자 목록 응답 형식이 올바르지 않습니다.');
  }
  return workers;
}

export async function saveTbmAttendees(id, body, siteId) {
  const tbmId = jobId(id);
  return jobWrite(async () => requireTbm(
    await api(`/api/v1/tbm/${tbmId}/attendees`, { method: 'PUT', body }), siteId,
  ));
}

export async function completeTbm(id, body, siteId) {
  const tbmId = jobId(id);
  return jobWrite(async () => requireTbm(
    await api(`/api/v1/tbm/${tbmId}/complete`, { method: 'POST', body }), siteId,
  ));
}

export async function createTbm(siteId, body) {
  const site = jobId(siteId);
  return jobWrite(async () => requireTbm(
    await api(`/api/v1/sites/${site}/tbm`, { method: 'POST', body }), site,
  ));
}

export async function updateTbm(id, body, siteId) {
  const tbmId = jobId(id);
  return jobWrite(async () => requireTbm(
    await api(`/api/v1/tbm/${tbmId}`, { method: 'PUT', body }), siteId,
  ));
}

export async function reopenTbm(id, siteId) {
  const tbmId = jobId(id);
  return jobWrite(async () => requireTbm(
    await api(`/api/v1/tbm/${tbmId}/reopen`, { method: 'POST' }), siteId,
  ));
}

export async function submitTbm(id, siteId) {
  const tbmId = jobId(id);
  return jobWrite(async () => requireTbm(
    await api(`/api/v1/tbm/${tbmId}/submit`, { method: 'POST' }), siteId,
  ));
}
