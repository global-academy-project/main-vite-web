import assert from 'node:assert/strict';
import test from 'node:test';
import { bottomTabsFor, effectiveRole, homePathFor, isActivePath, navFor, NAV } from './nav-config.js';

const keys = (items) => items.map((item) => item.key);

test('역할별 메뉴: 작성자는 분석·현장 설정·관리·승인함이 없다', () => {
  assert.deepEqual(keys(navFor('MEMBER', 'WRITER')), ['home', 'work', 'records']);
});

test('승인자는 승인함이 보인다', () => {
  assert.deepEqual(keys(navFor('MEMBER', 'APPROVER')), ['home', 'work', 'approvals', 'records']);
});

test('현장 관리자는 현장 설정까지, 관리는 없다', () => {
  assert.deepEqual(keys(navFor('MEMBER', 'SITE_ADMIN')), ['home', 'work', 'approvals', 'records', 'site']);
});

test('계정 ADMIN 은 현장 역할과 상관없이 전부', () => {
  assert.deepEqual(keys(navFor('ADMIN', 'WRITER')), keys(NAV));
  assert.equal(effectiveRole('ADMIN', null), 'ADMIN');
});

test('현장 역할을 모르면 공통 메뉴만, 현장 역할로 ADMIN 이 와도 계정 ADMIN 이 아니면 인정하지 않는다', () => {
  assert.deepEqual(keys(navFor('MEMBER', null)), ['home', 'work', 'records']);
  assert.equal(effectiveRole('MEMBER', 'ADMIN'), null);
});

test('첫 화면: 승인자는 승인함, 나머지는 홈', () => {
  assert.equal(homePathFor('MEMBER', 'APPROVER'), '/approvals');
  assert.equal(homePathFor('MEMBER', 'WRITER'), '/dashboard');
  assert.equal(homePathFor('ADMIN', 'APPROVER'), '/dashboard');
});

test('현재 경로 표시: 하위 경로와 상세 경로도 그 메뉴로 본다', () => {
  const work = NAV.find((item) => item.key === 'work');
  const approvals = NAV.find((item) => item.key === 'approvals');
  const records = NAV.find((item) => item.key === 'records');
  assert.equal(isActivePath(work, '/job/permits'), true);
  assert.equal(isActivePath(approvals, '/approvals/12/result'), true);
  assert.equal(isActivePath(records, '/records/PERMIT/3'), true);
  assert.equal(isActivePath(work, '/dashboard'), false);
});

test('하단 탭: 작성자 3개 + 더보기, 승인자 4개 + 더보기', () => {
  assert.deepEqual(keys(bottomTabsFor('MEMBER', 'WRITER')), ['home', 'work', 'records']);
  assert.deepEqual(keys(bottomTabsFor('MEMBER', 'APPROVER')), ['home', 'work', 'approvals', 'records']);
});
