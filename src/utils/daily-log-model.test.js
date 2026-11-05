import test from 'node:test';
import assert from 'node:assert/strict';
import { checksTotal, dailyLogSteps, deadlineOf, shiftDate, teamRow } from './daily-log-model.js';

const states = (log) => dailyLogSteps(log).map((step) => step.state).join(',');

test('일지 단계: 없음 · 작성 중 · 승인 대기 · 승인 · 반려', () => {
  assert.equal(states(null), 'current,todo,todo,todo');
  assert.equal(states({ status: 'DRAFT' }), 'done,current,todo,todo');
  assert.equal(states({ status: 'PENDING' }), 'done,done,done,current');
  assert.equal(states({ status: 'APPROVED' }), 'done,done,done,done');
  assert.equal(states({ status: 'REJECTED' }), 'done,current,todo,problem');
});

test('날짜 이동은 달·해를 넘긴다', () => {
  assert.equal(shiftDate('2026-11-30', 1), '2026-12-01');
  assert.equal(shiftDate('2026-01-01', -1), '2025-12-31');
  assert.equal(shiftDate('', 1), '');
});

test('마감 · 합계 · 팀 행', () => {
  assert.equal(deadlineOf(null), null);
  assert.deepEqual(deadlineOf({ deadlines: { dailyLogDeadline: '2026-11-05T18:00:00', dailyLogPassed: false } }), { passed: false, text: '안전일지 마감 18:00' });
  assert.deepEqual(deadlineOf({ deadlines: { dailyLogDeadline: '2026-11-05T18:00:00', dailyLogPassed: true } }), { passed: true, text: '안전일지 마감 지남' });
  assert.equal(checksTotal([{ count: 2 }, { count: 3 }, {}]), 5);
  assert.deepEqual(teamRow({ teamId: 3, name: 'A팀', status: 'DRAFT', signatureMissing: 2 }, 0), { key: 3, name: 'A팀', status: 'DRAFT', signatures: 2, measurements: '-', photos: '-' });
});
