import test from 'node:test';
import assert from 'node:assert/strict';
import { answerCounts, answersOf, changedAnswers, diffCodes, expectedResult, groupItems, inspectionSteps, targetName } from './inspection-model.js';

const inspection = {
  inspectionId: 7, status: 'DRAFT', targetType: 'ZONE', zoneId: 3, zoneName: '탱크 구역 A', answered: 1, total: 3,
  items: [
    { itemCode: 'A', section: '기본', question: 'q1', result: 'OK', note: null },
    { itemCode: 'B', section: '기본', question: 'q2', result: null, note: null },
    { itemCode: 'C', section: null, question: 'q3', result: null, note: null },
  ],
};

test('expected result follows the server rule (NA excluded)', () => {
  assert.equal(expectedResult({ a: { result: 'OK' }, b: { result: null } }), null);
  assert.equal(expectedResult({ a: { result: 'OK' }, b: { result: 'NA' } }), 'PASS');
  assert.equal(expectedResult({ a: { result: 'OK' }, b: { result: 'NG' } }), 'PARTIAL');
  assert.equal(expectedResult({ a: { result: 'NA' }, b: { result: 'NG' } }), 'FAIL');
  assert.equal(expectedResult({}), null);
});

test('answers, counts and changed items', () => {
  const answers = answersOf(inspection);
  assert.deepEqual(answers.A, { result: 'OK', note: '' });
  answers.B = { result: 'NG', note: '' };
  answers.C = { result: 'NA', note: '' };
  const counts = answerCounts(answers);
  assert.equal(counts.answered, 3); assert.equal(counts.NG, 1); assert.equal(counts.missingNote, 1);
  // NG 에 내용이 없으면 아직 보내지 않는다
  assert.deepEqual(changedAnswers(inspection, answers), [{ itemCode: 'C', result: 'NA', note: null }]);
  assert.deepEqual(diffCodes(inspection, answers), ['B', 'C']);
  answers.B.note = ' 난간 파손 ';
  answers.A = { result: null, note: '' };
  assert.deepEqual(changedAnswers(inspection, answers), [
    { itemCode: 'A', result: null, note: null }, { itemCode: 'B', result: 'NG', note: '난간 파손' }, { itemCode: 'C', result: 'NA', note: null },
  ]);
});

test('groups, target name and steps', () => {
  assert.deepEqual(groupItems(inspection.items).map((group) => [group.title, group.items.length]), [['기본', 2], ['기타', 1]]);
  assert.equal(targetName(inspection), '탱크 구역 A');
  assert.equal(targetName({ targetType: 'EQUIPMENT', equipmentId: 4, equipmentName: null }), '설비 #4');
  assert.deepEqual(inspectionSteps(null).map((step) => step.state), ['current', 'todo', 'todo', 'todo']);
  assert.deepEqual(inspectionSteps(inspection).map((step) => step.state), ['done', 'current', 'todo', 'todo']);
  assert.deepEqual(inspectionSteps({ ...inspection, answered: 3 }).map((step) => step.state), ['done', 'done', 'current', 'todo']);
  assert.deepEqual(inspectionSteps({ ...inspection, answered: 3 }, { dirty: true }).map((step) => step.state), ['done', 'current', 'todo', 'todo']);
  assert.deepEqual(inspectionSteps({ ...inspection, status: 'PENDING' }).map((step) => step.state), ['done', 'done', 'done', 'current']);
});
