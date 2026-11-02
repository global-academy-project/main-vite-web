import test from 'node:test';
import assert from 'node:assert/strict';
import { getAgentMessages, getAgentRun, startRecordQuery, startWorkRegister } from './agents.js';
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

test('record questions use separate conversations and validate site, task, answers and unknown writes', async (t) => {
  const storage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => null } });
  t.after(() => {
    if (storage) Object.defineProperty(globalThis, 'localStorage', storage);
    else delete globalThis.localStorage;
  });
  let data = { runId: 9, conversationId: 8, status: 'PROCESSING' };
  let status = 202;
  let networkFailure = false;
  const requests = [];
  t.mock.method(globalThis, 'fetch', async (path, options) => {
    requests.push({ path, method: options.method, body: options.body ? JSON.parse(options.body) : undefined });
    if (networkFailure) throw new TypeError('connection lost');
    return new Response(JSON.stringify(status < 400 ? { success: true, data }
      : { success: false, error: { code: 'INVALID_STATE', message: '다른 종류의 대화' } }),
    { status, headers: { 'Content-Type': 'application/json' } });
  });
  await startRecordQuery({ siteId: '2', message: ' 지난달 누락된 허가서 ', permitId: 99 });
  assert.deepEqual(requests.at(-1), {
    path: '/api/v1/agent/record-query', method: 'POST', body: { siteId: 2, message: '지난달 누락된 허가서' },
  });
  await startRecordQuery({ siteId: 2, message: '화기 작업만', conversationId: 8 });
  assert.deepEqual(requests.at(-1).body, { siteId: 2, message: '화기 작업만', conversationId: 8 });
  const before = requests.length;
  await assert.rejects(startRecordQuery({ siteId: 2, message: ' ' }), /메시지/);
  await assert.rejects(startRecordQuery({ siteId: 2, message: 'x'.repeat(2001) }), /메시지/);
  await assert.rejects(startRecordQuery({ siteId: 0, message: '질문' }), /ID/);
  await assert.rejects(startRecordQuery({ siteId: 2, message: '질문', conversationId: '../8' }), /ID/);
  assert.equal(requests.length, before);
  status = 200;
  const options = { siteId: 2, conversationId: 8, taskType: 'RECORD_QUERY' };
  for (const state of ['PROCESSING', 'WAITING_INPUT', 'DONE', 'FAILED']) {
    data = {
      runId: 9, conversationId: 8, siteId: 2, taskType: 'RECORD_QUERY', status: state, steps: [], citations: [],
      ...(['DONE', 'WAITING_INPUT'].includes(state) ? { result: {
        runStatus: state, answer: state === 'DONE' ? '서버 답변' : null,
        ask: state === 'WAITING_INPUT' ? { message: '조회 기간은?' } : null,
        queries: [{ queryType: 'missing_measurements', conditions: { permitType: 'HOT' }, total: 3, truncated: true }],
      } } : {}),
    };
    assert.equal((await getAgentRun(9, options)).status, state);
  }
  await assert.rejects(getAgentRun(9, { ...options, siteId: 1 }), /응답/);
  await assert.rejects(getAgentRun(9), /응답/);
  data = { ...data, status: 'DONE', result: { runStatus: 'DONE', answer: ' ' } };
  await assert.rejects(getAgentRun(9, options), /답변/);
  data.result = { runStatus: 'DONE', answer: '답변', queries: {} };
  await assert.rejects(getAgentRun(9, options), /답변/);
  data.result.queries = [null];
  await assert.rejects(getAgentRun(9, options), /답변/);
  status = 409;
  await assert.rejects(startRecordQuery({ siteId: 2, message: '질문', conversationId: 8 }),
    (error) => error.code === 'INVALID_STATE');
  networkFailure = true;
  await assert.rejects(startRecordQuery({ siteId: 2, message: '질문' }),
    (error) => error.code === 'WRITE_OUTCOME_UNKNOWN');
});

test('work registration exposes validated saved draft IDs and rejects inconsistent links', async (t) => {
  const storage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => null } });
  t.after(() => {
    if (storage) Object.defineProperty(globalThis, 'localStorage', storage);
    else delete globalThis.localStorage;
  });
  const saved = {
    workId: 31, riskAssessmentId: 32, tbmId: 33,
    permits: [{ permitId: 34, permitType: 'HOT', permitNo: 'HOT-34', created: true }],
    workDateAssumed: true, notes: ['점검표 저장 미지원'],
  };
  let data = {
    runId: 9, conversationId: 8, siteId: 2, workId: 31, taskType: 'WORK_REGISTER', status: 'DONE',
    result: { runStatus: 'DONE', saved }, steps: [], citations: [],
  };
  t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({ success: true, data }), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  }));
  assert.deepEqual((await getAgentRun(9, { siteId: 2 })).result.saved, saved);
  for (const invalid of [
    { workId: 99 }, { riskAssessmentId: -1 }, { tbmId: '33' },
    { permits: [{ permitId: 0 }] }, { permits: null }, { notes: null },
  ]) {
    data = { ...data, result: { runStatus: 'DONE', saved: { ...saved, ...invalid } } };
    await assert.rejects(getAgentRun(9, { siteId: 2 }), /저장 응답/);
  }
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
