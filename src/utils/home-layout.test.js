import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_LAYOUT, isCustomLayout, moveTop, readLayout, sanitizeLayout, swapTop, writeLayout } from './home-layout.js';

const memory = () => { const data = {}; return { getItem: (k) => data[k] ?? null, setItem: (k, v) => { data[k] = v; } }; };

test('망가진 값은 기본 배치로', () => {
  assert.deepEqual(sanitizeLayout(null), { ...DEFAULT_LAYOUT, top: [...DEFAULT_LAYOUT.top], mobileOpen: { ...DEFAULT_LAYOUT.mobileOpen } });
  assert.deepEqual(sanitizeLayout({ top: ['todo', 'todo', 'side'], aiWidth: 'x' }).top, ['status', 'todo', 'side']);
  assert.equal(sanitizeLayout({ aiWidth: 9999 }).aiWidth, 1600);
  assert.equal(sanitizeLayout({ aiWidth: 10 }).aiWidth, 300);
});

test('사용자별로 저장·복원', () => {
  const storage = memory();
  writeLayout(storage, 7, { ...DEFAULT_LAYOUT, top: ['todo', 'status', 'side'], aiFolded: true });
  assert.deepEqual(readLayout(storage, 7).top, ['todo', 'status', 'side']);
  assert.equal(readLayout(storage, 8).aiFolded, false);
});

test('저장소가 막혀도 동작', () => {
  const broken = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
  assert.equal(readLayout(broken, 1).aiWidth, 380);
  assert.equal(writeLayout(broken, 1, DEFAULT_LAYOUT), false);
});

test('바꾼 배치만 기본 배치로 버튼 대상', () => {
  assert.equal(isCustomLayout(sanitizeLayout(null)), false);
  assert.equal(isCustomLayout({ ...sanitizeLayout(null), view: 'month' }), false);
  assert.equal(isCustomLayout({ ...sanitizeLayout(null), aiFolded: true }), true);
});

test('AI 최대 폭은 화면 폭 − 일정 최소 폭', async () => {
  const { aiMaxWidth } = await import('./home-layout.js');
  assert.equal(aiMaxWidth(1100), 528);
  assert.equal(aiMaxWidth(1600), 1028);
  assert.equal(aiMaxWidth(700), 300);
});

test('모바일은 처음에 AI 도우미만 펼침, 접은 카드는 배치 변경으로 치지 않음', () => {
  const layout = sanitizeLayout(null);
  assert.deepEqual(layout.mobileOpen, { ai: true, todo: false, status: false, side: false, schedule: false });
  assert.equal(sanitizeLayout({ mobileOpen: { todo: true, ai: 'x' } }).mobileOpen.todo, true);
  assert.equal(sanitizeLayout({ mobileOpen: { todo: true, ai: 'x' } }).mobileOpen.ai, true);
  assert.equal(isCustomLayout({ ...layout, mobileOpen: { ...layout.mobileOpen, ai: false } }), false);
});

test('칸 옮기기', () => {
  assert.deepEqual(swapTop(['status', 'todo', 'side'], 'status', 'side'), ['side', 'todo', 'status']);
  assert.deepEqual(moveTop(['status', 'todo', 'side'], 'todo', 1), ['status', 'side', 'todo']);
  assert.deepEqual(moveTop(['status', 'todo', 'side'], 'status', -1), ['status', 'todo', 'side']);
});
