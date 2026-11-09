import assert from 'node:assert/strict';
import test from 'node:test';
import { exampleText, extractFill, fieldHint, insertTerm, quickTerms } from './extract-model.js';

const fields = [{ code: 'O2', label: '산소 (%)' }, { code: 'H2S', label: '황화수소 (ppm)' }, { code: 'LEL', label: '가연성가스 (% LEL)' }];
const check = (target, status, extra = {}) => ({ ruleCode: target, category: 'MEASUREMENT', target, status, severity: 'BLOCK', expected: '18~23.5', actual: null, ...extra });
const response = {
  extraction: {
    measurements: [{ item: 'O2', value: 17.5, unit: 'PCT', evidence: '산소 17.5%', source: 'RULE' }, { item: 'CO', value: 5, unit: 'PPM' }],
    notes: ['황화수소: 값이 둘 이상입니다 (3, 5). 비워 둡니다.'],
  },
  input: { measurement: { O2: 17.5 }, form: { watcher_name: '김도윤' } },
  previews: [{ workType: 'CONFINED', check: { checks: [check('measurement.O2', 'FAIL', { actual: '17.5', message: '산소 기준 미달' }), check('measurement.H2S', 'MISSING'), check('measurement.LEL', 'MISSING'), check('form.ventilation_done', 'MISSING')] } }],
};

test('빠른 입력 말: 칸 이름 앞부분 + 감시인', () => {
  assert.deepEqual(quickTerms(fields), ['산소', '황화수소', '가연성가스', '감시인']);
});

test('안내 예시: 허가 종류 칸 이름으로 만든다', () => {
  assert.equal(exampleText(fields), '산소 20.9 황화수소 3 가연성가스 0 감시인 김도윤');
  assert.equal(exampleText([{ code: 'LEL', label: '가연성가스 (% LEL)' }]), '가연성가스 0 감시인 김도윤');
});

test('커서 자리에 말 넣기: 띄어쓰기를 맞춘다', () => {
  assert.deepEqual(insertTerm('', '산소'), ['산소 ', 3]);
  assert.deepEqual(insertTerm('산소 20.9', '황화수소'), ['산소 20.9 황화수소 ', 13]);
  assert.deepEqual(insertTerm('산소 20.9 감시인', '황화수소', 8, 8), ['산소 20.9 황화수소 감시인', 13]);
});

test('추출 결과: 그 허가 칸만 채우고, 누락·기준 밖은 서버 판정 그대로', () => {
  const fill = extractFill(response, 'CONFINED', fields);
  assert.deepEqual(fill.values, { O2: '17.5' }); // CO 는 이 칸 목록에 없으니 넣지 않는다
  assert.deepEqual(fill.filled, ['O2']);
  assert.deepEqual(fill.missing, ['H2S', 'LEL']); // form.* 은 측정 칸이 아니라 뺀다
  assert.equal(fill.out.O2.expected, '18~23.5');
  assert.equal(fill.watcher, '김도윤');
  assert.equal(fill.notes.length, 1);
});

test('칸 표시: 값을 고치면 표시가 사라지고, 빈칸을 채우면 입력 필요가 사라진다', () => {
  const fill = extractFill(response, 'CONFINED', fields);
  assert.equal(fieldHint(fill, 'O2', '17.5').kind, 'out');
  assert.equal(fieldHint(fill, 'O2', '20.9'), null);
  assert.equal(fieldHint(fill, 'H2S', '').kind, 'missing');
  assert.equal(fieldHint(fill, 'H2S', '3'), null);
  assert.equal(fieldHint(null, 'O2', '1'), null);
});
