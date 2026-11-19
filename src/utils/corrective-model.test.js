import test from 'node:test';
import assert from 'node:assert/strict';
import { actionButtons, actionStats, filterActions, sourcePath } from './corrective-model.js';

test('개선조치 버튼은 상태와 역할에 따라 나온다', () => {
  assert.deepEqual(actionButtons({ status: 'OPEN', createdBy: 3 }, { role: 'WRITER', userId: 3 }).map((b) => b.step), ['start', 'cancel']);
  assert.deepEqual(actionButtons({ status: 'OPEN', createdBy: 3 }, { role: 'WRITER', userId: 4 }).map((b) => b.step), ['start']);
  assert.deepEqual(actionButtons({ status: 'IN_PROGRESS', createdBy: 3 }, { role: 'APPROVER', userId: 9 }).map((b) => b.step), ['complete', 'cancel']);
  assert.equal(actionButtons({ status: 'IN_PROGRESS' }, { role: 'WRITER' })[0].needsNote, true);
  assert.deepEqual(actionButtons({ status: 'DONE' }, { role: 'WRITER' }), []);
  assert.deepEqual(actionButtons({ status: 'DONE' }, { role: 'SITE_ADMIN' }).map((b) => b.step), ['verify', 'reopen']);
  assert.deepEqual(actionButtons({ status: 'VERIFIED' }, { role: 'ADMIN' }), []);
});

test('출처 화면 주소', () => {
  assert.equal(sourcePath('NEAR_MISS', 9), '/job/incidents?incidentId=9');
  assert.equal(sourcePath('INSPECTION', 4), '/job/dailey-checklist?inspectionId=4');
  assert.equal(sourcePath('AUDIT', 2), '/audit-reports/2');
  assert.equal(sourcePath('OTHER', null), null);
});

test('건수 카드와 거르기: 기한 지남은 서버 overdue 표시를 따른다', () => {
  const rows = [
    { actionId: 1, status: 'OPEN', title: '난간 보수', overdue: true, assigneeName: '김철수' },
    { actionId: 2, status: 'IN_PROGRESS', title: '배관 점검', description: '누설 확인' },
    { actionId: 3, status: 'DONE', title: '소화기 교체' },
    { actionId: 4, status: 'VERIFIED', title: '표지판' },
    { actionId: 5, status: 'CANCELED', title: '중복' },
  ];
  assert.deepEqual(actionStats(rows), { open: 2, done: 1, overdue: 1, all: 5 });
  assert.deepEqual(filterActions(rows, { view: 'open' }).map((a) => a.actionId), [1, 2]);
  assert.deepEqual(filterActions(rows, { view: 'overdue' }).map((a) => a.actionId), [1]);
  assert.deepEqual(filterActions(rows, { view: 'all', keyword: '누설' }).map((a) => a.actionId), [2]);
  assert.deepEqual(filterActions(rows, { view: 'all', keyword: '철수' }).map((a) => a.actionId), [1]);
  assert.deepEqual(actionStats([]), { open: 0, done: 0, overdue: 0, all: 0 });
});
