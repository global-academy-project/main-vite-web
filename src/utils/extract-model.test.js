import assert from 'node:assert/strict';
import test from 'node:test';
import { MAX_FILL_TEXTS, exampleText, extractFill, fieldHint, insertTerm, mergeFill, quickTerms, remainingCodes } from './extract-model.js';

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

const second = {
  extraction: { measurements: [{ item: 'H2S', value: 3, unit: 'PPM' }, { item: 'O2', value: 20.9, unit: 'PCT' }], notes: [] },
  input: { measurement: {}, form: {} },
  previews: [{ workType: 'CONFINED', check: { checks: [check('measurement.O2', 'PASS'), check('measurement.H2S', 'PASS'), check('measurement.LEL', 'MISSING')] } }],
};

test('서버 규칙이 판정하는 측정 칸을 required 로 모은다 (양식 항목 제외)', () => {
  assert.deepEqual(extractFill(response, 'CONFINED', fields).required, ['O2', 'H2S', 'LEL']);
});

test('이어서 채우기: 값은 합치고 같은 칸은 뒤 문장, 기준 밖은 새로 채운 칸만 다시 판정, 문장은 모두 남긴다', () => {
  const first = mergeFill(null, extractFill(response, 'CONFINED', fields), '산소 17.5%');
  assert.deepEqual(first.texts, ['산소 17.5%']);
  assert.equal(first.text, '산소 17.5%');

  const merged = mergeFill(first, extractFill(second, 'CONFINED', fields), '황화수소 3 산소 20.9');
  assert.deepEqual(merged.values, { O2: '20.9', H2S: '3' });
  assert.deepEqual(merged.filled, ['O2', 'H2S']);
  assert.deepEqual(merged.lastFilled, ['H2S', 'O2']);
  assert.deepEqual(merged.out, {}); // O2 를 다시 채워 이전 기준 밖 표시는 사라짐
  assert.deepEqual(merged.texts, ['산소 17.5%', '황화수소 3 산소 20.9']);
  assert.equal(merged.text, '산소 17.5%\n황화수소 3 산소 20.9');
  assert.equal(merged.watcher, '김도윤'); // 이번 문장에 없으면 앞 문장 것
});

test('남은 칸: 지금 칸 값 기준으로 비어 있는 필수 칸만, 칸 순서대로', () => {
  const fill = extractFill(response, 'CONFINED', fields);
  assert.deepEqual(remainingCodes(fill, { O2: '17.5' }, fields), ['H2S', 'LEL']);
  assert.deepEqual(remainingCodes(fill, { O2: '17.5', H2S: '3', LEL: ' ' }, fields), ['LEL']);
  assert.deepEqual(remainingCodes(fill, { O2: '1', H2S: '0', LEL: '0' }, fields), []); // 0 도 채운 값
  assert.deepEqual(remainingCodes(null, {}, fields), []);
});

test('칸 표시: 문장으로 채운 뒤 비어 있는 필수 칸은 입력 필요 (이번 문장이 다른 칸만 채웠어도)', () => {
  const merged = mergeFill(mergeFill(null, extractFill(response, 'CONFINED', fields), 'a'), extractFill(second, 'CONFINED', fields), 'b');
  assert.equal(fieldHint(merged, 'LEL', '').kind, 'missing');
  assert.equal(fieldHint(merged, 'H2S', '3').kind, 'filled');
});

test('나눠 보낼 수 있는 문장 수는 서버와 같은 10개', () => {
  assert.equal(MAX_FILL_TEXTS, 10);
});
