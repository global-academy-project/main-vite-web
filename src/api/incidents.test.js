import test from 'node:test';
import assert from 'node:assert/strict';
import {
  acknowledgeWarning, getIncidents, getTagCodes, getWorkWarnings, searchIncidents,
} from './incidents.js';

test('incident and warning APIs match the Spring endpoint contracts', async (t) => {
  const storage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true, value: { getItem: () => null },
  });
  t.after(() => {
    if (storage) Object.defineProperty(globalThis, 'localStorage', storage);
    else delete globalThis.localStorage;
  });

  const requests = [];
  let data = [];
  t.mock.method(globalThis, 'fetch', async (path, options) => {
    requests.push({
      path,
      method: options.method,
      body: options.body ? JSON.parse(options.body) : undefined,
    });
    return new Response(JSON.stringify({ success: true, data }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  });

  await getTagCodes();
  assert.equal(requests.at(-1).path, '/api/v1/tag-codes');

  data = [{ nearMissId: 7, tags: [] }];
  assert.deepEqual(await getIncidents('2'), data);
  assert.equal(requests.at(-1).path, '/api/v1/sites/2/near-misses');

  await searchIncidents({ siteId: 2, limit: 5 });
  assert.equal(requests.at(-1).path, '/api/v1/incident-search');
  assert.equal(requests.at(-1).method, 'POST');

  data = [{
    warningId: 11, workId: 42, sourceType: 'NEAR_MISS', nearMissId: 7,
    severity: 'CRITICAL', message: '같은 구역 아차사고', acknowledgedAt: null,
  }];
  assert.deepEqual(await getWorkWarnings(42), data);
  assert.equal(requests.at(-1).path, '/api/v1/works/42/warnings');

  data = { warningId: 11 };
  await acknowledgeWarning(11);
  assert.deepEqual(requests.at(-1), {
    path: '/api/v1/warnings/11/acknowledge', method: 'POST', body: undefined,
  });
  await acknowledgeWarning(11, '안전대 2중 체결');
  assert.deepEqual(requests.at(-1), {
    path: '/api/v1/warnings/11/acknowledge', method: 'POST', body: { note: '안전대 2중 체결' },
  });
});

test('incident API rejects malformed list responses before the UI consumes them', async (t) => {
  const storage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true, value: { getItem: () => null },
  });
  t.after(() => {
    if (storage) Object.defineProperty(globalThis, 'localStorage', storage);
    else delete globalThis.localStorage;
  });
  t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({
    success: true, data: { results: [] },
  }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

  await assert.rejects(getIncidents(2), /목록 응답 형식/);
  await assert.rejects(searchIncidents({ siteId: 2 }), /목록 응답 형식/);
});
test('auto-tag run status: NEAR_MISS_TAG run without conversation, DONE needs the same report and saved count', async (t) => {
  const storage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => null } });
  t.after(() => {
    if (storage) Object.defineProperty(globalThis, 'localStorage', storage);
    else delete globalThis.localStorage;
  });
  let data;
  let path;
  t.mock.method(globalThis, 'fetch', async (requestPath) => {
    path = requestPath;
    return new Response(JSON.stringify({ success: true, data }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  });
  const { getAutoTagRun } = await import('./incidents.js');

  data = { runId: 51, conversationId: null, taskType: 'NEAR_MISS_TAG', status: 'PROCESSING', result: null };
  assert.equal((await getAutoTagRun(51, 9)).status, 'PROCESSING');
  assert.equal(path, '/api/v1/agent/runs/51');

  data = { ...data, status: 'DONE', result: { nearMissId: 9, savedCount: 2, skipped: [], taggingSource: 'near_miss_rules', model: null } };
  assert.equal((await getAutoTagRun(51, 9)).result.savedCount, 2);
  await assert.rejects(getAutoTagRun(51, 10), /형식/);   // 다른 보고의 결과

  data = { ...data, status: 'FAILED', result: null, errorMessage: 'AGENT_TIMEOUT' };
  assert.equal((await getAutoTagRun(51, 9)).errorMessage, 'AGENT_TIMEOUT');

  data = { ...data, taskType: 'WORK_REGISTER' };
  await assert.rejects(getAutoTagRun(51, 9), /형식/);
});
