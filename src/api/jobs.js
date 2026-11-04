import { api, ApiError } from './client.js';

export async function reloadJobConflict(error, load) {
  if (error.code !== 'CONFLICT_MODIFIED') return null;
  try {
    return await load();
  } catch (reloadError) {
    throw new Error(`${error.message} 최신 기록 재조회도 실패했습니다: ${reloadError.message}`, { cause: reloadError });
  }
}

export async function jobWrite(request) {
  try {
    return await request();
  } catch (error) {
    if (error.code === 'NETWORK_ERROR' || error.code === 'TIMEOUT' || error.code === 'INVALID_RESPONSE'
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

// 허가 유형별 양식 확인 항목 (서버 규칙 R__rules_seed.sql 의 form.* 대상과 같은 키)
// checks: 예/아니오 항목 (true = 조치 확인, false = 미조치, 키 없음 = 미확인)
// choices: 여러 방법 중 하나를 고르는 항목 (값 = 서버 허용값)
export const permitFormFields = {
  HOT: {
    watcherLabel: '화재감시자',
    checks: [
      { code: 'extinguisher_ready', label: '소화기 비치' },
      { code: 'spark_prevention', label: '불티 비산 방지' },
      { code: 'flammable_vapor_removed', label: '인화성 증기 제거' },
    ],
    choices: [],
  },
  CONFINED: {
    watcherLabel: '감시인 (밀폐공간 외부 배치)',
    checks: [
      { code: 'ventilation_done', label: '작업 전 환기 (적정공기 유지)' },
      { code: 'rescue_equipment_ready', label: '대피·구출 기구 비치 (공기호흡기 또는 송기마스크, 사다리, 섬유로프)' },
    ],
    choices: [],
  },
  HEIGHT: {
    watcherLabel: '감시자',
    checks: [
      { code: 'helmet_worn', label: '안전모 착용' },
      { code: 'harness_worn', label: '안전대 착용 (안전대 걸이 설비 확인)' },
    ],
    choices: [
      {
        code: 'fall_protection', label: '추락 방지 조치',
        help: '작업발판을 먼저 설치하고, 곤란하면 추락방호망, 그것도 곤란하면 안전대 착용 순서로 고릅니다.',
        options: [
          { value: 'WORK_PLATFORM', label: '작업발판 설치' },
          { value: 'SAFETY_NET', label: '추락방호망 설치' },
          { value: 'SAFETY_HARNESS', label: '안전대 착용' },
        ],
      },
    ],
  },
};

export function permitFormFieldsOf(type) {
  if (!Object.hasOwn(permitFormFields, type)) throw new Error('허가 유형이 올바르지 않습니다.');
  return permitFormFields[type];
}

export const editablePermitStatuses = ['DRAFT', 'CHECKING', 'BLOCKED'];

export const hasMeasurementItems = (type) => measurementFields[type].length > 0;

// 허가 화면 단계 (1 작성, 2 측정값, 3 규칙 판정, 4 승인 요청): 조회한 허가서가 이어서 할 단계
export function stepForPermit(permit) {
  if (!editablePermitStatuses.includes(permit.status)) return 4;
  if (permit.lastEvaluation) return permit.canSubmit ? 4 : 3;
  if (hasMeasurementItems(permit.permitType) && permit.measurements.length === 0) return 2;
  return 3;
}

// 판정에서 막힌 항목을 고칠 단계 (measurement.* → 2단계, 그 밖의 form.* → 1단계)
export const stepForTarget = (target) => (String(target ?? '').startsWith('measurement.') ? 2 : 1);

// 고르는 항목 값 바꾸기. 빈 값('')이면 키를 빼서 "미선택"(서버 판정 MISSING)으로 둔다
export function setPermitChoice(form, code, value) {
  const next = { ...form };
  if (value === '' || value == null) delete next[code];
  else next[code] = value;
  return next;
}

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
export async function getSiteWorks(siteId, from, to = from) {
  const site = jobId(siteId);
  const params = new URLSearchParams();
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  const records = await api(`/api/v1/sites/${site}/works${params.size ? `?${params}` : ''}`);
  if (!Array.isArray(records)) throw new Error('작업 목록 응답 형식이 올바르지 않습니다.');
  return records.map((work) => {
    requireWork(work, site);
    if (!Array.isArray(work.permits)) throw new Error('작업 목록의 허가서 응답 형식이 올바르지 않습니다.');
    return work;
  });
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
