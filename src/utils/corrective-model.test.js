import test from 'node:test';
import assert from 'node:assert/strict';
import { actionButtons, sourcePath } from './corrective-model.js';

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
