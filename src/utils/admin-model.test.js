import test from 'node:test';
import assert from 'node:assert/strict';
import { accountActions, dateTime, grantList, grantMap, grantableSites, sameGrants, statusCounts, visibleMembers } from './admin-model.js';

const members = [
  { userId: 1, name: '나관리', email: 'admin@x', role: 'ADMIN', status: 'ACTIVE', emailVerified: true, sites: [{ siteId: 1, role: 'ADMIN' }] },
  { userId: 2, name: '가입중', email: 'new@x', role: 'MEMBER', status: 'PENDING', emailVerified: false, sites: [] },
  { userId: 3, name: '다잠김', email: 'lock@x', department: '안전팀', role: 'MEMBER', status: 'LOCKED', emailVerified: true, sites: [{ siteId: 2, role: 'WRITER' }] },
  { userId: 4, name: '라퇴사', email: 'out@x', role: 'MEMBER', status: 'INACTIVE', emailVerified: true, sites: [] },
];

test('counts and visible order', () => {
  assert.deepEqual(statusCounts(members), { '': 4, PENDING: 1, ACTIVE: 1, INACTIVE: 1, LOCKED: 1 });
  assert.deepEqual(visibleMembers(members).map((m) => m.userId), [2, 3, 1, 4]);
  assert.deepEqual(visibleMembers(members, { query: '안전' }).map((m) => m.userId), [3]);
  assert.deepEqual(visibleMembers(members, { status: 'ACTIVE' }).map((m) => m.userId), [1]);
});

test('grants', () => {
  assert.deepEqual(grantMap(members[0]), {});
  assert.deepEqual(grantMap(members[2]), { 2: 'WRITER' });
  assert.deepEqual(grantList({ 1: 'APPROVER', 2: '' }), [{ siteId: 1, role: 'APPROVER' }]);
  assert.ok(sameGrants({ 1: 'WRITER', 2: '' }, { 1: 'WRITER' }));
  assert.ok(!sameGrants({ 1: 'WRITER' }, { 1: 'APPROVER' }));
  const sites = [{ siteId: 1, name: 'A', active: true }, { siteId: 2, name: 'B', active: false }, { siteId: 5, name: 'C', active: false }];
  assert.deepEqual(grantableSites(sites, members[2]).map((s) => s.siteId), [1, 2]);
  assert.equal(dateTime('2026-11-06T09:30:12'), '2026-11-06 09:30');
});

test('account actions depend on status and self', () => {
  assert.deepEqual(accountActions(members[0], 1), ['temporaryPassword']);
  assert.deepEqual(accountActions(members[1], 1), ['verifyEmail']);
  assert.deepEqual(accountActions(members[2], 1), ['unlock', 'temporaryPassword', 'role', 'deactivate']);
  assert.deepEqual(accountActions(members[3], 1), ['role', 'reactivate']);
});
