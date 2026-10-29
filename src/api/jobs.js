import { api } from './client.js';

export function jobId(value) {
  const text = String(value ?? '').trim();
  if (!/^[1-9]\d*$/.test(text) || !Number.isSafeInteger(Number(text))) {
    throw new Error('ID는 정확한 양의 정수로 입력해 주세요.');
  }
  return Number(text);
}

export function requireWork(work, siteId) {
  if (!work || !Number.isSafeInteger(work.workId) || work.workId < 1
    || !Number.isSafeInteger(work.siteId) || typeof work.title !== 'string') {
    throw new Error('작업 응답 형식이 올바르지 않습니다.');
  }
  if (work.siteId !== jobId(siteId)) throw new Error('선택한 현장의 작업이 아닙니다.');
  return work;
}

function requirePermit(permit, siteId) {
  if (!permit || !Number.isSafeInteger(permit.permitId) || permit.permitId < 1
    || !Number.isSafeInteger(permit.workId) || !Number.isInteger(permit.lockVersion)
    || !Array.isArray(permit.measurements) || typeof permit.canSubmit !== 'boolean'
    || !['HOT', 'CONFINED', 'HEIGHT'].includes(permit.permitType)
    || !['DRAFT', 'CHECKING', 'BLOCKED', 'PENDING', 'APPROVED', 'SUSPENDED', 'REJECTED', 'CLOSED', 'SUPERSEDED'].includes(permit.status)
    || (permit.lastEvaluation !== null && (!permit.lastEvaluation
      || !['PASS', 'WARN', 'BLOCK'].includes(permit.lastEvaluation.result)
      || !Array.isArray(permit.lastEvaluation.violations)))) {
    throw new Error('허가서 응답 형식이 올바르지 않습니다.');
  }
  if (permit.siteId !== jobId(siteId)) throw new Error('선택한 현장의 허가서가 아닙니다.');
  return permit;
}

export function validatePeriod(from, to) {
  if (!from || !to || !Number.isFinite(Date.parse(from)) || !Number.isFinite(Date.parse(to))
    || Date.parse(to) <= Date.parse(from)) {
    throw new Error('종료 일시는 시작 일시보다 뒤여야 합니다.');
  }
}

export const measurementFields = {
  HOT: [{ code: 'LEL', label: '가연성가스 (% LEL)' }],
  CONFINED: [
    { code: 'O2', label: '산소 (%)' }, { code: 'CO2', label: '탄산가스 (%)' },
    { code: 'CO', label: '일산화탄소 (ppm)' }, { code: 'H2S', label: '황화수소 (ppm)' },
    { code: 'LEL', label: '가연성가스 (% LEL)' },
    { code: 'NH3', label: '암모니아 (ppm)' }, { code: 'CL2', label: '염소 (ppm)' },
  ],
  HEIGHT: [],
};

export function measurementItems(type, values) {
  if (!Object.hasOwn(measurementFields, type)) throw new Error('허가 유형이 올바르지 않습니다.');
  const items = [];
  for (const { code } of measurementFields[type]) {
    const raw = String(values[code] ?? '').trim();
    if (!raw) continue;
    const value = Number(raw);
    if (!Number.isFinite(value) || value < 0 || (['O2', 'CO2', 'LEL'].includes(code) && value > 100)) {
      throw new Error(`${code}: 0 이상의 측정값을 입력하세요. 백분율은 100 이하여야 합니다.`);
    }
    items.push({ item: code, value });
  }
  if (!items.length) throw new Error('저장할 측정값을 하나 이상 입력해 주세요.');
  return items;
}

export const createWork = async (body) =>
  requireWork(await api('/api/v1/works', { method: 'POST', body }), body.siteId);
export const getWork = (id) => api(`/api/v1/works/${jobId(id)}`);
export const getPermit = async (id, siteId) =>
  requirePermit(await api(`/api/v1/permits/${jobId(id)}`), siteId);
export const createPermit = async (body, siteId) =>
  requirePermit(await api('/api/v1/permits', { method: 'POST', body }), siteId);
export const updatePermit = async (id, body, siteId) =>
  requirePermit(await api(`/api/v1/permits/${jobId(id)}`, { method: 'PUT', body }), siteId);
export const saveMeasurements = async (id, items, siteId) =>
  requirePermit(await api(`/api/v1/permits/${jobId(id)}/measurements`, { method: 'POST', body: { items } }), siteId);
export async function checkPermit(id) {
  const result = await api(`/api/v1/permits/${jobId(id)}/check`, { method: 'POST' });
  if (result?.permitId !== jobId(id) || !['PASS', 'WARN', 'BLOCK'].includes(result.evaluation?.result)
    || !Number.isInteger(result.evaluation.rulesApplied) || result.evaluation.rulesApplied < 0
    || !Array.isArray(result.evaluation.violations) || !Array.isArray(result.evaluation.unusedFields)) {
    throw new Error('허가서 판정 응답 형식이 올바르지 않습니다.');
  }
  return result;
}
export const submitPermit = async (id, siteId) =>
  requirePermit(await api(`/api/v1/permits/${jobId(id)}/submit`, { method: 'POST' }), siteId);
