// 현장 결재선 화면 규칙. 서버 ApprovalPolicyService 검사와 같게 미리 알려 주는 용도 (최종 판단은 서버)

import { APPROVER_ROLE_LABELS } from './approval-model.js';
import { APPROVAL_TARGET_LABELS } from './home-model.js';

export const MAX_STEPS = 10;
export const MAX_LABEL = 50;
export const DEFAULT_STEP = Object.freeze({ label: '승인', requiredRole: 'APPROVER' });
/** 역할 순서: 뒤 단계는 앞 단계보다 낮을 수 없다 (승인자 → 현장 관리자 → 회사 관리자) */
export const ROLE_ORDER = Object.freeze(['APPROVER', 'SITE_ADMIN', 'ADMIN']);
/** 화면에 보일 문서 순서 (서버는 이름순으로 준다) */
const TARGET_ORDER = ['WORK', 'RISK', 'PERMIT', 'PERMIT_EVENT', 'TBM', 'INSPECTION', 'DAILY_LOG', 'CORRECTIVE_ACTION'];

export const targetLabel = (type) => APPROVAL_TARGET_LABELS[type] ?? type;
export const roleLabel = (role) => APPROVER_ROLE_LABELS[role] ?? role;
const rank = (role) => ROLE_ORDER.indexOf(role);

/** 서버 응답 → 화면 목록. 모르는 값은 버리지 않고 뒤에 붙인다 */
export function normalizeLines(lines) {
  if (!Array.isArray(lines)) return [];
  const known = (type) => { const index = TARGET_ORDER.indexOf(type); return index < 0 ? TARGET_ORDER.length : index; };
  return lines
    .filter((line) => line && typeof line.targetType === 'string')
    .map((line) => ({
      targetType: line.targetType,
      defaultLine: Boolean(line.defaultLine),
      steps: (Array.isArray(line.steps) ? line.steps : []).map((step, index) => ({
        stepNo: Number(step.stepNo) || index + 1, label: String(step.label ?? ''), requiredRole: step.requiredRole,
      })),
    }))
    .sort((a, b) => known(a.targetType) - known(b.targetType));
}

/** 한 줄 요약: "1 승인(승인자) → 2 최종 승인(현장 관리자)" */
export const lineSummary = (steps) => steps.map((step, index) => `${index + 1} ${step.label}(${roleLabel(step.requiredRole)})`).join(' → ');

/**
 * 저장 전 검사. 반환: { errors: { [index]: 메시지 }, message } — 비어 있으면 저장 가능
 * 서버 규칙: 최대 10단계, 이름 1~50자, 역할 필수, 뒤 단계 역할이 앞 단계보다 낮으면 안 됨
 */
export function validateSteps(steps) {
  const errors = {};
  if (!steps.length) return { errors, message: '단계가 하나 이상 있어야 합니다. 기본으로 돌리려면 "기본으로 되돌리기"를 누르세요.' };
  if (steps.length > MAX_STEPS) return { errors, message: `결재 단계는 ${MAX_STEPS}개까지입니다.` };
  steps.forEach((step, index) => {
    const label = step.label.trim();
    if (!label) errors[index] = '단계 이름을 입력하세요.';
    else if (label.length > MAX_LABEL) errors[index] = `단계 이름은 ${MAX_LABEL}자까지입니다.`;
    else if (!ROLE_ORDER.includes(step.requiredRole)) errors[index] = '역할을 고르세요.';
    else if (index > 0 && rank(step.requiredRole) < rank(steps[index - 1].requiredRole)) {
      errors[index] = `앞 단계(${roleLabel(steps[index - 1].requiredRole)})보다 낮은 역할은 고를 수 없습니다.`;
    }
  });
  return { errors, message: Object.keys(errors).length ? '표시된 단계를 고쳐 주세요.' : '' };
}

/** 저장 본문: [{ label, requiredRole }] (순서 = 단계 순서) */
export const stepsBody = (steps) => steps.map((step) => ({ label: step.label.trim(), requiredRole: step.requiredRole }));

/** 편집 중인 단계가 저장된 결재선과 같은지 (바뀐 게 없으면 저장 버튼을 끈다) */
export const sameSteps = (a, b) => a.length === b.length
  && a.every((step, index) => step.label.trim() === b[index].label && step.requiredRole === b[index].requiredRole);

/** 단계 옮기기 (index 를 delta 만큼). 범위를 벗어나면 그대로 */
export function moveStep(steps, index, delta) {
  const to = index + delta;
  if (to < 0 || to >= steps.length) return steps;
  const next = [...steps];
  [next[index], next[to]] = [next[to], next[index]];
  return next;
}

/**
 * 검증 모드 안내: 결재선에 승인자 단계가 없으면, 그 역할의 사람이 올린 문서는 자기 승인이 막혀
 * 더 높은 역할이 결재해야 한다는 점을 알려 준다 (서버: 검증 모드 현장은 자기 문서 승인 금지)
 */
export const verifyModeNote = (steps, mode) => (mode === 'VERIFY' && steps.length > 0 && steps.every((step) => step.requiredRole !== 'APPROVER')
  ? '검증 모드 현장에서는 자기 문서를 승인할 수 없습니다. 이 결재선을 맡을 사람이 한 명뿐이면, 그 사람이 올린 문서는 더 높은 역할이 결재해야 합니다.'
  : '');
