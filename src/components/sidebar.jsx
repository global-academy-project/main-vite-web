import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useWorkSite } from '../api/workers';
import { useBreakpoint } from '../hooks/use-breakpoint.js';
import Icon from './ui/icon.jsx';
import { bottomTabsFor, effectiveRole, firstPath, isActivePath, navFor, ROLE_LABELS } from './app-shell/nav-config.js';
import '../styles/ui.css';
import '../styles/app-shell.css';

const GROUPS_KEY = 'sidebar-menu-groups';

function readGroups() {
  try { return JSON.parse(localStorage.getItem(GROUPS_KEY) || '{}'); } catch { return {}; }
}

/**
 * 왼쪽 메뉴 (PC 펼침 / 태블릿 아이콘만 / 모바일은 햄버거로 여는 메뉴 + 하단 탭).
 * 지금 고른 현장의 역할로 메뉴를 거른다. site 를 넘기지 않으면 직접 조회한다(같은 요청은 캐시를 같이 씀).
 */
export default function Sidebar({ isOpen = false, onClose, onOpen, site = undefined }) {
  const work = useWorkSite();
  const current = site === undefined ? work.currentSite : site;
  const accountRole = work.account?.user?.role ?? null;
  const siteRole = current?.role ?? current?.siteRole ?? null;
  const role = effectiveRole(accountRole, siteRole);
  const items = navFor(accountRole, siteRole);
  const { pathname } = useLocation();
  const breakpoint = useBreakpoint();
  const rail = breakpoint === 'tablet';
  const [open, setOpen] = useState(readGroups);

  useEffect(() => {
    try { localStorage.setItem(GROUPS_KEY, JSON.stringify(open)); } catch { /* 저장 못 해도 메뉴는 동작 */ }
  }, [open]);

  // 모바일 메뉴: 링크를 누르면 닫고(아래 closeMobile), Esc 로 닫는다
  useEffect(() => {
    if (!isOpen) return undefined;
    const onKey = (event) => { if (event.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  const groupOpen = (item) => open[item.key] ?? isActivePath(item, pathname);
  const linkClass = ({ isActive }) => `app-nav__link${isActive ? ' is-active' : ''}`;
  const closeMobile = () => { if (isOpen) onClose?.(); };

  return (
    <>
      {isOpen && <div className="app-nav-scrim" aria-hidden="true" onClick={onClose} />}
      <aside
        className={`dashboard-sidebar app-nav${isOpen ? ' mobile-open' : ''}${rail ? ' app-nav--rail' : ''}`}
        aria-label="주 메뉴"
        // 모바일에서 닫혀 있으면 화면 밖에 있으므로 Tab·화면 읽기에서도 뺀다
        inert={breakpoint === 'mobile' && !isOpen}
      >
        <div className="app-nav__inner">
          {onClose && (
            <button type="button" className="ui-icon-btn app-nav__close" onClick={onClose} aria-label="메뉴 닫기">
              <Icon name="close" size={18} />
            </button>
          )}
          <div className="app-nav__brand">
            <span className="app-nav__mark" aria-hidden="true"><Icon name="check" size={16} strokeWidth={2.6} /></span>
            <span className="app-nav__text">AI Safety</span>
          </div>

          <div className="app-nav__site" title={current?.name ?? ''}>
            <span className="app-nav__site-label app-nav__text">현재 현장</span>
            <span className="app-nav__site-name app-nav__text">{current?.name ?? (work.loading ? '불러오는 중' : '현장 없음')}</span>
            {role && <span className="app-nav__role">{rail ? ROLE_LABELS[role].slice(0, 2) : ROLE_LABELS[role]}</span>}
          </div>

          <nav className="app-nav__list">
            {items.map((item) => {
              const active = isActivePath(item, pathname);
              if (!item.children) {
                return (
                  <NavLink key={item.key} to={item.path} end={item.key === 'home'} className={linkClass} title={rail ? item.label : undefined} aria-label={rail ? item.label : undefined} onClick={closeMobile}>
                    <Icon name={item.icon} size={20} />
                    <span className="app-nav__text">{item.label}</span>
                  </NavLink>
                );
              }
              if (rail) {
                return (
                  <NavLink key={item.key} to={firstPath(item)} className={() => `app-nav__link${active ? ' is-active' : ''}`} title={item.label} aria-label={item.label}>
                    <Icon name={item.icon} size={20} />
                  </NavLink>
                );
              }
              const expanded = groupOpen(item);
              return (
                <section key={item.key} className="app-nav__group">
                  <button
                    type="button"
                    className={`app-nav__link app-nav__group-btn${active ? ' is-within' : ''}`}
                    aria-expanded={expanded}
                    onClick={() => setOpen((value) => ({ ...value, [item.key]: !expanded }))}
                  >
                    <Icon name={item.icon} size={20} />
                    <span className="app-nav__text">{item.label}</span>
                    <Icon name={expanded ? 'chevronUp' : 'chevronDown'} size={16} className="app-nav__chevron" />
                  </button>
                  {expanded && (
                    <div className="app-nav__sub">
                      {item.children.map((child) => (
                        <NavLink key={child.key} to={child.path} className={({ isActive }) => `app-nav__sublink${isActive ? ' is-active' : ''}`} onClick={closeMobile}>
                          {child.label}
                        </NavLink>
                      ))}
                    </div>
                  )}
                </section>
              );
            })}
          </nav>
        </div>
      </aside>

      {breakpoint === 'mobile' && (
        <nav className="app-tabs" aria-label="하단 메뉴">
          {bottomTabsFor(accountRole, siteRole).map((item) => (
            <NavLink key={item.key} to={firstPath(item)} end={item.key === 'home'} className={() => `app-tabs__tab${isActivePath(item, pathname) ? ' is-active' : ''}`}>
              <Icon name={item.icon} size={22} />
              <span>{item.label}</span>
            </NavLink>
          ))}
          {onOpen && (
            <button type="button" className="app-tabs__tab" onClick={onOpen} aria-haspopup="true">
              <Icon name="more" size={22} />
              <span>더보기</span>
            </button>
          )}
        </nav>
      )}
    </>
  );
}

