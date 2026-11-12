import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyPermitExtraction, checkPermit, createPermit, createWork, getPermit, getWork, getSiteWorks, jobId, jobWrite, measurementItems,
  requireRuleEvaluation, requireWork, saveMeasurements, submitPermit, updatePermit, validatePeriod,
} from './jobs.js';
import { ApiError } from './client.js';

const work = {
  workId: 7, siteId: 1, title: '작업', workDate: '2026-10-29', workType: 'HOT',
  status: 'DRAFT', highRisk: true, writerId: 3,
};
const permit = {
  permitId: 11, siteId: 1, workId: 7, permitType: 'HOT', status: 'DRAFT',
  lockVersion: 0, form: {}, measurements: [], lastEvaluation: null, canSubmit: false,
};

test('IDs and periods reject invalid or unsafe input', () => {
  for (const id of ['', null, 0, -1, '1.2', '1e2', '9007199254740992', '../1']) {
    assert.throws(() => jobId(id));
  }
  assert.equal(jobId(' 7 '), 7);
  assert.throws(() => validatePeriod('', '2026-10-29T11:00'));
  assert.throws(() => validatePeriod('2026-10-29T11:00', '2026-10-29T11:00'));
  assert.throws(() => validatePeriod('2026-10-29T12:00', '2026-10-29T11:00'));
  assert.doesNotThrow(() => validatePeriod('2026-10-29T10:00', '2026-10-29T11:00'));
});

test('measurements preserve zero, omit blank values, include confined LEL, and enforce bounds', () => {
  assert.deepEqual(measurementItems('CONFINED', {
    O2: '20.9', CO2: '', CO: '0', H2S: ' ', LEL: '0', NH3: '125',
  }), [
    { item: 'O2', value: 20.9 }, { item: 'CO', value: 0 },
    { item: 'LEL', value: 0 }, { item: 'NH3', value: 125 },
  ]);
  assert.deepEqual(measurementItems('HOT', { LEL: '100' }), [{ item: 'LEL', value: 100 }]);
  for (const value of ['-1', 'Infinity', 'NaN', '100.1']) {
    assert.throws(() => measurementItems('HOT', { LEL: value }));
  }
  assert.throws(() => measurementItems('HOT', { LEL: '' }));
  assert.throws(() => measurementItems('HEIGHT', {}));
  assert.throws(() => measurementItems('GENERAL', {}));
});

test('work response is checked against the selected site', () => {
  assert.equal(requireWork(work, 1), work);
  assert.throws(() => requireWork(work, 2), /현장/);
  assert.throws(() => requireWork({ siteId: 1 }, 1), /형식/);
});

test('job writes classify uncertain outcomes without retrying or masking definite rejections', async () => {
  for (const original of [
    new ApiError('NETWORK_ERROR', '연결 끊김', null, 0),
    new ApiError('TIMEOUT', '응답 시간 초과', null, 408),
    new ApiError('INVALID_RESPONSE', '잘못된 응답', null, 200),
    new ApiError('INTERNAL_ERROR', '서버 오류', null, 500),
    new ApiError('INTERNAL_ERROR', '게이트웨이 오류', null, 502),
    new Error('응답 필드 누락'),
  ]) {
    let attempts = 0;
    await assert.rejects(jobWrite(async () => { attempts += 1; throw original; }),
      (error) => error.code === 'WRITE_OUTCOME_UNKNOWN' && error.cause === original
        && error.message.includes(original.message));
    assert.equal(attempts, 1);
  }
  for (const [status, code] of [[400, 'INVALID_REQUEST'], [403, 'FORBIDDEN'],
    [409, 'CONFLICT_MODIFIED'], [409, 'INVALID_STATE']]) {
    const original = new ApiError(code, '요청 거절', null, status);
    await assert.rejects(jobWrite(async () => { throw original; }), (error) => error === original);
  }
  assert.equal(await jobWrite(async () => 'saved'), 'saved');
});

test('all persisted job operations classify a lost response and reject invalid IDs before sending', async (t) => {
  const storage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true, value: { getItem: () => null },
  });
  t.after(() => {
    if (storage) Object.defineProperty(globalThis, 'localStorage', storage);
    else delete globalThis.localStorage;
  });
  let requests = 0;
  t.mock.method(globalThis, 'fetch', async () => { requests += 1; throw new TypeError('response lost'); });
  const operations = [
    () => createWork({ siteId: 1 }), () => createPermit({ workId: 7 }, 1),
    () => updatePermit(11, { lockVersion: 0 }, 1),
    () => saveMeasurements(11, [{ item: 'LEL', value: 3 }], 1),
    () => checkPermit(11), () => submitPermit(11, 1),
  ];
  for (const operation of operations) {
    const before = requests;
    await assert.rejects(operation(), (error) => error.code === 'WRITE_OUTCOME_UNKNOWN'
      && error.cause.code === 'NETWORK_ERROR');
    assert.equal(requests, before + 1);
  }
  const before = requests;
  for (const operation of [
    () => updatePermit('../11', {}, 1), () => saveMeasurements(0, [], 1),
    () => checkPermit('invalid'), () => submitPermit(-1, 1),
  ]) await assert.rejects(operation(), (error) => !error.code && /ID/.test(error.message));
  assert.equal(requests, before);
});

test('rule evaluations require all checks and preserve PASS, FAIL, MISSING and zero-rule results', () => {
  const checks = ['PASS', 'FAIL', 'MISSING'].map((status) => ({
    ruleCode: `HOT_${status}`, category: 'REQUIRED_FIELD', target: 'form.extinguisher_ready',
    status, actual: status === 'MISSING' ? null : status === 'PASS' ? 'true' : 'false',
    expected: '확인 필요', severity: 'BLOCK',
  }));
  const evaluation = { result: 'BLOCK', rulesApplied: 3, checks, violations: [], unusedFields: [] };
  assert.equal(requireRuleEvaluation(evaluation), evaluation);
  assert.doesNotThrow(() => requireRuleEvaluation({
    result: 'PASS', rulesApplied: 0, checks: [], violations: [], unusedFields: [],
  }));
  for (const invalid of [
    { ...evaluation, checks: undefined }, { ...evaluation, checks: [] },
    { ...evaluation, checks: [null, ...checks.slice(1)] },
    { ...evaluation, checks: [{ ...checks[0], status: 'UNKNOWN' }, ...checks.slice(1)] },
    { ...evaluation, checks: [{ ...checks[0], actual: false }, ...checks.slice(1)] },
  ]) assert.throws(() => requireRuleEvaluation(invalid), /checks/);
});

test('work and permit API HTTP contracts, state transitions and failures', async (t) => {
  const requests = [];
  let responseBody;
  let status = 200;
  t.mock.method(globalThis, 'fetch', async (path, options) => {
    requests.push({ path, ...options, body: options.body ? JSON.parse(options.body) : undefined });
    return new Response(JSON.stringify(responseBody), { status, headers: { 'Content-Type': 'application/json' } });
  });
  const storage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true, value: { getItem: () => 'test-only-token' },
  });
  t.after(() => {
    if (storage) Object.defineProperty(globalThis, 'localStorage', storage);
    else delete globalThis.localStorage;
  });
  const respond = (data) => { status = 200; responseBody = { success: true, data }; };

  const createBody = {
    siteId: 1, workDate: '2026-10-29', title: '작업', description: null, workType: 'HOT',
    startAt: '2026-10-29T10:00', endAt: '2026-10-29T11:00', workerCount: 2,
  };
  respond(work);
  assert.deepEqual(await createWork(createBody), work);
  assert.equal(requests.at(-1).path, '/api/v1/works');
  assert.equal(requests.at(-1).method, 'POST');
  assert.deepEqual(requests.at(-1).body, createBody);
  assert.equal(requests.at(-1).headers.Authorization, 'Bearer test-only-token');
  await getWork(7);
  assert.equal(requests.at(-1).path, '/api/v1/works/7');
  respond([{ ...work, permits: [], riskAssessment: null, tbm: null }]);
  assert.equal((await getSiteWorks(1, '2026-11-02', '2026-11-06')).length, 1);
  assert.equal(requests.at(-1).path, '/api/v1/sites/1/works?from=2026-11-02&to=2026-11-06');
  await assert.rejects(getSiteWorks(2), /현장/);
  respond({ content: [work] });
  await assert.rejects(getSiteWorks(1), /목록/);
  respond([{ ...work, permits: null }]);
  await assert.rejects(getSiteWorks(1), /허가서/);

  const content = {
    validFrom: '2026-10-29T10:00', validTo: '2026-10-29T11:00',
    watcherName: '감시자', supervisorName: null,
    form: { extinguisher_ready: true, spark_prevention: false, flammable_vapor_removed: true },
  };
  respond(permit);
  await createPermit({ workId: 7, permitType: 'HOT', ...content }, 1);
  assert.equal(requests.at(-1).path, '/api/v1/permits');
  assert.deepEqual(requests.at(-1).body, { workId: 7, permitType: 'HOT', ...content });
  await getPermit(11, 1);
  assert.equal(requests.at(-1).method, 'GET');
  assert.equal(requests.at(-1).path, '/api/v1/permits/11');
  const withoutEvaluation = { ...permit };
  delete withoutEvaluation.lastEvaluation;
  respond(withoutEvaluation);
  assert.deepEqual(await getPermit(11, 1), withoutEvaluation);
  respond({ ...permit, lastEvaluation: { result: 'INVALID', violations: [] } });
  await assert.rejects(getPermit(11, 1), /형식/);
  respond(permit);
  await updatePermit(11, { ...content, lockVersion: 0 }, 1);
  assert.equal(requests.at(-1).method, 'PUT');
  assert.deepEqual(requests.at(-1).body, { ...content, lockVersion: 0 });

  const items = measurementItems('HOT', { LEL: '0' });
  await saveMeasurements(11, items, 1);
  assert.equal(requests.at(-1).path, '/api/v1/permits/11/measurements');
  assert.deepEqual(requests.at(-1).body, { items: [{ item: 'LEL', value: 0 }] });

  const blocked = {
    permitId: 11, status: 'BLOCKED', canSubmit: false,
    evaluation: {
      evaluationId: 8, result: 'BLOCK', rulesApplied: 1, violations: [], unusedFields: [],
      checks: [{
        ruleCode: 'HOT_EXTINGUISHER', category: 'REQUIRED_FIELD', target: 'form.extinguisher_ready',
        status: 'MISSING', expected: '확인 필요', severity: 'BLOCK',
      }],
    },
  };
  respond(blocked);
  assert.deepEqual(await checkPermit(11), blocked);
  assert.equal(requests.at(-1).path, '/api/v1/permits/11/check');
  assert.equal(requests.at(-1).body, undefined);
  respond({ ...blocked, evaluation: { ...blocked.evaluation, checks: undefined } });
  await assert.rejects(checkPermit(11), /checks/);
  respond({ ...permit, status: 'PENDING', lockVersion: 3 });
  assert.equal((await submitPermit(11, 1)).status, 'PENDING');
  assert.equal(requests.at(-1).path, '/api/v1/permits/11/submit');

  for (const state of ['CHECKING', 'SUSPENDED', 'CLOSED', 'SUPERSEDED']) {
    respond({ ...permit, status: state });
    assert.equal((await getPermit(11, 1)).status, state);
  }
  respond({ ...permit, siteId: 2 });
  await assert.rejects(getPermit(11, 1), /현장/);
  respond({ ...permit, measurements: null });
  await assert.rejects(getPermit(11, 1), /형식/);
  respond({ ...blocked, evaluation: { result: 'PASS' } });
  await assert.rejects(checkPermit(11), /형식/);

  status = 409;
  responseBody = { success: false, error: { code: 'CONFLICT_MODIFIED', message: '버전 충돌', details: [] } };
  await assert.rejects(updatePermit(11, { ...content, lockVersion: 0 }, 1),
    (error) => error.code === 'CONFLICT_MODIFIED' && error.status === 409);
  status = 403;
  responseBody = { success: false, error: { code: 'FORBIDDEN', message: '현장 권한 없음' } };
  await assert.rejects(getPermit(11, 1), (error) => error.code === 'FORBIDDEN');
  status = 200;
  responseBody = { permitId: 11 };
  await assert.rejects(getPermit(11, 1), (error) => error.code === 'INVALID_RESPONSE');
});

test('permit form fields match server rule targets per permit type', async () => {
  const { permitFormFields, permitFormFieldsOf } = await import('./jobs.js');
  // R__rules_seed.sql 의 form.* 대상 (watcher_name 은 감시자 칸)
  const serverTargets = {
    HOT: ['extinguisher_ready', 'spark_prevention', 'flammable_vapor_removed'],
    CONFINED: ['ventilation_done', 'rescue_equipment_ready'],
    HEIGHT: ['fall_protection', 'helmet_worn', 'harness_worn'],
  };
  for (const [type, targets] of Object.entries(serverTargets)) {
    const fields = permitFormFields[type];
    assert.deepEqual([...fields.checks, ...fields.choices].map((item) => item.code).sort(), [...targets].sort());
  }
  assert.deepEqual(permitFormFields.HEIGHT.choices[0].options.map((item) => item.value),
    ['WORK_PLATFORM', 'SAFETY_NET', 'SAFETY_HARNESS']);
  assert.throws(() => permitFormFieldsOf('GENERAL'), /허가 유형/);
});

test('permit choice keeps other keys and removes the key when cleared', async () => {
  const { setPermitChoice } = await import('./jobs.js');
  const form = { helmet_worn: true, _source: { text: '원문' } };
  const chosen = setPermitChoice(form, 'fall_protection', 'SAFETY_NET');
  assert.deepEqual(chosen, { helmet_worn: true, _source: { text: '원문' }, fall_protection: 'SAFETY_NET' });
  assert.equal(form.fall_protection, undefined);
  assert.deepEqual(setPermitChoice(chosen, 'fall_protection', ''), form);
});

test('permit step follows saved state and blocked targets point to the step to fix', async () => {
  const { stepForPermit, stepForTarget } = await import('./jobs.js');
  const base = { status: 'DRAFT', permitType: 'CONFINED', measurements: [], lastEvaluation: null, canSubmit: false };
  assert.equal(stepForPermit(base), 2);
  assert.equal(stepForPermit({ ...base, permitType: 'HEIGHT' }), 3);
  assert.equal(stepForPermit({ ...base, measurements: [{ id: 1 }] }), 3);
  assert.equal(stepForPermit({ ...base, measurements: [{ id: 1 }], lastEvaluation: { result: 'BLOCK' } }), 3);
  assert.equal(stepForPermit({ ...base, status: 'BLOCKED', measurements: [{ id: 1 }], lastEvaluation: { result: 'BLOCK' } }), 3);
  assert.equal(stepForPermit({ ...base, measurements: [{ id: 1 }], lastEvaluation: { result: 'PASS' }, canSubmit: true }), 4);
  assert.equal(stepForPermit({ ...base, status: 'PENDING' }), 4);
  assert.equal(stepForTarget('measurement.O2'), 2);
  assert.equal(stepForTarget('form.ventilation_done'), 1);
  assert.equal(stepForTarget(undefined), 1);
});

test('문장 추출 반영: 나눠 보낸 문장이 있으면 texts 를 함께 보내고, 없으면 이전 요청 모양 그대로', async (t) => {
  const bodies = [];
  t.mock.method(globalThis, 'fetch', async (path, options) => {
    bodies.push(JSON.parse(options.body));
    return new Response(JSON.stringify({ success: true, data: permit }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  });
  const storage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => 'test-only-token' } });
  t.after(() => {
    if (storage) Object.defineProperty(globalThis, 'localStorage', storage);
    else delete globalThis.localStorage;
  });
  const measurements = [{ item: 'LEL', value: 0 }];

  await applyPermitExtraction(11, { lockVersion: 0, text: '가연성가스 0', measurements }, 1);
  assert.deepEqual(bodies.at(-1), { lockVersion: 0, text: '가연성가스 0', measurements, form: {} });

  await applyPermitExtraction(11, { lockVersion: 0, text: 'a\nb', texts: ['a', 'b'], measurements }, 1);
  assert.deepEqual(bodies.at(-1), { lockVersion: 0, text: 'a\nb', texts: ['a', 'b'], measurements, form: {} });
});
