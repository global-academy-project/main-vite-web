// 안전일지 화면 계산 (React 없이 테스트할 수 있게 분리)

export const DAILY_LOG_STATUS_LABELS = Object.freeze({ DRAFT: '작성 중', PENDING: '승인 대기', APPROVED: '승인 완료', REJECTED: '반려됨' });
export const DAILY_LOG_TONES = Object.freeze({ DRAFT: 'todo', PENDING: 'wait', APPROVED: 'done', REJECTED: 'block' });
// 서버 권한 판단과 별개로, 화면에서 "검토 보기"를 먼저 보일 역할 (기존 화면과 같음)
export const DAILY_LOG_APPROVER_ROLES = Object.freeze(['APPROVER', 'SITE_ADMIN', 'ADMIN']);

/** 일지 진행 단계: 초안 만들기 → 요약 작성 → 승인 요청 → 승인 */
export function dailyLogSteps(log) {
  const status = log?.status;
  const state = (done, current, problem) => (problem ? 'problem' : done ? 'done' : current ? 'current' : 'todo');
  return [
    { key: 'draft', label: '초안 만들기', state: log ? 'done' : 'current', hint: log ? '서버 집계' : '시작 전' },
    { key: 'summary', label: '요약 작성', state: state(['PENDING', 'APPROVED'].includes(status), status === 'DRAFT' || status === 'REJECTED'), hint: status === 'DRAFT' ? '작성 중' : status === 'REJECTED' ? '반려 · 수정' : '' },
    { key: 'submit', label: '승인 요청', state: state(['PENDING', 'APPROVED'].includes(status), false), hint: status === 'PENDING' ? '요청함' : '' },
    { key: 'approve', label: '승인', state: state(status === 'APPROVED', status === 'PENDING', status === 'REJECTED'), hint: status === 'APPROVED' ? '완료' : status === 'PENDING' ? '대기' : status === 'REJECTED' ? '반려' : '' },
  ];
}

const pad = (value) => String(value).padStart(2, '0');
/** YYYY-MM-DD 에 n일 더하기 (잘못된 값이면 그대로) */
export function shiftDate(value, days) {
  const [y, m, d] = String(value ?? '').split('-').map(Number);
  if (!y || !m || !d) return value;
  const date = new Date(y, m - 1, d + days);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** 마감 표시: { text, passed } 또는 null */
export function deadlineOf(dashboard) {
  const deadline = dashboard?.deadlines?.dailyLogDeadline;
  if (!deadline) return null;
  const passed = Boolean(dashboard.deadlines.dailyLogPassed);
  return { passed, text: passed ? '안전일지 마감 지남' : `안전일지 마감 ${deadline.slice(11, 16)}` };
}

/** 확인 필요 항목 합계 */
export const checksTotal = (checks = []) => checks.reduce((sum, item) => sum + (Number(item.count) || 0), 0);

/** 팀 행의 값 (서버 필드 이름이 두 가지라 둘 다 받는다 — 기존 화면과 같음) */
export function teamRow(team, index) {
  return {
    key: team.teamId ?? team.name ?? index,
    name: team.teamName || team.name || '팀 미지정',
    status: team.dailyLogStatus || team.status || '',
    signatures: team.signatures ?? team.signatureMissing ?? '-',
    measurements: team.measurements ?? team.measurementMissing ?? '-',
    photos: team.photos ?? team.photoMissing ?? '-',
  };
}
