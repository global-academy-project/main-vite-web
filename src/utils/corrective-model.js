// 개선조치 화면 규칙 (서버 CorrectiveActionService 와 같은 흐름)
export const ACTION_STATUS_LABELS = Object.freeze({
  OPEN: '등록', IN_PROGRESS: '조치 중', DONE: '완료(확인 대기)', VERIFIED: '확인 완료', CANCELED: '취소',
});
export const ACTION_STATUS_TONES = Object.freeze({
  OPEN: 'todo', IN_PROGRESS: 'active', DONE: 'wait', VERIFIED: 'done', CANCELED: 'neutral',
});
export const ACTION_SOURCE_LABELS = Object.freeze({
  NEAR_MISS: '아차사고', INSPECTION: '점검표', RULE_VIOLATION: '규칙 위반', AUDIT: '감사 대응 보고서', OTHER: '기타',
});
/**
 * 목록 위 건수 카드 (아차사고 목록과 같은 모양). 서버는 현장의 개선조치를 전부 주므로 화면에서 센다.
 *  - open: 등록·조치 중 / done: 완료(확인 대기) / overdue: 끝나지 않았는데 기한 지남(서버 overdue) / all: 전체
 */
export const ACTION_FILTERS = Object.freeze([
  { key: 'open', label: '진행 중', statuses: ['OPEN', 'IN_PROGRESS'], tone: 'wait', note: '등록·조치 중' },
  { key: 'done', label: '확인 대기', statuses: ['DONE'], tone: 'todo', note: '승인자 확인 필요' },
  { key: 'overdue', label: '기한 지남', statuses: [], tone: 'block', note: '끝나지 않은 조치' },
  { key: 'all', label: '전체', statuses: [], tone: 'neutral', note: '취소·확인 완료 포함' },
]);

/** 건수 카드 하나에 들어가는 개선조치인가 */
export function matchesActionFilter(action, key) {
  if (!action) return false;
  if (key === 'overdue') return Boolean(action.overdue);
  const filter = ACTION_FILTERS.find((item) => item.key === key);
  if (!filter || !filter.statuses.length) return true;
  return filter.statuses.includes(action.status);
}

/** 카드별 건수 { open, done, overdue, all } */
export function actionStats(actions = []) {
  return Object.fromEntries(ACTION_FILTERS.map((item) => [item.key, actions.filter((action) => matchesActionFilter(action, item.key)).length]));
}

/** 카드와 검색어(제목·내용·담당자 이름)로 거르기 */
export function filterActions(actions = [], { view = 'open', keyword = '' } = {}) {
  const word = keyword.trim().toLowerCase();
  return actions.filter((action) => matchesActionFilter(action, view)
    && (!word || [action.title, action.description, action.assigneeName].some((text) => String(text ?? '').toLowerCase().includes(word))));
}

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
  const cancel = { step: 'cancel', label: '개선조치 취소', tone: 'danger', allowsNote: true, noteLabel: '메모', confirm: '이 개선조치를 취소할까요?', confirmMessage: '취소한 조치는 다시 열 수 없습니다.', done: '개선조치를 취소했습니다.' };
  switch (action.status) {
    case 'OPEN':
      return [{ step: 'start', label: '조치 시작', primary: true, done: '조치를 시작했습니다.' }, ...(canCancel ? [cancel] : [])];
    case 'IN_PROGRESS':
      return [{ step: 'complete', label: '조치 완료', primary: true, needsNote: true, noteLabel: '조치 내용', noteHint: '조치 내용을 적어 주세요.', done: '조치를 완료했습니다. 확인을 기다립니다.' }, ...(canCancel ? [cancel] : [])];
    case 'DONE':
      return verifier ? [
        { step: 'verify', label: '확인', primary: true, done: '조치를 확인했습니다.' },
        { step: 'reopen', label: '미흡(다시 조치)', allowsNote: true, noteLabel: '미흡 사유', confirm: '다시 조치하게 할까요?', confirmMessage: '완료 기록이 지워지고 조치 중으로 돌아갑니다.', tone: 'warn', done: '다시 조치 중으로 돌렸습니다.' },
      ] : [];
    default:
      return [];
  }
}
