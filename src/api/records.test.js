import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createDailySafetyLogDraft, getDailySafetyLog, getDailySafetyLogs,
  submitDailySafetyLog, updateDailySafetyLog,
} from './records.js';

test('daily safety log APIs use the agreed paths and lock versions', async (t) => {
  const storage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => null } });
  t.after(() => {
    if (storage) Object.defineProperty(globalThis, 'localStorage', storage);
    else delete globalThis.localStorage;
  });
  const requests = [];
  t.mock.method(globalThis, 'fetch', async (path, options) => {
    requests.push({ path, method: options.method, body: options.body ? JSON.parse(options.body) : undefined });
    return new Response(JSON.stringify({ success: true, data: { dailyLogId: 101, lockVersion: 2 } }), {
      headers: { 'Content-Type': 'application/json' },
    });
  });
  await getDailySafetyLogs(1, { from: '2026-11-03', to: '2026-11-03' });
  assert.deepEqual(requests.at(-1), {
    path: '/api/v1/sites/1/daily-safety-logs?from=2026-11-03&to=2026-11-03', method: 'GET', body: undefined,
  });
  await createDailySafetyLogDraft(1, { date: '2026-11-03' });
  assert.deepEqual(requests.at(-1), {
    path: '/api/v1/sites/1/daily-safety-logs/draft', method: 'POST', body: { date: '2026-11-03' },
  });
  await getDailySafetyLog(101);
  assert.equal(requests.at(-1).path, '/api/v1/daily-safety-logs/101');
  await updateDailySafetyLog(101, { lockVersion: 2, summary: '수정한 요약' });
  assert.deepEqual(requests.at(-1), {
    path: '/api/v1/daily-safety-logs/101', method: 'PUT', body: { lockVersion: 2, summary: '수정한 요약' },
  });
  await submitDailySafetyLog(101, 3);
  assert.deepEqual(requests.at(-1), {
    path: '/api/v1/daily-safety-logs/101/submit', method: 'POST', body: { lockVersion: 3 },
  });
  assert.throws(() => updateDailySafetyLog(101, { lockVersion: 2, summary: ' ' }), /요약/);
  assert.throws(() => submitDailySafetyLog(101), /버전/);
});

test('document preview uses /previews and validates type and id', async (t) => {
  const { getDocumentPreview } = await import('./records.js');
  const storage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => null } });
  t.after(() => {
    if (storage) Object.defineProperty(globalThis, 'localStorage', storage);
    else delete globalThis.localStorage;
  });
  const preview = { targetType: 'TBM', targetId: 14, status: 'DRAFT', official: false, markText: '작성 중 · 정식 문서 아님', content: { tbmId: 14 } };
  let data = preview;
  let requested;
  t.mock.method(globalThis, 'fetch', async (path) => {
    requested = path;
    return new Response(JSON.stringify({ success: true, data }), { headers: { 'Content-Type': 'application/json' } });
  });
  assert.deepEqual(await getDocumentPreview('tbm', '14'), preview);
  assert.equal(requested, '/api/v1/previews/TBM/14');
  await assert.rejects(getDocumentPreview('WORK', 1), /문서 종류/);
  await assert.rejects(getDocumentPreview('TBM', 'x'), /문서 종류/);
  data = { ...preview, targetId: 15 };
  await assert.rejects(getDocumentPreview('TBM', 14), /형식/);
});
