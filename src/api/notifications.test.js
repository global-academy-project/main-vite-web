import test from 'node:test';
import assert from 'node:assert/strict';
import {
  dismissNotification, getNotificationPreferences, getNotifications, getUnreadCount,
  readAllNotifications, readNotification, saveNotificationPreferences,
} from './notifications.js';
import { reloadJobConflict } from './jobs.js';

test('notification routes, recipient IDs, preference bodies, definite and uncertain errors', async (t) => {
  const storage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => null } });
  t.after(() => {
    if (storage) Object.defineProperty(globalThis, 'localStorage', storage);
    else delete globalThis.localStorage;
  });
  const note = { id: 5, notificationId: 99, siteId: 2, type: 'BLOCKED', severity: 'CRITICAL',
    title: '작업 차단', message: '측정 누락', targetType: 'WORK', targetId: 31, readAt: null };
  const prefs = [{ type: 'BLOCKED', webEnabled: true, smsEnabled: false, mandatory: true }];
  let data = { unreadCount: 3 };
  let status = 200;
  let lost = false;
  const requests = [];
  t.mock.method(globalThis, 'fetch', async (path, options) => {
    requests.push({ path, method: options.method, body: options.body ? JSON.parse(options.body) : undefined });
    if (lost) throw new TypeError('response lost');
    return new Response(JSON.stringify(status < 400 ? { success: true, data }
      : { success: false, error: { code: 'INVALID_REQUEST', message: '필수 알림' } }),
    { status, headers: { 'Content-Type': 'application/json' } });
  });
  assert.equal(await getUnreadCount(), 3);
  assert.equal(requests.at(-1).path, '/api/v1/notifications/unread-count');
  data = { unreadCount: 3, items: [note] };
  assert.deepEqual((await getNotifications({ siteId: '2', unreadOnly: true })).items, [note]);
  assert.equal(requests.at(-1).path, '/api/v1/notifications?unreadOnly=true&siteId=2');
  data = { ...note, readAt: '2026-11-02T12:40:00' };
  assert.equal((await readNotification(5)).id, 5);
  assert.deepEqual(requests.at(-1), { path: '/api/v1/notifications/5/read', method: 'POST', body: undefined });
  data = { unreadCount: 0 };
  assert.equal(await readAllNotifications(), 0);
  assert.equal(requests.at(-1).path, '/api/v1/notifications/read-all');
  data = null;
  await dismissNotification(5);
  assert.deepEqual(requests.at(-1), { path: '/api/v1/notifications/5/dismiss', method: 'POST', body: undefined });
  data = prefs;
  assert.deepEqual(await getNotificationPreferences(), prefs);
  assert.equal(requests.at(-1).path, '/api/v1/notifications/preferences');
  await saveNotificationPreferences(prefs);
  assert.deepEqual(requests.at(-1), { path: '/api/v1/notifications/preferences', method: 'PUT', body: prefs });
  const before = requests.length;
  await assert.rejects(saveNotificationPreferences([{ ...prefs[0], webEnabled: false }]), /필수/);
  await assert.rejects(readNotification(0), /ID/);
  await assert.rejects(dismissNotification('../5'), /ID/);
  await assert.rejects(getNotifications({ siteId: 0 }), /ID/);
  assert.equal(requests.length, before);
  data = { unreadCount: -1 };
  await assert.rejects(getUnreadCount(), /형식/);
  status = 400;
  await assert.rejects(readNotification(5), (error) => error.code === 'INVALID_REQUEST');
  lost = true;
  const countBefore = requests.length;
  await assert.rejects(dismissNotification(5), (error) => error.code === 'WRITE_OUTCOME_UNKNOWN');
  assert.equal(requests.length, countBefore + 1);
});

test('conflict recovery reads once, exposes the latest version and never retries a write', async () => {
  let reads = 0;
  const load = async () => { reads += 1; return { lockVersion: 4 }; };
  assert.deepEqual(await reloadJobConflict({ code: 'CONFLICT_MODIFIED', message: '충돌' }, load), { lockVersion: 4 });
  assert.equal(reads, 1);
  assert.equal(await reloadJobConflict({ code: 'WRITE_OUTCOME_UNKNOWN' }, load), null);
  assert.equal(await reloadJobConflict({ code: 'INVALID_STATE' }, load), null);
  assert.equal(reads, 1);
  await assert.rejects(reloadJobConflict({ code: 'CONFLICT_MODIFIED', message: '충돌' },
    async () => { throw new Error('연결 실패'); }), /충돌.*재조회.*연결 실패/);
});
