import test from 'node:test';
import assert from 'node:assert/strict';
import { statEntries } from './audit-report-model.js';

test('감사 대응 보고서 집계 표시: 비율은 %, 빈 값은 -, 목록·객체는 뺀다', () => {
  assert.deepEqual(statEntries({ works: 4, rate: 75.0, approvedRate: null, nested: { a: 1 }, list: [1] }),
    [['works', '4'], ['rate', '75%'], ['approvedRate', '-']]);
  assert.deepEqual(statEntries(null), []);
  assert.deepEqual(statEntries([1, 2]), []);
});
