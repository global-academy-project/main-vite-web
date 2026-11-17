import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lineSummary, moveStep, normalizeLines, sameSteps, stepsBody, validateSteps, verifyModeNote } from './approval-line-model.js';

test('서버 응답을 화면 순서로 정리하고 모르는 종류도 남긴다', () => {
  const lines = normalizeLines([
    { targetType: 'TBM', defaultLine: true, steps: [{ stepNo: 1, label: '승인', requiredRole: 'APPROVER' }] },
    { targetType: 'NEW_KIND', defaultLine: true, steps: [] },
    { targetType: 'WORK', defaultLine: false, steps: [{ stepNo: 1, label: '확인', requiredRole: 'APPROVER' }, { stepNo: 2, label: '최종', requiredRole: 'SITE_ADMIN' }] },
    null,
  ]);
  assert.deepEqual(lines.map((line) => line.targetType), ['WORK', 'TBM', 'NEW_KIND']);
  assert.equal(lines[0].defaultLine, false);
  assert.equal(normalizeLines(undefined).length, 0);
});

test('요약 문구', () => {
  assert.equal(lineSummary([{ label: '확인', requiredRole: 'APPROVER' }, { label: '최종', requiredRole: 'SITE_ADMIN' }]), '1 확인(승인자) → 2 최종(현장 관리자)');
});

test('서버와 같은 검사: 빈 목록·10단계 초과·이름·역할 순서', () => {
  assert.ok(validateSteps([]).message);
  assert.ok(validateSteps(Array.from({ length: 11 }, () => ({ label: 'a', requiredRole: 'APPROVER' }))).message);
  assert.equal(validateSteps([{ label: '  ', requiredRole: 'APPROVER' }]).errors[0], '단계 이름을 입력하세요.');
  assert.ok(validateSteps([{ label: 'x'.repeat(51), requiredRole: 'APPROVER' }]).errors[0]);
  assert.ok(validateSteps([{ label: 'a', requiredRole: 'SITE_ADMIN' }, { label: 'b', requiredRole: 'APPROVER' }]).errors[1]);
  const ok = validateSteps([{ label: 'a', requiredRole: 'APPROVER' }, { label: 'b', requiredRole: 'APPROVER' }, { label: 'c', requiredRole: 'ADMIN' }]);
  assert.deepEqual(ok, { errors: {}, message: '' });
});

test('저장 본문은 이름 앞뒤 공백을 지우고 순서를 지킨다', () => {
  assert.deepEqual(stepsBody([{ stepNo: 1, label: ' 확인 ', requiredRole: 'APPROVER' }]), [{ label: '확인', requiredRole: 'APPROVER' }]);
});

test('같은지 비교 · 옮기기', () => {
  const saved = [{ label: '확인', requiredRole: 'APPROVER' }, { label: '최종', requiredRole: 'SITE_ADMIN' }];
  assert.equal(sameSteps([{ label: '확인 ', requiredRole: 'APPROVER' }, { label: '최종', requiredRole: 'SITE_ADMIN' }], saved), true);
  assert.equal(sameSteps(saved.slice(0, 1), saved), false);
  assert.deepEqual(moveStep(saved, 0, 1).map((s) => s.label), ['최종', '확인']);
  assert.equal(moveStep(saved, 0, -1), saved);
});

test('검증 모드 안내는 승인자 단계가 없을 때만', () => {
  assert.ok(verifyModeNote([{ label: 'a', requiredRole: 'SITE_ADMIN' }], 'VERIFY'));
  assert.equal(verifyModeNote([{ label: 'a', requiredRole: 'SITE_ADMIN' }], 'GUIDE'), '');
  assert.equal(verifyModeNote([{ label: 'a', requiredRole: 'APPROVER' }], 'VERIFY'), '');
});
