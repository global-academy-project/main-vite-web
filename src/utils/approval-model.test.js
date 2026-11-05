import assert from 'node:assert/strict';
import test from 'node:test';
import { approvalStats, unitLabel, filterApprovals, missingItemOptions, nextStep, shortDateTime, sortApprovals } from './approval-model.js';

const row = (patch) => ({ approvalId: 1, targetType: 'PERMIT', title: '탱크 허가', requestedByName: '김안전', requestedAt: '2026-11-05T09:00:00', dueAt: null, overdue: false, status: 'PENDING', ...patch });
const rows = [row({ approvalId: 1 }), row({ approvalId: 2, targetType: 'RISK', title: '지붕 평가', requestedByName: '이현장', requestedAt: '2026-11-03T08:00:00', status: 'REJECTED' }), row({ approvalId: 3, overdue: true, dueAt: '2026-11-05T08:00:00' })];

test('거르기: 종류·상태·기간·검색(제목·요청자)', () => {
  assert.deepEqual(filterApprovals(rows, { types: ['RISK'] }).map((r) => r.approvalId), [2]);
  assert.deepEqual(filterApprovals(rows, { status: 'PENDING' }).map((r) => r.approvalId), [1, 3]);
  assert.deepEqual(filterApprovals(rows, { from: '2026-11-04' }).map((r) => r.approvalId), [1, 3]);
  assert.deepEqual(filterApprovals(rows, { keyword: '이현장' }).map((r) => r.approvalId), [2]);
});

test('정렬: 지연 먼저, 그다음 마감 가까운 순', () => {
  assert.deepEqual(sortApprovals([row({ approvalId: 1, dueAt: '2026-11-05T12:00' }), row({ approvalId: 2 }), row({ approvalId: 3, overdue: true })]).map((r) => r.approvalId), [3, 1, 2]);
});

test('숫자 카드: 지연은 대기 중인 것만', () => {
  assert.deepEqual(approvalStats([...rows, row({ approvalId: 4, overdue: true, status: 'APPROVED' })]), { total: 4, pending: 2, overdue: 1, rejected: 1, approved: 1 });
});

test('누락 항목: 허가서 종류별 측정·확인 항목 키, 다른 문서는 없음', () => {
  const hot = missingItemOptions({ targetType: 'PERMIT', content: { permitType: 'HOT' } });
  assert.deepEqual(hot.map((o) => o.key), ['measurement.LEL', 'form.extinguisher_ready', 'form.spark_prevention', 'form.flammable_vapor_removed']);
  assert.ok(missingItemOptions({ targetType: 'PERMIT', content: { permitType: 'HEIGHT' } }).some((o) => o.key === 'form.fall_protection'));
  assert.deepEqual(missingItemOptions({ targetType: 'RISK', content: {} }), []);
  assert.deepEqual(missingItemOptions(null), []);
});

test('시각 줄임과 다음 단계', () => {
  assert.equal(shortDateTime('2026-11-05T09:20:00'), '11/05 09:20');
  assert.equal(shortDateTime(null), '');
  assert.equal(nextStep({ steps: [{ stepNo: 1, status: 'APPROVED' }, { stepNo: 2, status: 'PENDING' }] }).stepNo, 2);
});

test('측정 단위 코드를 화면 표시로', () => {
  assert.deepEqual(['PCT', 'PPM', 'PCT_LEL', null].map(unitLabel), ['%', 'ppm', '%LEL', '']);
});
