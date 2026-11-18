import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createCorrectiveAction, getCorrectiveAssignees, listCorrectiveActions, stepCorrectiveAction, updateCorrectiveAction,
} from './corrective-actions.js';

const action = {
  actionId: 7, siteId: 1, sourceType: 'NEAR_MISS', sourceId: 9, title: '발판 고정', status: 'OPEN',
  dueDate: '2026-11-20', lockVersion: 0, assigneeId: 3,
};

test('개선조치 API 경로·본문·응답 검사', async (t) => {
  const requests = [];
  let responseData = [action];
  t.mock.method(globalThis, 'fetch', async (path, options) => {
    requests.push({ path, method: options.method, body: options.body ? JSON.parse(options.body) : undefined });
    return new Response(JSON.stringify({ success: true, data: responseData }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  });
  const storage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => 'test-only-token' } });
  t.after(() => {
    if (storage) Object.defineProperty(globalThis, 'localStorage', storage);
    else delete globalThis.localStorage;
  });

  await listCorrectiveActions(1, { statuses: ['OPEN', 'IN_PROGRESS'], sourceType: 'NEAR_MISS', sourceId: 9 });
  assert.equal(requests.at(-1).path, '/api/v1/sites/1/corrective-actions?status=OPEN&status=IN_PROGRESS&sourceType=NEAR_MISS&sourceId=9');

  responseData = [{ userId: 3, name: '작성자', role: 'WRITER' }];
  assert.equal((await getCorrectiveAssignees(1))[0].userId, 3);

  responseData = action;
  const body = { sourceType: 'NEAR_MISS', sourceId: 9, title: '발판 고정', description: null, assigneeId: 3, dueDate: '2026-11-20', lockVersion: null };
  await createCorrectiveAction(1, body);
  assert.deepEqual(requests.at(-1), { path: '/api/v1/sites/1/corrective-actions', method: 'POST', body });
  await updateCorrectiveAction(7, { ...body, lockVersion: 0 }, 1);
  assert.equal(requests.at(-1).path, '/api/v1/corrective-actions/7');
  assert.equal(requests.at(-1).method, 'PUT');
  await stepCorrectiveAction(7, 'complete', { lockVersion: 1, note: '교체함' }, 1);
  assert.deepEqual(requests.at(-1), { path: '/api/v1/corrective-actions/7/complete', method: 'POST', body: { lockVersion: 1, note: '교체함' } });
  await assert.rejects(stepCorrectiveAction(7, 'delete', {}, 1), /단계/);

  responseData = { ...action, siteId: 2 };
  await assert.rejects(updateCorrectiveAction(7, body, 1), /현장/);
  responseData = { ...action, status: 'UNKNOWN' };
  await assert.rejects(createCorrectiveAction(1, body), /형식/);
});
