// 관리 화면 계산 (서버 응답만 쓴다)
import { userStatuses } from '../api/admin.js';

export const ACCOUNT_ROLE_LABELS = Object.freeze({ ADMIN: '회사 관리자', MEMBER: '일반 회원' });
export const SITE_ROLE_OPTIONS = Object.freeze([
  { value: '', label: '권한 없음' }, { value: 'WRITER', label: '작성자' }, { value: 'APPROVER', label: '승인자' }, { value: 'SITE_ADMIN', label: '현장 관리자' },
]);
export const STATUS_TONES = Object.freeze({ PENDING: 'wait', ACTIVE: 'done', LOCKED: 'block', INACTIVE: 'neutral' });
export const STATUS_FILTERS = Object.freeze([{ value: '', label: '전체' }, ...Object.entries(userStatuses).map(([value, label]) => ({ value, label }))]);

/** 상태별 인원 { '': 전체, PENDING: n, ... } */
export function statusCounts(members) {
  const counts = { '': members.length };
  for (const key of Object.keys(userStatuses)) counts[key] = members.filter((member) => member.status === key).length;
  return counts;
}

/** 상태·검색어로 고르고, 승인 대기 → 잠김 → 사용 중 → 사용 중지, 그 안에서는 이름 순 */
export function visibleMembers(members, { status = '', query = '' } = {}) {
  const text = query.trim().toLocaleLowerCase('ko-KR');
  const order = ['PENDING', 'LOCKED', 'ACTIVE', 'INACTIVE'];
  return members
    .filter((member) => !status || member.status === status)
    .filter((member) => !text || `${member.name} ${member.email} ${member.department ?? ''}`.toLocaleLowerCase('ko-KR').includes(text))
    .sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status) || a.name.localeCompare(b.name, 'ko-KR'));
}

/** 회원의 현장 권한 → { siteId: role } (회사 관리자 표시용 ADMIN 은 뺀다) */
export const grantMap = (member) => Object.fromEntries((member?.sites ?? []).filter((site) => site.role !== 'ADMIN').map((site) => [site.siteId, site.role]));

/** 화면 권한 → 서버 본문 [{ siteId, role }] */
export const grantList = (map) => Object.entries(map).filter(([, role]) => role).map(([siteId, role]) => ({ siteId: Number(siteId), role }));

/** 권한을 줄 수 있는 현장: 사용 중인 현장 + 이미 권한이 있는 현장 */
export function grantableSites(sites, member) {
  const granted = new Set((member?.sites ?? []).map((site) => site.siteId));
  const list = sites.filter((site) => site.active || granted.has(site.siteId));
  for (const site of member?.sites ?? []) if (!list.some((entry) => entry.siteId === site.siteId)) list.push({ siteId: site.siteId, name: site.name ?? `현장 #${site.siteId}`, active: true });
  return list;
}

export const sameGrants = (a, b) => JSON.stringify(Object.entries(a).filter(([, v]) => v).sort()) === JSON.stringify(Object.entries(b).filter(([, v]) => v).sort());

/** "2026-11-06T09:30:12" → "2026-11-06 09:30" */
export const dateTime = (value) => (typeof value === 'string' ? value.replace('T', ' ').slice(0, 16) : '');

/** 이 회원에게 지금 할 수 있는 계정 동작 (서버가 최종 판단) */
export function accountActions(member, meId) {
  if (!member) return [];
  const self = member.userId === meId;
  const actions = [];
  if (!member.emailVerified) actions.push('verifyEmail');
  if (member.status === 'LOCKED') actions.push('unlock');
  if (member.status !== 'PENDING' && member.status !== 'INACTIVE') actions.push('temporaryPassword');
  if (member.status !== 'PENDING' && !self) actions.push('role');
  if (member.status === 'INACTIVE') actions.push('reactivate');
  else if (member.status !== 'PENDING' && !self) actions.push('deactivate');
  return actions;
}
