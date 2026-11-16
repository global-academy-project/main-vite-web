import { Fragment, useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { useWorkSite } from '../api/workers';
import { useBreakpoint } from '../hooks/use-breakpoint.js';
import Icon from './ui/icon.jsx';
import { bottomTabsFor, effectiveRole, firstPath, isActivePath, navFor, ROLE_LABELS, SECTION_LABELS } from './app-shell/nav-config.js';
import '../styles/ui.css';
import '../styles/app-shell.css';

const GROUPS_KEY = 'sidebar-menu-groups';
const FOLD_KEY = 'sidebar-folded';

function readGroups() {
  try { return JSON.parse(localStorage.getItem(GROUPS_KEY) || '{}'); } catch { return {}; }
}
function readFolded() {
  try { return localStorage.getItem(FOLD_KEY) === '1'; } catch { return false; }
}

/**
 * 왼쪽 메뉴 (PC 펼침·접기 / 태블릿 아이콘만 / 모바일은 햄버거로 여는 메뉴 + 하단 탭).
 * 지금 고른 현장의 역할로 메뉴를 거른다. site 를 넘기지 않으면 직접 조회한다(같은 요청은 캐시를 같이 씀).
 * 메뉴는 묶음(메뉴 / 결재·기록 / 설정)으로 나뉘고, 맨 아래에 내 계정(이름·역할·로그아웃)이 있다.
 * PC 에서 접으면 태블릿과 같은 아이콘 메뉴가 되고, 접은 상태는 이 브라우저에 기억한다.
 */
export default function Sidebar({ isOpen = false, onClose, onOpen, site = undefined, onLogout }) {
  const work = useWorkSite();
  const current = site === undefined ? work.currentSite : site;
  const accountRole = work.account?.user?.role ?? null;
  const siteRole = current?.role ?? current?.siteRole ?? null;
  const role = effectiveRole(accountRole, siteRole);
  const userName = work.account?.user?.name ?? '';
  const items = navFor(accountRole, siteRole);
  const { pathname } = useLocation();
  const breakpoint = useBreakpoint();
  const [folded, setFolded] = useState(readFolded);
  const rail = breakpoint === 'tablet' || (breakpoint === 'desktop' && folded);
  const [open, setOpen] = useState(readGroups);
  const userInitial = Array.from(userName)[0] || '사';

  useEffect(() => {
    try { localStorage.setItem(FOLD_KEY, folded ? '1' : '0'); } catch { /* 저장 못 해도 메뉴는 동작 */ }
  }, [folded]);

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
          {/* 맨 위 줄: PC 는 로고 자리에 접기·펼치기 버튼. 펼침·접힘 모두 같은 자리에서 누른다. 태블릿·모바일은 접기가 없어 로고 */}
          <div className="app-nav__brand">
            {breakpoint === 'desktop' ? (
              <button type="button" className="app-nav__fold" onClick={() => setFolded((value) => !value)}
                aria-label={folded ? '메뉴 펼치기' : '메뉴 접기'} aria-pressed={folded} title={folded ? '메뉴 펼치기' : '메뉴 접기'}>
                <Icon name="panel" size={18} />
              </button>
            ) : <span className="app-nav__mark" aria-hidden="true"><Icon name="check" size={16} strokeWidth={2.6} /></span>}
            <span className="app-nav__text">AI Safety</span>
          </div>

          <nav className="app-nav__list">
            {items.map((item, index) => {
              const active = isActivePath(item, pathname);
              const caption = item.section && item.section !== items[index - 1]?.section
                ? <p className="app-nav__caption"><span className="app-nav__caption-text">{SECTION_LABELS[item.section]}</span></p> : null;
              if (!item.children) {
                return (
                  <Fragment key={item.key}>{caption}<NavLink to={item.path} end={item.key === 'home'} className={linkClass} title={rail ? item.label : undefined} aria-label={rail ? item.label : undefined} onClick={closeMobile}>
                    <Icon name={item.icon} size={20} />
                    <span className="app-nav__text">{item.label}</span>
                  </NavLink></Fragment>
                );
              }
              if (rail) {
                return (
                  <Fragment key={item.key}>{caption}<NavLink to={firstPath(item)} className={() => `app-nav__link${active ? ' is-active' : ''}`} title={item.label} aria-label={item.label}>
                    <Icon name={item.icon} size={20} />
                  </NavLink></Fragment>
                );
              }
              const expanded = groupOpen(item);
              return (
                <Fragment key={item.key}>{caption}<section className="app-nav__group">
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
                </section></Fragment>
              );
            })}
          </nav>

          <div className="app-nav__account">
            <Link to="/me" className="app-nav__me" onClick={closeMobile} title={rail ? `${userName} · 내 계정` : undefined} aria-label={rail ? `${userName} 내 계정` : undefined}>
              <span className="app-nav__avatar" aria-hidden="true">{userInitial}</span>
              <span className="app-nav__who app-nav__text">
                <span className="app-nav__user">{userName || (work.loading ? '불러오는 중' : '사용자')}</span>
                {role && <span className="app-nav__role-text">{ROLE_LABELS[role]}</span>}
              </span>
            </Link>
            {onLogout && (
              <button type="button" className="app-nav__logout" onClick={onLogout} aria-label="로그아웃" title="로그아웃">
                <Icon name="logout" size={18} />
              </button>
            )}
          </div>
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

