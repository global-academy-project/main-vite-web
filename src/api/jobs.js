import { api, ApiError } from './client.js';

export async function jobWrite(request) {
  try {
    return await request();
  } catch (error) {
    if (error.code === 'NETWORK_ERROR' || error.code === 'INVALID_RESPONSE'
      || error.status >= 500 || !error.code) {
      const uncertain = new ApiError('WRITE_OUTCOME_UNKNOWN',
        `${error.message || '쓰기 요청 응답 오류'} 저장 결과를 확인할 수 없습니다. 서버에는 반영되었을 수 있으므로 재전송 전에 반영 여부를 확인하세요.`,
        null, error.status ?? 0);
      uncertain.cause = error;
      throw uncertain;
    }
    throw error;
  }
}

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

function requireWorkSummary(work, siteId) {
  requireWork(work, siteId);
  if (typeof work.workDate !== 'string' || typeof work.status !== 'string'
    || !Array.isArray(work.permits)
    || work.permits.some((permit) => !permit || !Number.isSafeInteger(permit.permitId)
      || typeof permit.permitType !== 'string' || typeof permit.status !== 'string')
    || (work.riskAssessment != null && (!Number.isSafeInteger(work.riskAssessment.riskAssessmentId)
      || typeof work.riskAssessment.status !== 'string'))
    || (work.tbm != null && (!Number.isSafeInteger(work.tbm.tbmId)
      || typeof work.tbm.status !== 'string'))) {
    throw new Error('작업 목록 응답 형식이 올바르지 않습니다.');
  }
  return work;
}

function requireDateOnly(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)
    || !Number.isFinite(Date.parse(`${value}T00:00:00Z`))
    || new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) !== value) {
    throw new Error('조회 날짜는 YYYY-MM-DD 형식이어야 합니다.');
  }
}

function requireRiskAssessment(assessment, expectedWorkId) {
  if (!assessment || !Number.isSafeInteger(assessment.riskAssessmentId)
    || !Number.isSafeInteger(assessment.siteId) || !Number.isSafeInteger(assessment.workId)
    || assessment.workId !== expectedWorkId || !Array.isArray(assessment.items)
    || typeof assessment.status !== 'string' || typeof assessment.canSubmit !== 'boolean'
    || !Number.isInteger(assessment.lockVersion)) {
    throw new Error('위험성평가 응답 형식이 올바르지 않습니다.');
  }
  return assessment;
}

function requireTbm(tbm, expectedWorkId) {
  if (!tbm || !Number.isSafeInteger(tbm.tbmId) || !Number.isSafeInteger(tbm.siteId)
    || typeof tbm.tbmDate !== 'string' || typeof tbm.status !== 'string'
    || !Array.isArray(tbm.points) || !Array.isArray(tbm.works)
    || !tbm.works.some((work) => work?.workId === expectedWorkId)) {
    throw new Error('TBM 응답 형식이 올바르지 않습니다.');
  }
  return tbm;
}

function requirePermit(permit, siteId) {
  if (!permit || !Number.isSafeInteger(permit.permitId) || permit.permitId < 1
    || !Number.isSafeInteger(permit.workId) || !Number.isInteger(permit.lockVersion)
    || !Array.isArray(permit.measurements) || typeof permit.canSubmit !== 'boolean'
    || !['HOT', 'CONFINED', 'HEIGHT'].includes(permit.permitType)
    || !['DRAFT', 'CHECKING', 'BLOCKED', 'PENDING', 'APPROVED', 'SUSPENDED', 'REJECTED', 'CLOSED', 'SUPERSEDED'].includes(permit.status)
    || (permit.lastEvaluation != null && (!permit.lastEvaluation
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
  jobWrite(async () => requireWork(await api('/api/v1/works', { method: 'POST', body }), body.siteId));
export const getWork = (id) => api(`/api/v1/works/${jobId(id)}`);
export async function getSiteWorks(siteId, { from, to } = {}) {
  const id = jobId(siteId);
  const params = new URLSearchParams();
  if (from) {
    requireDateOnly(from);
    params.set('from', from);
  }
  if (to) {
    requireDateOnly(to);
    params.set('to', to);
  }
  if (from && to && Date.parse(`${to}T00:00:00Z`) < Date.parse(`${from}T00:00:00Z`)) {
    throw new Error('종료일은 시작일보다 앞설 수 없습니다.');
  }
  if (from && to && Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`) > 30 * 24 * 60 * 60 * 1000) {
    throw new Error('작업 목록은 한 번에 31일까지 조회할 수 있습니다.');
  }
  const query = params.toString();
  const works = await api(`/api/v1/sites/${id}/works${query ? `?${query}` : ''}`);
  if (!Array.isArray(works)) throw new Error('작업 목록 응답 형식이 올바르지 않습니다.');
  return works.map((work) => requireWorkSummary(work, id));
}
export async function getWorkRiskAssessment(workId) {
  const id = jobId(workId);
  return requireRiskAssessment(await api(`/api/v1/works/${id}/risk-assessment`), id);
}
export async function getWorkTbm(workId) {
  const id = jobId(workId);
  return requireTbm(await api(`/api/v1/works/${id}/tbm`), id);
}
export const getPermit = async (id, siteId) =>
  requirePermit(await api(`/api/v1/permits/${jobId(id)}`), siteId);
export const createPermit = async (body, siteId) =>
  jobWrite(async () => requirePermit(await api('/api/v1/permits', { method: 'POST', body }), siteId));
export async function updatePermit(id, body, siteId) {
  const path = `/api/v1/permits/${jobId(id)}`;
  return jobWrite(async () => requirePermit(await api(path, { method: 'PUT', body }), siteId));
}
export async function saveMeasurements(id, items, siteId) {
  const path = `/api/v1/permits/${jobId(id)}/measurements`;
  return jobWrite(async () => requirePermit(await api(path, { method: 'POST', body: { items } }), siteId));
}
export function requireRuleEvaluation(evaluation) {
  if (!evaluation || !['PASS', 'WARN', 'BLOCK'].includes(evaluation.result)
    || !Number.isInteger(evaluation.rulesApplied) || evaluation.rulesApplied < 0
    || !Array.isArray(evaluation.violations) || !Array.isArray(evaluation.unusedFields)
    || !Array.isArray(evaluation.checks) || evaluation.checks.length !== evaluation.rulesApplied
    || !evaluation.checks.every((item) => item && typeof item.ruleCode === 'string'
      && typeof item.category === 'string' && ['PASS', 'FAIL', 'MISSING'].includes(item.status)
      && ['BLOCK', 'WARN'].includes(item.severity)
      && typeof item.target === 'string' && typeof item.expected === 'string'
      && ['actual', 'message', 'action', 'legalBasis', 'sourceUrl'].every((field) =>
        item[field] == null || typeof item[field] === 'string'))) {
    throw new Error('규칙 상세 판정(checks) 응답 형식이 올바르지 않습니다. 갱신된 서버가 적용되었는지 확인해 주세요.');
  }
  return evaluation;
}

export async function checkPermit(id) {
  const permitId = jobId(id);
  return jobWrite(async () => {
    const result = await api(`/api/v1/permits/${permitId}/check`, { method: 'POST' });
    if (result?.permitId !== permitId) {
      throw new Error('허가서 판정 응답 형식이 올바르지 않습니다.');
    }
    requireRuleEvaluation(result.evaluation);
    return result;
  });
}
export async function submitPermit(id, siteId) {
  const path = `/api/v1/permits/${jobId(id)}/submit`;
  return jobWrite(async () => requirePermit(await api(path, { method: 'POST' }), siteId));
}
