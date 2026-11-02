import test from 'node:test';
import assert from 'node:assert/strict';
import { completeTbm, createTbm, getTbm, getSiteTbms, getSiteWorkers, saveTbmAttendees, updateTbm, reopenTbm, submitTbm } from './tbm.js';
import { completeTbmBody } from '../utils/job-forms.js';

const tbm = {
  tbmId: 12, siteId: 1, tbmDate: '2026-11-02', status: 'DRAFT', lockVersion: 0,
  attendees: [], works: [],
  teamId: null, zoneId: null, approvalId: null, approvalStatus: null,
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
  const createBody = {
    tbmDate: '2026-11-02', leaderName: '진행자', workIds: [31], attendees: [],
    points: ['작업 전 가스 측정'], healthCheck: '건강 상태 확인',
  };
  await createTbm(1, createBody);
  assert.deepEqual(requests.at(-1), {
    path: '/api/v1/sites/1/tbm', method: 'POST', body: createBody,
  });
  responseData = { ...tbm, lockVersion: 1, attendees: [{ workerId: 5, healthOk: true }] };
  const attendeeBody = { lockVersion: 0, attendees: [{ workerId: 5, healthOk: true }] };
  const saved = await saveTbmAttendees(12, attendeeBody, 1);
  assert.deepEqual(requests.at(-1), {
    path: '/api/v1/tbm/12/attendees', method: 'PUT', body: attendeeBody,
  });
  const completeBody = completeTbmBody(saved, '2026-11-02T10:00:00', '10');
  assert.equal(completeBody.lockVersion, 1);
  responseData = { ...saved, status: 'DONE', lockVersion: 2, attendeeCount: 10 };
  await completeTbm(12, completeBody, 1);
  assert.deepEqual(requests.at(-1), {
    path: '/api/v1/tbm/12/complete', method: 'POST', body: completeBody,
  });
  responseData = [{ ...tbm, status: 'DONE', approvalId: 99, approvalStatus: 'PENDING', teamId: 4, zoneId: 7 }];
  assert.equal((await getSiteTbms(1))[0].approvalStatus, 'PENDING');

  const before = requests.length;
  await assert.rejects(saveTbmAttendees('../12', {}, 1), (error) => !error.code && /ID/.test(error.message));
  await assert.rejects(completeTbm(0, {}, 1), (error) => !error.code && /ID/.test(error.message));
  await assert.rejects(createTbm(0, {}), /ID/);
  assert.equal(requests.length, before);

  responseData = { ...tbm, lockVersion: 3, teamId: 4, zoneId: 7 };
  const editBody = { ...createBody, teamId: 4, zoneId: 7, lockVersion: 2, attendees: [{ workerId: 5, healthOk: true }] };
  const updated = await updateTbm(12, editBody, 1);
  assert.deepEqual(requests.at(-1), { path: '/api/v1/tbm/12', method: 'PUT', body: editBody });
  assert.equal(updated.teamId, 4);
  assert.equal(updated.zoneId, 7);
  responseData = { ...updated, lockVersion: 4 };
  await saveTbmAttendees(12, { lockVersion: updated.lockVersion, attendees: updated.attendees }, 1);
  assert.equal(requests.at(-1).body.lockVersion, 3);
  await reopenTbm(12, 1);
  assert.deepEqual(requests.at(-1), { path: '/api/v1/tbm/12/reopen', method: 'POST', body: undefined });
  responseData = { ...tbm, status: 'DONE' };
  await submitTbm(12, 1);
  assert.deepEqual(requests.at(-1), { path: '/api/v1/tbm/12/submit', method: 'POST', body: undefined });
  const invalidBefore = requests.length;
  await assert.rejects(updateTbm('../12', {}, 1), /ID/);
  await assert.rejects(reopenTbm(0, 1), /ID/);
  await assert.rejects(submitTbm(-1, 1), /ID/);
  assert.equal(requests.length, invalidBefore);

  responseData = [{ ...tbm, siteId: 2 }];
  await assert.rejects(getSiteTbms(1, '2026-11-02'), /현장/);
  responseData = { ...tbm };
  delete responseData.teamId;
  await assert.rejects(getTbm(12, 1), /최신 서버/);
});
