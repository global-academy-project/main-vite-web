import test from 'node:test';
import assert from 'node:assert/strict';
import { permitSteps } from './permit-model.js';

const states = (input) => permitSteps({ reachable: {}, hasMeasurements: true, permit: null, currentEvaluation: null, submitted: false, ...input }).map((s) => s.state).join();

test('허가서 단계: 새 허가서 · 고소(측정 없음) · 판정 차단 · 승인 요청 후', () => {
  assert.equal(states({ step: 1 }), 'current,todo,todo,todo');
  assert.equal(states({ step: 1, hasMeasurements: false }), 'current,skip,todo,todo');
  assert.equal(states({ step: 2, reachable: { 1: true, 2: true, 3: false, 4: false }, permit: { permitNo: 'CF-1', measurements: [] } }), 'done,current,todo,todo');
  assert.equal(states({ step: 2, reachable: { 2: true, 3: true }, currentEvaluation: { result: 'BLOCK' }, permit: { permitNo: 'CF-1', measurements: [{}] } }), 'done,current,problem,todo');
  assert.equal(states({ step: 4, submitted: true, reachable: { 2: true, 3: true, 4: true }, permit: { permitNo: 'CF-1', measurements: [] } }), 'done,done,done,done');
});

test('단계 안내 글자', () => {
  const steps = permitSteps({ step: 3, reachable: { 2: true, 3: true }, hasMeasurements: true, permit: { permitNo: 'CF-1', measurements: [{}, {}] }, currentEvaluation: { result: 'PASS' }, submitted: false });
  assert.deepEqual(steps.map((s) => s.hint), ['CF-1', '2건', '통과', '']);
});
