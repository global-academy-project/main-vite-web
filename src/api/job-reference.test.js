import test from 'node:test';
import assert from 'node:assert/strict';
import {
  changeWorkerAssignment, getJobZones, getTeams, referencePermissions, saveTeam, saveWorker, saveZone,
} from './job-reference.js';

test('reference editing permissions distinguish company and site administrators', () => {
  assert.deepEqual(referencePermissions({ role: 'ADMIN' }, { role: 'WRITER' }), { manageSite: true, manageTeams: true });
  assert.deepEqual(referencePermissions({ role: 'MEMBER' }, { role: 'SITE_ADMIN' }), { manageSite: true, manageTeams: false });
  for (const role of ['WRITER', 'APPROVER', undefined]) {
    assert.deepEqual(referencePermissions({ role: 'MEMBER' }, { role }), { manageSite: false, manageTeams: false });
  }
  assert.deepEqual(referencePermissions(null, null), { manageSite: false, manageTeams: false });
});

test('reference API routes implement create/update, inactive lists and assignment dates', async (t) => {
  const storage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => null } });
  t.after(() => {
    if (storage) Object.defineProperty(globalThis, 'localStorage', storage);
    else delete globalThis.localStorage;
  });
  const team = { teamId: 4, name: '정비팀', teamType: 'INTERNAL', businessNo: null, active: true };
  const zone = { zoneId: 7, siteId: 1, code: 'R-201', name: '반응기', zoneType: 'PROCESS', confined: true, hazardNote: null, active: true };
  const worker = { workerId: 5, name: '작업자', lockVersion: 3 };
  let data = [team];
  let status = 200;
  const requests = [];
  t.mock.method(globalThis, 'fetch', async (path, options) => {
    requests.push({ path, method: options.method, body: options.body ? JSON.parse(options.body) : undefined });
    return new Response(JSON.stringify(status < 400 ? { success: true, data }
      : { success: false, error: { code: 'CONFLICT_MODIFIED', message: '최신 버전 필요' } }),
    { status, headers: { 'Content-Type': 'application/json' } });
  });
  assert.deepEqual(await getTeams(true), [team]);
  assert.equal(requests.at(-1).path, '/api/v1/teams?includeInactive=true');
  data = [zone];
  assert.deepEqual(await getJobZones(1), [zone]);
  assert.equal(requests.at(-1).path, '/api/v1/sites/1/zones?includeInactive=false');
  await assert.rejects(getJobZones(2), /현장/);
  data = team;
  const teamBody = { name: '외부팀', teamType: 'EXTERNAL', businessNo: '1234567890', active: false };
  await saveTeam(null, teamBody);
  assert.deepEqual(requests.at(-1), { path: '/api/v1/admin/teams', method: 'POST', body: teamBody });
  await saveTeam(4, teamBody);
  assert.deepEqual(requests.at(-1), { path: '/api/v1/admin/teams/4', method: 'PUT', body: teamBody });
  data = zone;
  await saveZone(1, null, { ...zone, active: false });
  assert.equal(requests.at(-1).path, '/api/v1/sites/1/zones');
  assert.equal(requests.at(-1).method, 'POST');
  await saveZone(1, 7, { ...zone, active: false });
  assert.equal(requests.at(-1).path, '/api/v1/sites/1/zones/7');
  assert.equal(requests.at(-1).body.active, false);
  data = worker;
  const body = { name: '작업자', phone: null, jobType: '배관공', employmentType: 'DAILY', teamId: null, assignedFrom: '2026-11-02' };
  await saveWorker(1, null, body);
  assert.deepEqual(requests.at(-1), { path: '/api/v1/sites/1/workers', method: 'POST', body });
  await saveWorker(1, 5, { ...body, lockVersion: 2 });
  assert.equal(requests.at(-1).path, '/api/v1/sites/1/workers/5');
  assert.equal(requests.at(-1).body.lockVersion, 2);
  await changeWorkerAssignment(1, 5, 'assign', '2026-11-02');
  assert.deepEqual(requests.at(-1), { path: '/api/v1/sites/1/workers/5/assign', method: 'POST', body: { date: '2026-11-02' } });
  await changeWorkerAssignment(1, 5, 'leave', '');
  assert.deepEqual(requests.at(-1), { path: '/api/v1/sites/1/workers/5/leave', method: 'POST', body: {} });
  const before = requests.length;
  await assert.rejects(saveWorker(1, 5, body), /lockVersion/);
  await assert.rejects(saveZone(1, '../7', {}), /ID/);
  await assert.rejects(saveTeam(0, {}), /ID/);
  await assert.rejects(changeWorkerAssignment(1, 5, 'delete'), /동작/);
  assert.equal(requests.length, before);
  status = 409;
  await assert.rejects(saveWorker(1, 5, { ...body, lockVersion: 2 }),
    (error) => error.code === 'CONFLICT_MODIFIED');
});
