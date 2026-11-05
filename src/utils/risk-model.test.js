import test from 'node:test';
import assert from 'node:assert/strict';
import { blankRiskItem, itemScore, levelCounts, levelOfScore, riskItemForForm, riskSteps } from './risk-model.js';

test('점수 → 등급: 12 이상 높음, 6 이상 보통', () => {
  assert.equal(levelOfScore(15), 'HIGH');
  assert.equal(levelOfScore(12), 'HIGH');
  assert.equal(levelOfScore(6), 'MEDIUM');
  assert.equal(levelOfScore(5), 'LOW');
  assert.equal(levelOfScore(null), null);
});

test('선택 등급이 계산보다 낮으면 저장 등급은 계산 등급 (높게 고른 것은 유지)', () => {
  assert.deepEqual(itemScore({ frequency: '3', severity: '5', riskLevel: 'MEDIUM', residualFrequency: '1', residualSeverity: '5' }), { before: 15, after: 5, computed: 'HIGH', saved: 'HIGH', raised: true });
  assert.deepEqual(itemScore({ frequency: '1', severity: '2', riskLevel: 'HIGH', residualFrequency: '', residualSeverity: '' }), { before: 2, after: null, computed: 'LOW', saved: 'HIGH', raised: false });
  assert.equal(itemScore({ ...blankRiskItem(1) }).before, null);
  assert.equal(itemScore({ frequency: '7', severity: '1', riskLevel: 'LOW' }).before, null);
});

test('등급 개수 · 서버 항목 변환 · 단계', () => {
  assert.deepEqual(levelCounts([{ frequency: '3', severity: '5', riskLevel: 'LOW' }, { frequency: '1', severity: '1', riskLevel: 'LOW' }, blankRiskItem(3)]), { HIGH: 1, MEDIUM: 1, LOW: 1 });
  assert.equal(riskItemForForm({ frequency: 3, severity: 5, residualFrequency: null }, 0).residualFrequency, '');
  assert.equal(riskSteps(null).map((s) => s.state).join(), 'current,todo,todo');
  assert.equal(riskSteps({ status: 'PENDING' }).map((s) => s.state).join(), 'done,done,current');
  assert.equal(riskSteps({ status: 'REJECTED' }).map((s) => s.state).join(), 'problem,todo,problem');
});
