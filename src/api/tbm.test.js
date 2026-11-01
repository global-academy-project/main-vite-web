import test from 'node:test';
import assert from 'node:assert/strict';
import { completeTbm, getSiteTbms, getSiteWorkers, saveTbmAttendees } from './tbm.js';

const tbm = {
  tbmId: 12, siteId: 1, tbmDate: '2026-11-02', status: 'DRAFT', lockVersion: 0,
  attendees: [], works: [],
};

test('TBM and worker API requests use expected paths, bodies, and site validation', async (t) => {
  const requests = [];
  let responseData = [tbm];
  t.mock.method(globalThis, 'fetch', async (path, options) => {
    requests.push({
      path, method: options.method,
      body: options.body ? JSON.parse(options.body) : undefined,
    });
    return new Response(JSON.stringify({ success: true, data: responseData }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  });
  const storage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true, value: { getItem: () => 'test-only-token' },
  });
  t.after(() => {
    if (storage) Object.defineProperty(globalThis, 'localStorage', storage);
    else delete globalThis.localStorage;
  });

  assert.deepEqual(await getSiteTbms(1, '2026-11-02'), [tbm]);
  assert.equal(requests.at(-1).path, '/api/v1/sites/1/tbm?date=2026-11-02');
  responseData = [{ workerId: 5, name: '박작업' }];
  assert.deepEqual(await getSiteWorkers(1), responseData);
  assert.equal(requests.at(-1).path, '/api/v1/sites/1/workers');

  responseData = tbm;
  const attendeeBody = { lockVersion: 0, attendees: [{ workerId: 5, healthOk: true }] };
  await saveTbmAttendees(12, attendeeBody, 1);
  assert.deepEqual(requests.at(-1), {
    path: '/api/v1/tbm/12/attendees', method: 'PUT', body: attendeeBody,
  });
  const completeBody = { lockVersion: 1, heldAt: '2026-11-02T10:00:00', attendeeCount: 1 };
  await completeTbm(12, completeBody, 1);
  assert.deepEqual(requests.at(-1), {
    path: '/api/v1/tbm/12/complete', method: 'POST', body: completeBody,
  });

  responseData = [{ ...tbm, siteId: 2 }];
  await assert.rejects(getSiteTbms(1, '2026-11-02'), /현장/);
});
