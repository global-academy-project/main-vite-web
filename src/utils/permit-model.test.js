import test from 'node:test';
import assert from 'node:assert/strict';
import { localizeRuleText, permitSteps, ruleDetailLine, ruleValueLabels, SEVERITY_LABELS } from './permit-model.js';

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

const fields = { HEIGHT: { choices: [{ code: 'fall_protection', options: [
  { value: 'WORK_PLATFORM', label: '작업발판 설치' }, { value: 'SAFETY_NET', label: '추락방호망 설치' }, { value: 'SAFETY_HARNESS', label: '안전대 착용' },
] }] }, HOT: { choices: [] } };

test('판정 글자: 선택지 영어 코드는 입력 화면과 같은 한글로, 모르는 글자는 그대로', () => {
  const labels = ruleValueLabels(fields);
  assert.equal(localizeRuleText('WORK_PLATFORM, SAFETY_NET, SAFETY_HARNESS 중 하나', labels), '작업발판 설치, 추락방호망 설치, 안전대 착용 중 하나');
  assert.equal(localizeRuleText('SAFETY_HARNESS', labels), '안전대 착용');
  assert.equal(localizeRuleText('SAFETY_HARNESS_X', labels), 'SAFETY_HARNESS_X');
  assert.equal(localizeRuleText('18~23.5', labels), '18~23.5');
  assert.equal(localizeRuleText('확인 필요', labels), '확인 필요');
  assert.equal(localizeRuleText('true', labels), '조치 확인');
  assert.equal(localizeRuleText('false', labels), '미조치');
  assert.equal(localizeRuleText(null, labels), null);
  assert.equal(localizeRuleText(undefined, labels), undefined);
  assert.equal(localizeRuleText('WORK_PLATFORM', {}), 'WORK_PLATFORM');
  assert.deepEqual(ruleValueLabels(undefined), {});
});

test('위반 카드 둘째 줄: 입력 없음 · 기준 (기준이 "확인 필요"이면 기준 생략)', () => {
  const labels = ruleValueLabels(fields);
  assert.equal(ruleDetailLine({ actual: null, expected: 'WORK_PLATFORM, SAFETY_NET, SAFETY_HARNESS 중 하나' }, labels), '기준 작업발판 설치, 추락방호망 설치, 안전대 착용 중 하나');
  assert.equal(ruleDetailLine({ actual: null, expected: '확인 필요' }, labels), '');
  assert.equal(ruleDetailLine({ actual: null, expected: '입력 필요' }, labels), '');
  assert.equal(ruleDetailLine({ actual: '', expected: '' }, labels), '');
  assert.equal(ruleDetailLine({ actual: 'SAFETY_NET', expected: '확인 필요' }, labels), '입력값 추락방호망 설치');
  assert.equal(ruleDetailLine({ actual: '25', expected: '18~23.5' }, labels), '입력값 25 · 기준 18~23.5');
  assert.equal(ruleDetailLine({ actual: 0, expected: '' }, labels), '입력값 0');
  assert.equal(ruleDetailLine({ actual: 'false', expected: '입력 필요' }, labels), '입력값 미조치');
  assert.equal(ruleDetailLine({ actual: null, expected: '  입력 필요 ' }, labels), '');
  assert.equal(ruleDetailLine({ actual: null, expected: ' 18~23.5 ' }, labels), '기준 18~23.5');
  assert.equal(ruleDetailLine(undefined, labels), '');
  assert.ok(!ruleDetailLine({ actual: null, expected: '18~23.5' }, labels).includes('입력 없음'));
});

test('심각도 글자', () => {
  assert.equal(SEVERITY_LABELS.BLOCK, '차단');
  assert.equal(SEVERITY_LABELS.WARN, '주의');
});
