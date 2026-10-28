import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';

const menuGroups = [
  ['site', '현장관리', ['현장목록', '작업자관리']],
  ['work', '작업관리', ['작업 현황', '작업 위험성평가', '작업허가', '위험·근접 사고', 'TBM', '교육자료 관리']],
  ['record', '기록관리', ['점검 체크리스트', '작성문서 이력', '사진 기록(AI)']],
  ['report', '보고서관리', ['부서 보고(PDF)', '중대재해 통계', '통계·분석']],
];

const Icon = ({ children }) => <span className="menu-icon">{children}</span>;

export default function Sidebar({ isOpen = false, onClose }) {
  const location = useLocation();
  const [open, setOpen] = useState({
    site: true,
    work: false,
    record: location.pathname === '/job/dailey-checklist',
    report: false,
  });

  return (
    <aside className={`dashboard-sidebar ${isOpen ? 'mobile-open' : ''}`}>
      <div className="sidebar-scroll">
        {onClose && (
          <button className="sidebar-close" onClick={onClose} aria-label="메뉴 닫기">
            ×
          </button>
        )}
        <div className="brand">
          <span className="brand-mark">✓</span>
          AI Safety
        </div>
        <nav className="primary-nav">
          <NavLink to="/dashboard" end className={({ isActive }) => `top-nav-item${isActive ? ' active' : ''}`}>
            <Icon>⌂</Icon>
            대시보드
          </NavLink>
        </nav>
        <div className="nav-divider" />
        <nav className="group-nav">
          {menuGroups.map(([key, label, items]) => (
            <section className="menu-group" key={key}>
              <button
                className="group-heading"
                onClick={() => setOpen((value) => ({ ...value, [key]: !value[key] }))}
              >
                <span><Icon>▣</Icon>{label}</span>
                <span className="chevron">{open[key] ? '⌃' : '⌄'}</span>
              </button>
              {open[key] && (
                <div className="submenu">
                  {items.map((item, index) => item === '작업 현황' ? (
                    <NavLink
                      to="/job/dashboard"
                      className={({ isActive }) => isActive ? 'selected' : ''}
                      key={item}
                    >
                      {item}
                    </NavLink>
                  ) : item === '현장목록' ? (
                    <NavLink
                      to="/job/list"
                      className={({ isActive }) => isActive ? 'selected' : ''}
                      key={item}
                    >
                      {item}
                    </NavLink>
                  ) : item === '점검 체크리스트' ? (
                    <NavLink
                      to="/job/dailey-checklist"
                      className={({ isActive }) => isActive ? 'selected' : ''}
                      key={item}
                    >
                      {item}
                    </NavLink>
                  ) : (
                    <a
                      href="#"
                      className={key === 'site' && index === 0 ? 'selected' : ''}
                      key={item}
                    >
                      {item}
                    </a>
                  ))}
                </div>
              )}
            </section>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="admin-link">
            <Icon>⚙</Icon>
            관리자 메뉴
            <span className="admin-badge">관리자</span>
          </div>
          <div className="role-label">사용자 권한 전환</div>
          <div className="role-switch">
            <button className="chosen">관리자</button>
            <button>감독자</button>
            <button>작업자</button>
          </div>
        </div>
      </div>
    </aside>
  );
}
