// 개선조치 화면 규칙 (서버 CorrectiveActionService 와 같은 흐름)
export const ACTION_STATUS_LABELS = Object.freeze({
  OPEN: '등록', IN_PROGRESS: '조치 중', DONE: '완료(확인 대기)', VERIFIED: '확인 완료', CANCELED: '취소',
});
export const ACTION_STATUS_TONES = Object.freeze({
  OPEN: 'todo', IN_PROGRESS: 'active', DONE: 'wait', VERIFIED: 'done', CANCELED: 'neutral',
});
export const ACTION_SOURCE_LABELS = Object.freeze({
  NEAR_MISS: '아차사고', INSPECTION: '점검표', RULE_VIOLATION: '규칙 위반', AUDIT: '감사보고서', OTHER: '기타',
});
export const ACTION_FILTERS = Object.freeze([
  { key: 'open', label: '진행 중', statuses: ['OPEN', 'IN_PROGRESS'] },
  { key: 'done', label: '확인 대기', statuses: ['DONE'] },
  { key: 'all', label: '전체', statuses: [] },
]);

const VERIFIERS = new Set(['APPROVER', 'SITE_ADMIN', 'ADMIN']);

/** 출처 기록 화면 주소 (없으면 null) */
export function sourcePath(sourceType, sourceId) {
  if (!Number.isSafeInteger(Number(sourceId)) || Number(sourceId) < 1) return null;
  switch (sourceType) {
    case 'NEAR_MISS': return `/job/incidents?incidentId=${sourceId}`;
    case 'INSPECTION': return `/job/dailey-checklist?inspectionId=${sourceId}`;
    case 'AUDIT': return `/audit-reports/${sourceId}`;
    default: return null;
  }
}

/**
 * 지금 상태에서 누를 수 있는 버튼. 확인·미흡·취소(등록자 제외)는 승인자 이상만.
 * 서버가 최종 판단한다 (검증 모드 담당자 본인 확인 금지 등).
 */
export function actionButtons(action, { role, userId } = {}) {
  if (!action) return [];
  const verifier = VERIFIERS.has(role);
  const canCancel = verifier || (userId != null && action.createdBy === userId);
  const cancel = { step: 'cancel', label: '취소', tone: 'danger', allowsNote: true, noteLabel: '메모(선택)', confirm: '이 개선조치를 취소할까요?', confirmMessage: '취소한 조치는 다시 열 수 없습니다.', done: '개선조치를 취소했습니다.' };
  switch (action.status) {
    case 'OPEN':
      return [{ step: 'start', label: '조치 시작', primary: true, done: '조치를 시작했습니다.' }, ...(canCancel ? [cancel] : [])];
    case 'IN_PROGRESS':
      return [{ step: 'complete', label: '조치 완료', primary: true, needsNote: true, noteLabel: '조치 내용(필수)', noteHint: '조치 내용을 적어 주세요.', done: '조치를 완료했습니다. 확인을 기다립니다.' }, ...(canCancel ? [cancel] : [])];
    case 'DONE':
      return verifier ? [
        { step: 'verify', label: '확인', primary: true, done: '조치를 확인했습니다.' },
        { step: 'reopen', label: '미흡(다시 조치)', allowsNote: true, noteLabel: '미흡 사유', confirm: '다시 조치하게 할까요?', confirmMessage: '완료 기록이 지워지고 조치 중으로 돌아갑니다.', tone: 'warn', done: '다시 조치 중으로 돌렸습니다.' },
      ] : [];
    default:
      return [];
  }
}
