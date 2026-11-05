// 작업 목록 화면의 검색 조건·건수 (서버 목록 응답 WorkListItem 만 쓴다)
import { nextAction } from './home-model.js';

/** 검색 조건: 종류(여러 개), 상태, 제목 검색, "지금 할 일 있음"만 */
export function filterWorks(works = [], { types = [], status = '', query = '', actionOnly = false } = {}) {
  const q = query.trim().toLowerCase();
  return works.filter((work) => {
    if (types.length && !types.includes(work.workType)) return false;
    if (status && work.status !== status) return false;
    if (q && !String(work.title ?? '').toLowerCase().includes(q)) return false;
    if (actionOnly && !nextAction(work).path) return false;
    return true;
  });
}

/** 위 숫자 카드: 전체 / 차단 / 승인 대기 / 작성 중 / 진행 중 / 완료 */
export function workStats(works = []) {
  const count = (status) => works.filter((work) => work.status === status).length;
  const blocked = works.filter((work) => work.status === 'BLOCKED' || (work.permits ?? []).some((permit) => permit.status === 'BLOCKED')).length;
  return [
    { key: 'ALL', label: '전체', value: works.length, tone: 'neutral' },
    { key: 'BLOCKED', label: '차단', value: blocked, tone: 'block' },
    { key: 'PENDING', label: '승인 대기', value: count('PENDING'), tone: 'wait' },
    { key: 'DRAFT', label: '작성 중', value: count('DRAFT'), tone: 'todo' },
    { key: 'IN_PROGRESS', label: '진행 중', value: count('IN_PROGRESS'), tone: 'active' },
    { key: 'DONE', label: '완료', value: count('DONE'), tone: 'done' },
  ];
}

/** 날짜순(최근 먼저), 같은 날은 시작 시각순 */
export function sortWorks(works = []) {
  return [...works].sort((a, b) => String(b.workDate).localeCompare(String(a.workDate))
    || String(a.startAt ?? '').localeCompare(String(b.startAt ?? '')));
}

/** 작업 허브의 문서 카드 목록 (목록 응답의 요약 정보로 만든다) */
export function hubDocs(work) {
  if (!work) return [];
  const docs = [];
  docs.push(work.riskAssessment
    ? { key: `RISK-${work.riskAssessment.riskAssessmentId}`, type: 'RISK', id: work.riskAssessment.riskAssessmentId, label: '위험성평가', status: work.riskAssessment.status }
    : { key: 'RISK-new', type: 'RISK', id: null, label: '위험성평가', createPath: `/job/risk-assessment?workId=${work.workId}` });
  const permits = (work.permits ?? []).filter((permit) => permit.status !== 'SUPERSEDED');
  permits.forEach((permit) => docs.push({ key: `PERMIT-${permit.permitId}`, type: 'PERMIT', id: permit.permitId, label: `${({ HOT: '화기', CONFINED: '밀폐공간', HEIGHT: '고소' })[permit.permitType] ?? ''} 작업허가`.trim(), status: permit.status, permitNo: permit.permitNo }));
  if (work.workType !== 'GENERAL' && !permits.length) docs.push({ key: 'PERMIT-new', type: 'PERMIT', id: null, label: '작업허가', createPath: `/job/permits?workId=${work.workId}` });
  docs.push(work.tbm
    ? { key: `TBM-${work.tbm.tbmId}`, type: 'TBM', id: work.tbm.tbmId, label: 'TBM', status: work.tbm.status }
    : { key: 'TBM-new', type: 'TBM', id: null, label: 'TBM', createPath: `/job/tbm?date=${encodeURIComponent(work.workDate ?? '')}` });
  return docs;
}

/** 주소의 doc=PERMIT-31 → { type, id } (잘못된 값이면 null) */
export function parseDocParam(value) {
  const match = /^(RISK|PERMIT|TBM|WORK)-(\d+)$/.exec(String(value ?? ''));
  if (!match) return null;
  const id = Number(match[2]);
  return Number.isSafeInteger(id) && id > 0 ? { type: match[1], id, key: `${match[1]}-${id}` } : null;
}

/**
 * 작업 허브에서 다른 화면(위험성평가·허가·TBM)으로 갈 때 back=작업번호 를 붙인다.
 * 그 화면 머리에 "작업 허브로" 버튼이 생겨 바로 돌아올 수 있다. 경로가 없으면 그대로 둔다.
 */
export function withBack(path, workId) {
  if (!path || !/^\d+$/.test(String(workId ?? ''))) return path;
  return `${path}${path.includes('?') ? '&' : '?'}back=${workId}`;
}

/** 주소의 back 값 → 돌아갈 작업 허브 경로 (숫자가 아니면 null) */
export function backToHubPath(value) {
  return /^\d{1,12}$/.test(value ?? '') ? `/job/workspace?workId=${value}` : null;
}
