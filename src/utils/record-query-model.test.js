import test from 'node:test';
import assert from 'node:assert/strict';
import { groupEvidence } from './record-query-model.js';

test('근거 기록은 종류별로 묶고 같은 기록은 한 번만', () => {
  const groups = groupEvidence([
    { type: 'PERMIT', id: 31, label: '밀폐공간 허가' }, { type: 'WORK', id: 101 }, { type: 'PERMIT', id: 32 }, { type: 'PERMIT', id: 31 }, { type: 'NEW_KIND', id: 1 }, null,
  ]);
  assert.deepEqual(groups.map((group) => [group.type, group.label, group.items.map((item) => item.id)]), [
    ['PERMIT', '작업허가', [31, 32]], ['WORK', '작업', [101]], ['NEW_KIND', 'NEW_KIND', [1]],
  ]);
  assert.deepEqual(groupEvidence(undefined), []);
});

test('지난 대화 제목', async () => {
  const { conversationTitle } = await import('./record-query-model.js');
  assert.equal(conversationTitle({ conversationId: 3, title: ' 지난달 TBM ' }), '지난달 TBM');
  assert.equal(conversationTitle({ conversationId: 3, title: '' }), '대화 #3');
});

test('지난 대화 날짜 묶음', async () => {
  const { groupConversations } = await import('./record-query-model.js');
  const { dayBucket } = await import('./notification-model.js');
  const now = new Date(2026, 10, 5, 16, 0);
  const groups = groupConversations([
    { conversationId: 1, lastMessageAt: '2026-11-05T10:00:00' }, { conversationId: 2, lastMessageAt: '2026-11-04T16:20:00' }, { conversationId: 3, lastMessageAt: '2026-10-28T11:05:00' },
  ], now, dayBucket);
  assert.deepEqual(groups.map((group) => [group.label, group.items.map((item) => item.conversationId)]), [['오늘', [1]], ['어제', [2]], ['이전', [3]]]);
});
