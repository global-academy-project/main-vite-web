import test from 'node:test';
import assert from 'node:assert/strict';
import { healthCounts, parseWorkIds, tbmStatusLabel, tbmSteps, toggleWorkId } from './tbm-model.js';

const states = (tbm, extra) => tbmSteps(tbm, extra).map((step) => step.state).join();

test('TBM 단계와 상태 이름', () => {
  assert.equal(states(null), 'current,todo,todo,todo,todo');
  assert.equal(states({ tbmId: 1, status: 'DRAFT' }, { attendeesSaved: false, attendeeTotal: 2 }), 'done,current,todo,todo,todo');
  assert.equal(states({ tbmId: 1, status: 'DRAFT' }, { attendeesSaved: true, attendeeTotal: 2 }), 'done,done,current,todo,todo');
  assert.equal(states({ tbmId: 1, status: 'DONE' }), 'done,done,done,current,todo');
  assert.equal(states({ tbmId: 1, status: 'DONE', approvalStatus: 'PENDING' }), 'done,done,done,done,current');
  assert.equal(states({ tbmId: 1, status: 'APPROVED' }), 'done,done,done,done,done');
  assert.equal(tbmStatusLabel({ status: 'DONE', approvalStatus: 'PENDING' }), '확인 요청 중');
  assert.equal(tbmStatusLabel(null), '새 TBM');
});

test('연결 작업 고르기는 "31, 32" 문자열을 유지한다', () => {
  assert.deepEqual(parseWorkIds('31, 32, x, '), ['31', '32']);
  assert.equal(toggleWorkId('31, 32', 33, true), '31, 32, 33');
  assert.equal(toggleWorkId('31, 32', 31, false), '32');
  assert.equal(toggleWorkId('', 5, true), '5');
  assert.deepEqual(healthCounts([{ healthOk: true }, { healthOk: false }, { healthOk: null }, {}]), { ok: 1, bad: 1, unknown: 2 });
});
