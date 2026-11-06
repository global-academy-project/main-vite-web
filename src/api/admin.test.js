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

test('admin account actions and sites use server paths', async (t) => {
  const { changeUserRole, unlockUser, verifyUserEmail, deactivateUser, reactivateUser, issueTemporaryPassword, getAdminSites, saveAdminSite } = await import('./admin.js');
  const member = { userId: 7, name: '회원', email: 'a@example.invalid', role: 'MEMBER', status: 'ACTIVE', emailVerified: true, sites: [] };
  const site = { siteId: 3, name: '여수', mode: 'VERIFY', active: true };
  let data = member;
  const requests = [];
  const storage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => null } });
  t.after(() => {
    if (storage) Object.defineProperty(globalThis, 'localStorage', storage);
    else delete globalThis.localStorage;
  });
  t.mock.method(globalThis, 'fetch', async (path, options) => {
    requests.push({ path, method: options.method, body: options.body ? JSON.parse(options.body) : undefined });
    return new Response(JSON.stringify({ success: true, data }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  });
  await changeUserRole(7, 'ADMIN');
  assert.deepEqual(requests.at(-1), { path: '/api/v1/admin/users/7/role', method: 'PUT', body: { role: 'ADMIN' } });
  for (const [call, action] of [[unlockUser, 'unlock'], [verifyUserEmail, 'verify-email'], [deactivateUser, 'deactivate'], [reactivateUser, 'reactivate']]) {
    await call(7);
    assert.deepEqual(requests.at(-1), { path: `/api/v1/admin/users/7/${action}`, method: 'POST', body: undefined });
  }
  await assert.rejects(changeUserRole(7, 'WRITER'), /역할/);
  data = { temporaryPassword: 'Tmp-1234' };
  assert.equal(await issueTemporaryPassword(7), 'Tmp-1234');
  assert.equal(requests.at(-1).path, '/api/v1/admin/users/7/temporary-password');
  data = {};
  await assert.rejects(issueTemporaryPassword(7), /형식/);

  data = [site];
  assert.deepEqual(await getAdminSites(), [site]);
  data = site;
  await saveAdminSite(null, { name: ' 여수 ', mode: 'VERIFY', active: false });
  assert.deepEqual(requests.at(-1), { path: '/api/v1/admin/sites', method: 'POST', body: { name: '여수', mode: 'VERIFY', active: null } });
  await saveAdminSite(3, { name: '여수', mode: 'GUIDE', active: false });
  assert.deepEqual(requests.at(-1), { path: '/api/v1/admin/sites/3', method: 'PUT', body: { name: '여수', mode: 'GUIDE', active: false } });
  await assert.rejects(saveAdminSite(3, { name: '', mode: 'VERIFY' }), /이름/);
  data = { ...site, mode: 'X' };
  await assert.rejects(getAdminSites(), /형식/);
});
