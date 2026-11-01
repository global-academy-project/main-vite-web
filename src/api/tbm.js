import { api } from './client.js';
import { jobId, jobWrite } from './jobs.js';

const tbmStatuses = ['DRAFT', 'DONE', 'APPROVED'];

function requireTbm(tbm, siteId) {
  if (!tbm || !Number.isSafeInteger(tbm.tbmId) || tbm.tbmId < 1
    || !Number.isSafeInteger(tbm.siteId) || !tbmStatuses.includes(tbm.status)
    || !Number.isInteger(tbm.lockVersion) || !Array.isArray(tbm.attendees)) {
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
    && typeof worker.name === 'string')) {
    throw new Error('현장 작업자 목록 응답 형식이 올바르지 않습니다.');
  }
  return workers;
}

export async function saveTbmAttendees(id, body, siteId) {
  return jobWrite(async () => requireTbm(
    await api(`/api/v1/tbm/${jobId(id)}/attendees`, { method: 'PUT', body }), siteId,
  ));
}

export async function completeTbm(id, body, siteId) {
  return jobWrite(async () => requireTbm(
    await api(`/api/v1/tbm/${jobId(id)}/complete`, { method: 'POST', body }), siteId,
  ));
}
