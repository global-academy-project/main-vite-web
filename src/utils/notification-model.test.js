import test from 'node:test';
import assert from 'node:assert/strict';
import { badgeText, dayBucket, groupNotifications, notificationTarget, relativeTime, severityOf, siteLabel } from './notification-model.js';

const now = new Date(2026, 10, 5, 15, 30);

test('배지 숫자는 0 이면 숨기고 100 이상은 99+', () => {
  assert.equal(badgeText(0), null);
  assert.equal(badgeText(null), null);
  assert.equal(badgeText(7), '7');
  assert.equal(badgeText(150), '99+');
});

test('시간 표시: 방금 · 분 전 · 오늘 · 어제 · 날짜', () => {
  assert.equal(relativeTime('2026-11-05T15:30:20', now), '방금');
  assert.equal(relativeTime('2026-11-05T15:05:00', now), '25분 전');
  assert.equal(relativeTime('2026-11-05T09:04:00', now), '오늘 09:04');
  assert.equal(relativeTime('2026-11-04T18:00:00', now), '어제 18:00');
  assert.equal(relativeTime('2026-10-28T08:10:00', now), '10/28 08:10');
  assert.equal(relativeTime('잘못된 값', now), '');
});

test('오늘·어제·이전으로 묶고 빈 묶음은 뺀다', () => {
  assert.equal(dayBucket(null, now), 2);
  const groups = groupNotifications([
    { id: 1, createdAt: '2026-11-05T10:00:00' }, { id: 2, createdAt: '2026-11-01T10:00:00' }, { id: 3, createdAt: '2026-11-05T08:00:00' },
  ], now);
  assert.deepEqual(groups.map((group) => [group.label, group.items.map((item) => item.id)]), [['오늘', [1, 3]], ['이전', [2]]]);
});

test('결재 알림은 승인함 드로어로, 나머지는 기존 기록 경로로', () => {
  assert.deepEqual(notificationTarget({ type: 'APPROVAL_REQUEST', targetType: 'APPROVAL', targetId: 51 }), { path: '/approvals?tab=pending&open=51', label: '검토하기' });
  assert.deepEqual(notificationTarget({ type: 'APPROVAL_RESULT', targetType: 'APPROVAL', targetId: 52 }), { path: '/approvals?tab=requested&open=52', label: '결과 보기' });
  assert.deepEqual(notificationTarget({ type: 'BLOCKED', targetType: 'WORK', targetId: 31 }), { path: '/job/workspace?workId=31', label: '열기' });
  assert.equal(notificationTarget({ type: 'SYSTEM', targetType: null, targetId: null }), null);
  assert.equal(notificationTarget({ type: 'DOCUMENT_READY', targetType: 'REPORT', targetId: 3 }), null);
});

test('심각도와 현장 이름', () => {
  assert.equal(severityOf('CRITICAL').label, '긴급');
  assert.equal(severityOf('이상한 값').label, '안내');
  assert.equal(siteLabel(1, [{ siteId: 1, name: '울산 2공장' }]), '울산 2공장');
  assert.equal(siteLabel(9, []), '현장 #9');
  assert.equal(siteLabel(null), '');
});
