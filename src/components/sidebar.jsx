import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';

const groups = [
  ['site', '현장관리', [['현장목록', '/job/list'], ['가입 승인·현장 권한', '/admin/users']]],
  ['work', '작업관리', [['작업 현황', '/job/dashboard'], ['작업 위험성평가', '/job/risk-assessment'], ['작업허가', '/job/permits'], ['위험·근접 사고', '/job/incidents'], ['TBM', '/job/tbm'], ['교육자료 관리', '/job/training-materials']]],
  ['record', '기록관리', [['점검 체크리스트', '/job/dailey-checklist'], ['작성문서 이력', '/job/document-history'], ['기록 조회', '/records/search']]],
  ['report', '보고서관리', [['부서 보고(PDF)', '#'], ['중대재해 통계', '#'], ['통계·분석', '#']]],
];

const Icon = ({ children }) => <span className="menu-icon">{children}</span>;

export default function Sidebar({ isOpen = false, onClose, site = null }) {
  const role = site?.role || site?.siteRole || '';
  const canApprove = ['APPROVER', 'SITE_ADMIN', 'ADMIN'].includes(role);
  const [open, setOpen] = useState(() => {
    try {
      return { site: true, work: false, record: false, report: false, ...JSON.parse(localStorage.getItem('sidebar-menu-groups') || '{}') };
    } catch { return { site: true, work: false, record: false, report: false }; }
  });
  useEffect(() => { localStorage.setItem('sidebar-menu-groups', JSON.stringify(open)); }, [open]);
  return <aside className={`dashboard-sidebar ${isOpen ? 'mobile-open' : ''}`}>
    <div className="sidebar-scroll">
      {onClose && <button className="sidebar-close" onClick={onClose} aria-label="메뉴 닫기">×</button>}
      <div className="brand"><span className="brand-mark">✓</span>AI Safety</div>
      <nav className="primary-nav"><NavLink to="/dashboard" end className={({ isActive }) => `top-nav-item${isActive ? ' active' : ''}`}><Icon>⌂</Icon>대시보드 · AI 질문</NavLink></nav>
      <div className="nav-divider" />
      <nav className="group-nav">{groups.map(([key, label, items]) => <section className="menu-group" key={key}>
        <button className="group-heading" onClick={() => setOpen((value) => ({ ...value, [key]: !value[key] }))}><span><Icon>▣</Icon>{label}</span><span className="chevron">{open[key] ? '⌃' : '⌄'}</span></button>
        {open[key] && <div className="submenu">{items.map(([item, path]) => path === '#' ? (
          <button type="button" className="submenu-disabled" key={item} disabled title="준비 중인 메뉴">{item} <small>준비 중</small></button>
        ) : <NavLink to={path} key={item} className={({ isActive }) => isActive ? 'selected' : ''}>{item}</NavLink>)}{key === 'work' && canApprove && <NavLink to="/approvals" className={({ isActive }) => isActive ? 'selected' : ''}>승인함</NavLink>}</div>}
      </section>)}</nav>
      <div className="sidebar-footer">
        <div className="admin-link"><Icon>⚙</Icon>관리자 메뉴<span className="admin-badge">관리자</span></div>
        <div className="role-label">현장 역할 선택</div>
        <div className="role-switch" aria-label="현장 역할 선택">
          {[
            ['ADMIN', '관리자'],
            ['SITE_ADMIN', '감독자'],
            ['WRITER', '작업자'],
          ].map(([value, label]) => <button type="button" className={role === value ? 'chosen' : ''} key={value} disabled>{label}</button>)}
        </div>
      </div>
    </div>
  </aside>;
}
