import { useCallback, useId, useState } from 'react';
import { createPortal } from 'react-dom';
import { refreshWorkSite, siteRoles } from '../../api/workers';
import { HEADER_SITE_SLOT } from '../app-shell/header-slot.js';
import { useBreakpoint } from '../../hooks/use-breakpoint.js';
import '../../styles/page-header.css';

/**
 * 모든 화면 공통 페이지 머리. 자리와 모양은 항상 같고 이름만 바뀐다.
 *  - 왼쪽: 제목(+배지) / 그 아래 "현장 이름 · 설명" 한 줄. eyebrow 는 제목 위 작은 줄(홈: "이름님 · 날짜"), hideMeta 면 아래 줄 없음
 *  - 오른쪽: 화면별 조절칸(children) → 화면별 버튼(actions)
 *  - 현장 선택: 머리 위 줄 오른쪽(알림 옆) 자리에 그린다. 현장이 1개면 이름만 보인다. 그 자리가 없는 화면과 모바일(머리 줄이 좁음)은 예전처럼 버튼 줄 끝
 *  - 아래: 현장 정보 오류·현장 없음 안내 (예전 "01 작업 현장" 칸이 하던 일)
 *
 * context 는 useWorkSite() 결과. onBeforeSelect(siteId) 는 현장을 바꾸기 직전에 부른다(저장 안 한 내용 경고 등).
 * notices=false: 레이아웃(SafetyPageLayout)이 현장 오류를 이미 보여 주는 화면에서 두 번 뜨지 않게 한다.
 */
export default function PageHeader({ title, badges, description, eyebrow, hideMeta = false, context, onBeforeSelect, actions, children, notices = true }) {
  const selectId = useId();
  const site = context?.currentSite;
  const sites = context?.account?.sites ?? [];
  const meta = hideMeta ? '' : [site?.name ?? (context?.loading ? '현장 불러오는 중' : null), description].filter(Boolean).join(' · ');

  // 머리 위 줄의 현장 자리 (DashboardHeader 가 먼저 그려 둔다). 이 머리가 화면에 붙을 때 찾는다
  const [headerSlot, setSlot] = useState(null);
  const slot = useBreakpoint() === 'mobile' ? null : headerSlot;
  const findSlot = useCallback((node) => { if (node) setSlot(document.getElementById(HEADER_SITE_SLOT)); }, []);

  const change = async (event) => {
    const value = event.target.value;
    onBeforeSelect?.(value);
    await context.selectSite(value);
    refreshWorkSite();
  };

  const siteControl = context && sites.length > 1 ? (
    <span className="page-head__site">
      <label htmlFor={selectId} className="sr-only">현장 선택</label>
      <select id={selectId} value={site?.siteId ?? ''} disabled={context.loading || context.selecting} onChange={change}>
        {!site && <option value="" disabled>현장을 선택해 주세요</option>}
        {sites.map((item) => <option key={item.siteId} value={item.siteId}>{item.name}{siteRoles[item.role] ? ` · ${siteRoles[item.role]}` : ''}</option>)}
      </select>
    </span>
  ) : context && site ? <span className="page-head__site page-head__site--one" title="현재 현장">{site.name}</span> : null;

  return (
    <div className="page-head-wrap" ref={findSlot}>
      {slot && siteControl && createPortal(siteControl, slot)}
      <header className="page-head">
        <div className="page-head__text">
          {eyebrow && <p className="page-head__eyebrow">{eyebrow}</p>}
          <h1 className="page-head__title">{title}{badges && <span className="page-head__badges">{badges}</span>}</h1>
          {meta && <p className="page-head__meta">{meta}</p>}
        </div>
        <div className="page-head__actions">
          {children}
          {actions}
          {!slot && sites.length > 1 && siteControl}
        </div>
      </header>
      {notices && context?.error && (
        <p className="page-head__notice page-head__notice--error" role="alert">
          {context.error}
          <button type="button" className="ui-btn ui-btn--ghost" disabled={context.loading || context.selecting} onClick={context.reload}>다시 조회</button>
        </p>
      )}
      {notices && context && !context.loading && context.account && !sites.length && (
        <p className="page-head__notice" role="status">
          선택할 수 있는 현장이 없습니다. {context.account.user?.role === 'ADMIN' ? '등록된 활성 현장이 있는지 확인해 주세요.' : '관리자에게 현장 권한을 요청해 주세요.'}
        </p>
      )}
      {context?.selecting && <p className="page-head__notice" role="status">현장 선택을 저장하는 중입니다…</p>}
    </div>
  );
}
