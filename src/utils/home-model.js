// 홈·작업 화면에서 서버 응답을 화면용 값으로 바꾸는 순수 함수 (서버 값만 쓰고 새 상태를 만들지 않는다)
import { jobRecordPath } from './job-forms.js';

export const WORK_TYPE_LABELS = Object.freeze({ GENERAL: '일반', HOT: '화기', CONFINED: '밀폐공간', HEIGHT: '고소' });
export const WORK_STATUS_LABELS = Object.freeze({
  DRAFT: '작성 중', PENDING: '승인 대기', APPROVED: '승인', REJECTED: '반려', BLOCKED: '차단',
  IN_PROGRESS: '진행 중', DONE: '완료', CANCELED: '취소',
});
export const PERMIT_STATUS_LABELS = Object.freeze({
  DRAFT: '작성 중', CHECKING: '판정 중', BLOCKED: '판정 차단', PENDING: '승인 대기', APPROVED: '승인',
  SUSPENDED: '중지', REJECTED: '반려', CLOSED: '종료', SUPERSEDED: '이전 판',
});
export const RISK_STATUS_LABELS = Object.freeze({ DRAFT: '작성 중', PENDING: '승인 대기', APPROVED: '승인', REJECTED: '반려', SUPERSEDED: '이전 판' });
export const RISK_LEVEL_LABELS = Object.freeze({ HIGH: '높음', MEDIUM: '보통', LOW: '낮음' });
export const TBM_STATUS_LABELS = Object.freeze({ DRAFT: '작성 중', DONE: '완료', APPROVED: '승인' });
export const APPROVAL_TARGET_LABELS = Object.freeze({
  WORK: '작업', RISK: '위험성평가', PERMIT: '작업허가', PERMIT_EVENT: '허가 변경', INSPECTION: '점검표',
  TBM: 'TBM', DAILY_LOG: '안전일지', CORRECTIVE_ACTION: '개선조치',
});

/** 상태 → 배지 톤 (색만으로 구분하지 않도록 글자와 같이 쓴다) */
export function toneOf(status) {
  if (['APPROVED', 'DONE', 'CLOSED'].includes(status)) return 'done';
  if (['BLOCKED', 'REJECTED', 'SUSPENDED'].includes(status)) return 'block';
  if (status === 'PENDING') return 'wait';
  if (['DRAFT', 'CHECKING'].includes(status)) return 'todo';
  if (status === 'IN_PROGRESS') return 'active';
  return 'neutral';
}

// 대시보드 미완료 항목 (서버 IncompleteType 순서·이름 그대로, 화면 순서만 정한다)
export const TODO_TYPES = Object.freeze([
  { type: 'MEASUREMENT_MISSING', label: '측정값 미입력', path: '/job/permits' },
  { type: 'TBM_MISSING', label: 'TBM 미실시', path: '/job/tbm' },
  { type: 'PHOTO_MISSING', label: '사진 미첨부', path: '/job/tbm' },
  { type: 'APPROVAL_OVERDUE', label: '승인 지연', path: '/approvals' },
  { type: 'INSPECTION_DRAFT', label: '점검 미제출', path: '/job/dailey-checklist' },
  { type: 'INSPECTION_PENDING', label: '점검 승인 대기', path: '/approvals' },
  { type: 'DAILY_LOG_MISSING', label: '안전일지 미작성', path: '/job/daily-safety' },
  { type: 'CORRECTIVE_OPEN', label: '개선조치 미완료', path: '/records/search' },
  { type: 'SIGNATURE_MISSING', label: '서명 미완료', path: '/approvals' },
]);

/** 대시보드 items → 할 일 칸 (없는 종류는 0건으로 채워 자리를 고정한다) */
export function todoTiles(items = []) {
  const byType = new Map(items.map((item) => [item.type, item]));
  return TODO_TYPES.map(({ type, label, path }) => {
    const item = byType.get(type);
    const first = item?.entries?.[0];
    const target = first ? jobRecordPath(first.targetType, first.targetId) : null;
    // 안전일지는 값이 "미작성"으로 보이므로 이름은 "안전일지"만 (같은 말 두 번 안 보이게)
    const name = type === 'DAILY_LOG_MISSING' ? '안전일지' : null;
    return { type, label: name ?? label, fullLabel: name ?? (item?.label || label), count: item?.count ?? 0, overdue: Boolean(item?.overdue), path: target ?? path, entries: item?.entries ?? [] };
  });
}

export const todoTotal = (tiles) => tiles.reduce((sum, tile) => sum + tile.count, 0);

/**
 * 칸에 보일 값. 안전일지는 현장·날짜마다 한 건이라(작업·허가 수와 무관) 숫자 대신 "미작성"으로 보인다.
 * 0 은 그날 작업이 없거나 이미 작성한 경우.
 */
export function tileValue(tile) {
  if (tile.type === 'DAILY_LOG_MISSING') return tile.count ? { text: '미작성', unit: '', word: true } : { text: '없음', unit: '', word: true };
  return { text: String(tile.count), unit: '건' };
}

const latestPermits = (work) => (work.permits ?? []).filter((permit) => permit.status !== 'SUPERSEDED');

/**
 * 작업 하나의 단계 (작업 → 위험성평가 → 허가 → TBM → 승인 → 종료).
 * 점검표는 작업과 직접 연결된 서버 값이 없어 작업 단계에서 빼고 현장 할 일(점검 미제출)로 보인다.
 * state: done | current | problem | todo | skip(해당 없음)
 */
export function workStages(work) {
  const risk = work.riskAssessment;
  const permits = latestPermits(work);
  const needsPermit = work.workType && work.workType !== 'GENERAL';
  const riskState = !risk ? 'todo' : risk.status === 'APPROVED' ? 'done' : risk.status === 'REJECTED' ? 'problem' : 'current';
  let permitState = 'todo';
  let permitHint = needsPermit ? '작성 전' : '해당 없음';
  // 일반 작업은 허가가 필요 없다: 완료가 아니라 "해당 없음"(skip)으로 따로 보인다
  if (!needsPermit && !permits.length) permitState = 'skip';
  if (permits.length) {
    if (permits.every((permit) => ['APPROVED', 'CLOSED'].includes(permit.status))) permitState = 'done';
    else if (permits.some((permit) => ['BLOCKED', 'REJECTED', 'SUSPENDED'].includes(permit.status))) permitState = 'problem';
    else permitState = 'current';
    const worst = permits.find((permit) => toneOf(permit.status) === 'block') ?? permits.find((permit) => permit.status !== 'APPROVED') ?? permits[0];
    permitHint = PERMIT_STATUS_LABELS[worst.status] ?? worst.status;
  }
  const tbm = work.tbm;
  const tbmState = !tbm ? 'todo' : tbm.status === 'DRAFT' ? 'current' : 'done';
  const approvalState = ['APPROVED', 'IN_PROGRESS', 'DONE'].includes(work.status) ? 'done'
    : work.status === 'PENDING' ? 'current' : work.status === 'REJECTED' ? 'problem' : 'todo';
  const endState = work.status === 'DONE' ? 'done' : work.status === 'IN_PROGRESS' ? 'current' : 'todo';
  return [
    { key: 'work', label: '작업', state: work.status === 'BLOCKED' ? 'problem' : 'done', hint: WORK_STATUS_LABELS[work.status] ?? '' },
    { key: 'risk', label: '위험성평가', state: riskState, hint: risk ? RISK_STATUS_LABELS[risk.status] : '작성 전' },
    { key: 'permit', label: '허가', state: permitState, hint: permitHint },
    { key: 'tbm', label: 'TBM', state: tbmState, hint: tbm ? TBM_STATUS_LABELS[tbm.status] : '작성 전' },
    { key: 'approval', label: '승인', state: approvalState, hint: approvalState === 'done' ? '승인' : approvalState === 'current' ? '승인 대기' : approvalState === 'problem' ? '반려' : '' },
    { key: 'end', label: '종료', state: endState, hint: endState === 'done' ? '완료' : endState === 'current' ? '진행 중' : '' },
  ];
}

/** 작업의 "지금 할 일" 하나 (서버 상태값으로만 정한다) */
export function nextAction(work) {
  const risk = work.riskAssessment;
  const permits = latestPermits(work);
  const blocked = permits.find((permit) => permit.status === 'BLOCKED');
  if (blocked) return { label: '허가 판정 차단 확인', tone: 'block', path: jobRecordPath('PERMIT', blocked.permitId) };
  if (!risk) return { label: '위험성평가 작성', tone: 'todo', path: `/job/risk-assessment?workId=${work.workId}` };
  if (['DRAFT', 'REJECTED'].includes(risk.status)) return { label: risk.status === 'REJECTED' ? '위험성평가 반려 수정' : '위험성평가 승인 요청', tone: risk.status === 'REJECTED' ? 'block' : 'todo', path: jobRecordPath('RISK', risk.riskAssessmentId) };
  if (work.workType !== 'GENERAL' && !permits.length) return { label: '작업허가 작성', tone: 'todo', path: `/job/permits?workId=${work.workId}` };
  const draft = permits.find((permit) => ['DRAFT', 'CHECKING', 'REJECTED'].includes(permit.status));
  if (draft) return { label: draft.status === 'REJECTED' ? '허가 반려 수정' : '허가 측정·판정', tone: draft.status === 'REJECTED' ? 'block' : 'todo', path: jobRecordPath('PERMIT', draft.permitId) };
  if (!work.tbm) return { label: 'TBM 작성', tone: 'todo', path: `/job/tbm?date=${encodeURIComponent(work.workDate ?? '')}&workId=${work.workId}` };
  if (work.tbm.status === 'DRAFT') return { label: 'TBM 완료 처리', tone: 'todo', path: jobRecordPath('TBM', work.tbm.tbmId) };
  if (risk.status === 'PENDING' || permits.some((permit) => permit.status === 'PENDING') || work.status === 'PENDING') return { label: '승인 대기', tone: 'wait', path: null };
  if (work.status === 'DONE') return { label: '완료', tone: 'done', path: null };
  return { label: '진행 중', tone: 'active', path: null };
}

/** 작업 종류별 건수 (막대용). 0건 종류도 자리를 둔다 */
export function typeCounts(works = []) {
  const counts = Object.fromEntries(Object.keys(WORK_TYPE_LABELS).map((type) => [type, 0]));
  works.forEach((work) => { if (work.workType in counts) counts[work.workType] += 1; });
  return Object.entries(counts).map(([type, count]) => ({ type, label: WORK_TYPE_LABELS[type], count }));
}

/** 경고 목록: 차단된 작업 → 기한 지난 할 일 → 오늘 고위험 작업 */
export function alertsOf(dashboard, works = []) {
  const alerts = [];
  works.filter((work) => work.status === 'BLOCKED' || latestPermits(work).some((permit) => permit.status === 'BLOCKED'))
    .forEach((work) => alerts.push({ key: `block-${work.workId}`, tone: 'block', title: work.title, detail: '규칙 판정 차단', path: `/job/workspace?workId=${work.workId}` }));
  (dashboard?.items ?? []).filter((item) => item.overdue && item.count > 0)
    .forEach((item) => alerts.push({ key: `due-${item.type}`, tone: 'warn', title: item.label, detail: `기한 지남 ${item.count}건`, path: TODO_TYPES.find((t) => t.type === item.type)?.path ?? null }));
  works.filter((work) => work.highRisk && work.status !== 'DONE' && !alerts.some((alert) => alert.key === `block-${work.workId}`))
    .forEach((work) => alerts.push({ key: `risk-${work.workId}`, tone: 'info', title: work.title, detail: `고위험 · ${WORK_TYPE_LABELS[work.workType] ?? ''}`, path: `/job/workspace?workId=${work.workId}` }));
  return alerts;
}

/** "14:00~17:00" 형태 (서버 LocalDateTime 문자열에서 시:분만) */
export function timeRange(startAt, endAt) {
  const hm = (value) => (typeof value === 'string' && value.length >= 16 ? value.slice(11, 16) : '');
  const [start, end] = [hm(startAt), hm(endAt)];
  return start || end ? `${start || '?'}~${end || '?'}` : '';
}

/** 오늘 날짜 yyyy-mm-dd (브라우저 현지 시각) */
export function localDate(now = new Date()) {
  const pad = (value) => String(value).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** AI 작업 등록 결과에서 만든 초안 목록 (result.saved 그대로) */
export function draftDocs(saved) {
  if (!saved) return [];
  const docs = [{ key: 'WORK', type: 'WORK', id: saved.workId, label: '작업' }];
  if (saved.riskAssessmentId) docs.push({ key: 'RISK', type: 'RISK', id: saved.riskAssessmentId, label: '위험성평가' });
  (saved.permits ?? []).forEach((permit) => docs.push({ key: `PERMIT-${permit.permitId}`, type: 'PERMIT', id: permit.permitId, label: `${WORK_TYPE_LABELS[permit.permitType] ?? ''} 허가`.trim(), permitType: permit.permitType }));
  if (saved.tbmId) docs.push({ key: 'TBM', type: 'TBM', id: saved.tbmId, label: 'TBM' });
  return docs;
}

/** 초안 문서 하나의 남은 일 (문서를 불러온 뒤 그 상태로 판단) */
export function draftRemaining(doc, record) {
  if (!record) return { done: false, label: '불러오는 중' };
  if (doc.type === 'WORK') return { done: record.zoneId != null, label: record.zoneId != null ? '확인' : '구역 확인 필요' };
  if (doc.type === 'RISK') return { done: record.status !== 'DRAFT' && record.status !== 'REJECTED', label: RISK_STATUS_LABELS[record.status] };
  if (doc.type === 'PERMIT') {
    if (!['DRAFT', 'CHECKING', 'BLOCKED'].includes(record.status)) return { done: true, label: PERMIT_STATUS_LABELS[record.status] };
    if (record.status === 'BLOCKED') return { done: false, label: '판정 차단' };
    return { done: false, label: record.lastEvaluation ? (record.canSubmit ? '승인 요청 가능' : '판정 확인') : '측정·판정' };
  }
  if (doc.type === 'TBM') return { done: record.status !== 'DRAFT', label: TBM_STATUS_LABELS[record.status] };
  return { done: false, label: '' };
}
