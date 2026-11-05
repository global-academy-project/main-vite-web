// 왼쪽 메뉴·하단 탭 정의. 화면에서 숨기는 것은 편의일 뿐이고 최종 권한 판단은 서버가 한다.
// 역할: 계정 ADMIN(회사 관리자) / 현장 SITE_ADMIN · APPROVER · WRITER

export const ROLE_LABELS = Object.freeze({ ADMIN: '회사 관리자', SITE_ADMIN: '현장 관리자', APPROVER: '승인자', WRITER: '작성자' });

const ALL = ['ADMIN', 'SITE_ADMIN', 'APPROVER', 'WRITER'];
const APPROVERS = ['ADMIN', 'SITE_ADMIN', 'APPROVER'];
const MANAGERS = ['ADMIN', 'SITE_ADMIN'];

export const NAV = Object.freeze([
  { key: 'home', label: '홈', icon: 'home', path: '/dashboard', roles: ALL },
  {
    key: 'work', label: '작업', icon: 'work', roles: ALL,
    children: [
      { key: 'work-list', label: '작업 등록·조회', path: '/job/workspace' },
      { key: 'work-status', label: '작업 현황', path: '/job/dashboard' },
      { key: 'risk', label: '위험성평가', path: '/job/risk-assessment' },
      { key: 'permit', label: '작업허가', path: '/job/permits' },
      { key: 'tbm', label: 'TBM', path: '/job/tbm' },
    ],
  },
  { key: 'approvals', label: '승인함', icon: 'inbox', path: '/approvals', roles: APPROVERS },
  {
    key: 'records', label: '기록', icon: 'records', roles: ALL,
    children: [
      { key: 'incidents', label: '아차사고', path: '/job/incidents' },
      { key: 'record-search', label: '기록 검색', path: '/records/search' },
      { key: 'daily-safety', label: '안전일지', path: '/job/daily-safety' },
      { key: 'checklist', label: '점검표', path: '/job/dailey-checklist' },
    ],
  },
  { key: 'site', label: '현장 설정', icon: 'site', path: '/job/list', roles: MANAGERS },
  { key: 'admin', label: '관리', icon: 'admin', path: '/admin/users', roles: ['ADMIN'], accountOnly: true },
]);

/**
 * 메뉴에 쓸 역할. 계정 ADMIN 은 어느 현장이든 회사 관리자, 아니면 지금 고른 현장의 역할.
 * 현장 정보를 아직 못 받았으면 null (가장 좁은 메뉴를 보인다).
 */
export function effectiveRole(accountRole, siteRole) {
  if (accountRole === 'ADMIN') return 'ADMIN';
  return ALL.includes(siteRole) && siteRole !== 'ADMIN' ? siteRole : null;
}

/** 역할로 걸러 낸 메뉴. 관리(accountOnly)는 계정 ADMIN 만 */
export function navFor(accountRole, siteRole) {
  const role = effectiveRole(accountRole, siteRole);
  return NAV.filter((item) => {
    if (item.accountOnly) return accountRole === 'ADMIN';
    return role ? item.roles.includes(role) : item.roles === ALL;
  });
}

/** 역할별 첫 화면: 승인자는 승인함, 나머지는 홈 */
export function homePathFor(accountRole, siteRole) {
  return effectiveRole(accountRole, siteRole) === 'APPROVER' ? '/approvals' : '/dashboard';
}

/** 경로가 메뉴 항목(또는 그 하위)에 해당하는지 */
export function isActivePath(item, pathname) {
  const own = (path) => path && (pathname === path || pathname.startsWith(`${path}/`));
  if (item.key === 'records' && own('/records')) return true;
  if (item.children) return item.children.some((child) => own(child.path));
  return own(item.path);
}

/** 그룹이면 첫 하위 경로 (태블릿 아이콘 메뉴에서 누를 때) */
export const firstPath = (item) => item.path ?? item.children?.[0]?.path ?? '/dashboard';

/** 모바일 하단 탭: 홈·작업·(승인함)·기록 + 더보기(전체 메뉴) */
export function bottomTabsFor(accountRole, siteRole) {
  const keys = ['home', 'work', 'approvals', 'records'];
  return navFor(accountRole, siteRole).filter((item) => keys.includes(item.key));
}
