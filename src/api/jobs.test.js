import test from 'node:test';
import assert from 'node:assert/strict';
import {
  checkPermit, createPermit, createWork, getPermit, getWork, jobId, measurementItems,
  requireWork, saveMeasurements, submitPermit, updatePermit, validatePeriod,
} from './jobs.js';

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
  await updatePermit(11, { ...content, lockVersion: 0 }, 1);
  assert.equal(requests.at(-1).method, 'PUT');
  assert.deepEqual(requests.at(-1).body, { ...content, lockVersion: 0 });

  const items = measurementItems('HOT', { LEL: '0' });
  await saveMeasurements(11, items, 1);
  assert.equal(requests.at(-1).path, '/api/v1/permits/11/measurements');
  assert.deepEqual(requests.at(-1).body, { items: [{ item: 'LEL', value: 0 }] });

  const blocked = {
    permitId: 11, status: 'BLOCKED', canSubmit: false,
    evaluation: { evaluationId: 8, result: 'BLOCK', rulesApplied: 5, violations: [], unusedFields: [] },
  };
  respond(blocked);
  assert.deepEqual(await checkPermit(11), blocked);
  assert.equal(requests.at(-1).path, '/api/v1/permits/11/check');
  assert.equal(requests.at(-1).body, undefined);
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
