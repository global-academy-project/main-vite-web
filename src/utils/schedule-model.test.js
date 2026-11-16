import test from 'node:test';
import assert from 'node:assert/strict';
import { addMonths, byDay, dayColumns, hourRange, layoutBlocks, monthCells, rangeFor, rangeLabel, shiftAnchor, weekDays, weekStart } from './schedule-model.js';

const w = (id, start, end, extra = {}) => ({ workId: id, title: `작업 ${id}`, workDate: '2026-11-16', startAt: start && `2026-11-16T${start}:00`, endAt: end && `2026-11-16T${end}:00`, ...extra });

test('보기별 범위는 31일을 넘지 않는다', () => {
  assert.deepEqual(rangeFor('day', '2026-11-16'), ['2026-11-16', '2026-11-16']);
  assert.deepEqual(rangeFor('week', '2026-11-18'), ['2026-11-15', '2026-11-21']);
  assert.deepEqual(rangeFor('month', '2026-02-10'), ['2026-02-01', '2026-02-28']);
  assert.deepEqual(rangeFor('month', '2026-12-31'), ['2026-12-01', '2026-12-31']);
});

test('주는 일요일부터, 이동은 보기 단위', () => {
  assert.equal(weekStart('2026-11-21'), '2026-11-15');
  assert.equal(weekStart('2026-11-22'), '2026-11-22');
  assert.equal(shiftAnchor('week', '2026-11-16', -1), '2026-11-09');
  assert.equal(shiftAnchor('month', '2026-01-31', 1), '2026-02-28');
  assert.equal(addMonths('2026-03-31', -1), '2026-02-28');
  assert.deepEqual(weekDays('2026-11-16'), ['2026-11-15', '2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20', '2026-11-21']);
  assert.equal(rangeLabel('day', '2026-11-16'), '2026. 11. 16 (월)');
  assert.equal(rangeLabel('day', '2026-12-03'), '2026. 12. 03 (목)');
  assert.equal(rangeLabel('week', '2026-11-18'), '2026. 11. 15 ~ 11. 21');
  assert.equal(rangeLabel('week', '2026-12-02'), '2026. 11. 29 ~ 12. 05');
  assert.equal(rangeLabel('month', '2026-11-16'), '2026. 11');
});

test('월간 칸은 7의 배수, 바깥 날짜 표시', () => {
  const cells = monthCells('2026-11-16');
  assert.equal(cells.length % 7, 0);
  assert.equal(cells[0].date, '2026-11-01'); // 11월 1일이 일요일 → 앞 달 칸 없음
  assert.equal(cells[0].outside, false);
  const dec = monthCells('2026-12-10');
  assert.equal(dec[0].date, '2026-11-29'); // 일요일 시작
  assert.equal(dec[0].outside, true);
  assert.equal(dec.length % 7, 0);
  assert.ok(cells.some((cell) => cell.date === '2026-11-30' && !cell.outside));
});

test('겹치는 블록은 옆 줄로 나뉜다', () => {
  const out = layoutBlocks([w(1, '08:00', '12:00'), w(2, '10:30', '12:30'), w(3, '13:00', '14:00'), w(4, null, null)]);
  assert.equal(out.length, 3);
  const [a, b, c] = out;
  assert.equal(a.lanes, 2); assert.equal(b.lanes, 2); assert.notEqual(a.lane, b.lane);
  assert.equal(c.lanes, 1); assert.equal(c.lane, 0);
});

test('끝 시각이 없으면 1시간으로 그린다', () => {
  const [item] = layoutBlocks([w(1, '09:00', null)]);
  assert.equal(item.end - item.start, 60);
});

test('시간 범위는 기본 06~18시, 작업에 맞춰 넓힌다', () => {
  assert.deepEqual(hourRange([]), [6, 18]);
  assert.deepEqual(hourRange([w(1, '05:30', '20:10')]), [5, 21]);
});

test('열은 작업 있는 구역만 현장 설정 순서로, 미지정은 끝', () => {
  const zones = [{ zoneId: 1, name: 'A동' }, { zoneId: 2, name: 'B동' }, { zoneId: 3, name: '옥상' }];
  const cols = dayColumns([w(1, '08:00', '09:00', { zoneId: 3 }), w(2, '08:00', '09:00', { zoneId: 1 }), w(3, '08:00', '09:00', { zoneId: null })], zones);
  assert.deepEqual(cols.map((col) => col.name), ['A동', '옥상', '구역 미지정']);
});

test('날짜별 묶음은 시작 시각 순, 시간 미정은 뒤', () => {
  const map = byDay([w(1, null, null), w(2, '13:00', '14:00'), w(3, '08:00', '09:00')]);
  assert.deepEqual(map['2026-11-16'].map((work) => work.workId), [3, 2, 1]);
});
