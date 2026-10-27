import { useState } from 'react';
import { NavLink } from 'react-router-dom';

const menuGroups = [
  ['site', '사업장관리', ['사업장정보', '작업구역·설비', '작업자현황']],
  ['work', '작업관리', ['작업등록', '일일 위험성평가', '작업허가', '장비·구역 점검', 'TBM', '아차사고 보고']],
  ['record', '기록관리', ['일일 안전일지', '작성·승인 이력', '기록 질의(AI)']],
  ['report', '보고서관리', ['인쇄 양식(PDF)', '감사 대응 보고서', '통계·분석']],
];

const Icon = ({ children }) => <span className="menu-icon">{children}</span>;

export default function Sidebar({ isOpen = false, onClose }) {
  const [open, setOpen] = useState({ site: true, work: false, record: false, report: false });

  return (
    <aside className={`dashboard-sidebar ${isOpen ? 'mobile-open' : ''}`}>
      <div className="sidebar-scroll">
        {onClose && <button className="sidebar-close" onClick={onClose} aria-label="메뉴 닫기">×</button>}
        <div className="brand"><span className="brand-mark">✧</span>AI Safety</div>
        <nav className="primary-nav">
          <NavLink to="/job/list" className="top-nav-item"><Icon>⌂</Icon>대시보드</NavLink>
          <NavLink to="/job/list" className="top-nav-item active"><Icon>▣</Icon>오늘 현황</NavLink>
        </nav>
        <div className="nav-divider" />
        <nav className="group-nav">
          {menuGroups.map(([key, label, items]) => (
            <section className="menu-group" key={key}>
              <button className="group-heading" onClick={() => setOpen((value) => ({ ...value, [key]: !value[key] }))}>
                <span><Icon>▣</Icon>{label}</span>
                <span className="chevron">{open[key] ? '⌄' : '›'}</span>
              </button>
              {open[key] && <div className="submenu">
                {items.map((item, index) => <a href="#" className={key === 'site' && index === 0 ? 'selected' : ''} key={item}>{item}</a>)}
              </div>}
            </section>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="admin-link"><Icon>♙</Icon>관리자 메뉴 <span className="admin-badge">관리자</span></div>
          <div className="role-label">시연용 역할 전환</div>
          <div className="role-switch"><button className="chosen">작성자</button><button>승인자</button><button>관리자</button></div>
        </div>
      </div>
    </aside>
  );
}
