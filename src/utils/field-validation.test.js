import assert from 'node:assert/strict';
import test from 'node:test';
import { firstInvalid, visibleErrors } from './field-validation.js';

const rules = {
  title: (value) => (String(value ?? '').trim() ? '' : '작업명을 입력하세요'),
  workers: (value) => (Number(value) > 0 ? '' : '1명 이상'),
};

test('입력 중(칸을 벗어나기 전)에는 오류를 보이지 않는다', () => {
  const errors = visibleErrors({ values: { title: '', workers: 0 }, rules, touched: {}, submitted: false });
  assert.deepEqual(errors, {});
});

test('칸을 벗어나면 그 칸만 보인다', () => {
  const errors = visibleErrors({ values: { title: '', workers: 0 }, rules, touched: { title: true }, submitted: false });
  assert.deepEqual(errors, { title: '작업명을 입력하세요' });
});

test('저장을 누르면 모든 칸을 보이고, 고친 칸은 바로 사라진다', () => {
  const before = visibleErrors({ values: { title: '', workers: 0 }, rules, touched: {}, submitted: true });
  assert.deepEqual(Object.keys(before), ['title', 'workers']);
  const after = visibleErrors({ values: { title: '탱크 청소', workers: 0 }, rules, touched: {}, submitted: true });
  assert.deepEqual(after, { workers: '1명 이상' });
});

test('서버 오류는 웹 규칙 오류가 없는 칸에 붙는다', () => {
  const errors = visibleErrors({
    values: { title: '탱크 청소', workers: 2 }, rules, touched: {}, submitted: true,
    serverErrors: { title: '이미 같은 작업이 있습니다', zoneId: '구역을 선택하세요' },
  });
  assert.deepEqual(errors, { title: '이미 같은 작업이 있습니다', zoneId: '구역을 선택하세요' });
});

test('첫 문제 칸은 주어진 순서를 따른다', () => {
  assert.equal(firstInvalid({ title: '', workers: 0 }, rules, ['workers', 'title']), 'workers');
  assert.equal(firstInvalid({ title: 'a', workers: 1 }, rules), null);
});
