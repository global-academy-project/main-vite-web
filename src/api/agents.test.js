import test from 'node:test';
import assert from 'node:assert/strict';
import { getAgentMessages, getAgentRun, startWorkRegister } from './agents.js';
import { autoTagIncident } from './incidents.js';

test('agent API contracts validate IDs, continuation, states, history and errors', async (t) => {
  const requests = [];
  let data;
  let status = 200;
  const storage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true, value: { getItem: () => null },
  });
  t.after(() => {
    if (storage) Object.defineProperty(globalThis, 'localStorage', storage);
    else delete globalThis.localStorage;
  });
  t.mock.method(globalThis, 'fetch', async (path, options) => {
    requests.push({ path, method: options.method, body: options.body ? JSON.parse(options.body) : undefined });
    return new Response(JSON.stringify(status === 200 || status === 202
      ? { success: true, data } : { success: false, error: { code: 'INVALID_STATE', message: '처리 중' } }),
    { status, headers: { 'Content-Type': 'application/json' } });
  });
  data = { runId: 3, conversationId: 2, status: 'PROCESSING' };
  status = 202;
  await startWorkRegister({ siteId: 1, message: ' 용접 ' });
  assert.deepEqual(requests.at(-1), {
    path: '/api/v1/agent/work-register', method: 'POST', body: { siteId: 1, message: '용접' },
  });
  await startWorkRegister({ siteId: 1, message: '장소', conversationId: 2, permitId: 11 });
  assert.deepEqual(requests.at(-1).body, { siteId: 1, message: '장소', conversationId: 2, permitId: 11 });
  const before = requests.length;
  for (const message of ['', ' ', 'x'.repeat(2001), null]) {
    await assert.rejects(startWorkRegister({ siteId: 1, message }), /메시지/);
  }
  await assert.rejects(startWorkRegister({ siteId: 0, message: '작업' }), /ID/);
  await assert.rejects(getAgentRun('../1'), /ID/);
  assert.equal(requests.length, before);
  await assert.rejects(startWorkRegister({ siteId: 1, message: '작업', conversationId: 9 }), /응답/);

  status = 200;
  for (const state of ['PROCESSING', 'WAITING_INPUT', 'DONE', 'FAILED']) {
    data = {
      runId: 3, conversationId: 2, taskType: 'WORK_REGISTER', status: state, steps: [], citations: [],
      ...(['DONE', 'WAITING_INPUT'].includes(state) ? { result: { runStatus: state } } : {}),
    };
    assert.equal((await getAgentRun(3, { conversationId: 2 })).status, state);
    assert.equal(requests.at(-1).path, '/api/v1/agent/runs/3');
  }
  await assert.rejects(getAgentRun(3, { conversationId: 9 }), /응답/);
  data = { ...data, status: 'DONE', result: { runStatus: 'WAITING_INPUT' } };
  await assert.rejects(getAgentRun(3), /응답/);
  data = { ...data, result: { runStatus: 'DONE' }, taskType: 'NEAR_MISS_TAG' };
  await assert.rejects(getAgentRun(3), /응답/);
  data = [{ messageId: 1, role: 'USER', content: '작업' }, { messageId: 2, role: 'ASSISTANT', content: '추가 질문' }];
  assert.equal((await getAgentMessages(2)).length, 2);
  assert.equal(requests.at(-1).path, '/api/v1/agent/conversations/2/messages');
  data = [{ messageId: 1, role: 'TOOL', content: '내부 기록' }];
  await assert.rejects(getAgentMessages(2), /응답/);
  status = 409;
  await assert.rejects(startWorkRegister({ siteId: 1, message: '작업' }),
    (error) => error.code === 'INVALID_STATE' && error.status === 409);
});

test('planned auto-tag contract accepts an asynchronous run ID, not a synchronous report', async (t) => {
  let data = { runId: 51 };
  let request;
  const storage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true, value: { getItem: () => null },
  });
  t.after(() => {
    if (storage) Object.defineProperty(globalThis, 'localStorage', storage);
    else delete globalThis.localStorage;
  });
  t.mock.method(globalThis, 'fetch', async (path, options) => {
    request = { path, method: options.method, body: JSON.parse(options.body) };
    return new Response(JSON.stringify({ success: true, data }), {
      status: 202, headers: { 'Content-Type': 'application/json' },
    });
  });
  assert.deepEqual(await autoTagIncident(9, 0), { runId: 51 });
  assert.deepEqual(request, { path: '/api/v1/near-misses/9/auto-tags', method: 'POST', body: { lockVersion: 0 } });
  data = { nearMissId: 9, tags: [] };
  await assert.rejects(autoTagIncident(9, 0), /응답/);
  await assert.rejects(autoTagIncident(9, -1), /버전/);
});
