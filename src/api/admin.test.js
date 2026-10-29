import test from 'node:test';
import assert from 'node:assert/strict';
import { approveUser, getAdminUsers, replaceUserSites } from './admin.js';

test('admin list, approval and site replacement follow server contracts and propagate errors', async (t) => {
  const member = { userId: 7, name: '검증 회원', email: 'test@example.invalid',
    role: 'MEMBER', status: 'PENDING', emailVerified: true, sites: [] };
  const requests = [];
  let data = [member];
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
    return new Response(JSON.stringify(status === 200 ? { success: true, data }
      : { success: false, error: { code: status === 403 ? 'FORBIDDEN' : 'INVALID_STATE', message: '요청 거절' } }),
    { status, headers: { 'Content-Type': 'application/json' } });
  });
  assert.deepEqual(await getAdminUsers('PENDING'), [member]);
  assert.equal(requests.at(-1).path, '/api/v1/admin/users?status=PENDING');
  await getAdminUsers();
  assert.equal(requests.at(-1).path, '/api/v1/admin/users');
  const sites = [{ siteId: 1, role: 'WRITER' }];
  data = { ...member, status: 'ACTIVE', sites };
  await approveUser(7, { role: 'MEMBER', sites });
  assert.deepEqual(requests.at(-1), {
    path: '/api/v1/admin/users/7/approve', method: 'POST', body: { role: 'MEMBER', sites },
  });
  await replaceUserSites(7, []);
  assert.deepEqual(requests.at(-1), {
    path: '/api/v1/admin/users/7/sites', method: 'PUT', body: { sites: [] },
  });
  const before = requests.length;
  await assert.rejects(getAdminUsers('UNKNOWN'), /상태/);
  await assert.rejects(approveUser(7, { role: 'MEMBER', sites: [] }), /1개/);
  await assert.rejects(replaceUserSites(7, [...sites, ...sites]), /중복/);
  await assert.rejects(replaceUserSites(7, [{ siteId: 1, role: 'ADMIN' }]), /역할/);
  await assert.rejects(replaceUserSites('../7', sites), /ID/);
  assert.equal(requests.length, before);
  data = { ...member, role: 'UNKNOWN' };
  await assert.rejects(replaceUserSites(7, sites), /형식/);
  data = {};
  await assert.rejects(getAdminUsers(), /형식/);
  for (const code of [403, 409]) {
    status = code;
    await assert.rejects(approveUser(7, { role: 'MEMBER', sites }), (error) => error.status === code);
  }
});
