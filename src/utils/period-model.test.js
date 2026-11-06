import assert from 'node:assert/strict';
import test from 'node:test';
import { datesBetween, parseStoredPeriod, periodDays, periodError, presetOf, presetRange } from './period-model.js';

test('기간 버튼: 오늘을 포함해 거슬러 간다', () => {
  assert.deepEqual(presetRange(1, '2026-11-06'), { from: '2026-11-06', to: '2026-11-06' });
  assert.deepEqual(presetRange(7, '2026-11-06'), { from: '2026-10-31', to: '2026-11-06' });
  assert.deepEqual(presetRange(30, '2026-11-06'), { from: '2026-10-08', to: '2026-11-06' });
});

test('지금 기간과 같은 버튼을 찾는다', () => {
  assert.equal(presetOf('2026-10-31', '2026-11-06', '2026-11-06'), '7');
  assert.equal(presetOf('2026-11-06', '2026-11-06', '2026-11-06'), 'today');
  assert.equal(presetOf('2026-11-01', '2026-11-05', '2026-11-06'), null);
});

test('기간 검사: 순서·최대 일수·형식', () => {
  assert.equal(periodError('2026-11-01', '2026-11-06'), '');
  assert.match(periodError('2026-11-06', '2026-11-01'), /끝 날짜/);
  assert.match(periodError('2026-09-01', '2026-11-06'), /최대 31일/);
  assert.match(periodError('2026-13-01', '2026-11-06'), /날짜/);
  assert.equal(periodDays('2026-10-31', '2026-11-06'), 7);
});

test('날짜 목록은 최신부터, 월을 넘어가도 맞다', () => {
  assert.deepEqual(datesBetween('2026-10-30', '2026-11-02'), ['2026-11-02', '2026-11-01', '2026-10-31', '2026-10-30']);
});

test('저장해 둔 기간: 틀린 값은 버린다', () => {
  assert.deepEqual(parseStoredPeriod('{"from":"2026-11-01","to":"2026-11-06"}'), { from: '2026-11-01', to: '2026-11-06' });
  assert.equal(parseStoredPeriod('{"from":"2026-11-06","to":"2026-11-01"}'), null);
  assert.equal(parseStoredPeriod('not json'), null);
  assert.equal(parseStoredPeriod(null), null);
});
