import assert from 'node:assert/strict';
import test from 'node:test';
import { BREAKPOINTS, breakpointOf } from './breakpoints.js';

test('분기점은 모바일 640, 태블릿 1024', () => {
  assert.deepEqual({ ...BREAKPOINTS }, { mobile: 640, tablet: 1024 });
});

test('너비별 구간: 경계값은 작은 쪽에 포함', () => {
  assert.equal(breakpointOf(390), 'mobile');
  assert.equal(breakpointOf(640), 'mobile');
  assert.equal(breakpointOf(641), 'tablet');
  assert.equal(breakpointOf(768), 'tablet');
  assert.equal(breakpointOf(1024), 'tablet');
  assert.equal(breakpointOf(1025), 'desktop');
  assert.equal(breakpointOf(1280), 'desktop');
});

test('숫자가 아니면 PC 로 본다', () => {
  assert.equal(breakpointOf(undefined), 'desktop');
  assert.equal(breakpointOf(Number.NaN), 'desktop');
});
