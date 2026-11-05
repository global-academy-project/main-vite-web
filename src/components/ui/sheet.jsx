import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useBreakpoint } from '../../hooks/use-breakpoint.js';
import Icon from './icon.jsx';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * 문서 열기 창. PC 는 오른쪽 드로어, 태블릿은 넓은 드로어, 모바일은 바텀 시트(손잡이를 누르면 전체 화면).
 * 열면 창 안으로 포커스가 들어가고, Esc 로 닫히며, 닫으면 열었던 버튼으로 포커스가 돌아간다.
 *
 * @param {{ open: boolean, onClose: () => void, title: string, subtitle?: string,
 *   actions?: React.ReactNode, footer?: React.ReactNode, wide?: boolean, children: React.ReactNode }} props
 */
export default function Sheet({ open, onClose, title, subtitle, actions, footer, wide = false, children }) {
  const titleId = useId();
  const panel = useRef(null);
  const returnTo = useRef(null);
  const closeRef = useRef(onClose);
  const breakpoint = useBreakpoint();
  const [expanded, setExpanded] = useState(false);

  useEffect(() => { closeRef.current = onClose; }, [onClose]);

  useEffect(() => {
    if (!open) return undefined;
    returnTo.current = document.activeElement;
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    // 패널 자체로 포커스를 옮긴다 (화면 읽기 프로그램이 창 제목부터 읽는다). Tab 은 창 안에서만 돈다.
    panel.current?.focus();

    const onKey = (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        closeRef.current?.();
        return;
      }
      if (event.key !== 'Tab' || !panel.current) return;
      const items = [...panel.current.querySelectorAll(FOCUSABLE)];
      if (!items.length) { event.preventDefault(); return; }
      const [head, tail] = [items[0], items[items.length - 1]];
      if (event.shiftKey && document.activeElement === head) { event.preventDefault(); tail.focus(); }
      else if (!event.shiftKey && document.activeElement === tail) { event.preventDefault(); head.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      setExpanded(false);
      const target = returnTo.current;
      if (target && typeof target.focus === 'function' && document.contains(target)) target.focus();
    };
  }, [open]);

  if (!open) return null;
  const mobile = breakpoint === 'mobile';
  const className = ['ui-sheet', wide && 'ui-sheet--wide', mobile && expanded && 'ui-sheet--expanded'].filter(Boolean).join(' ');

  return createPortal(
    <div className={className}>
      <div className="ui-sheet__scrim" aria-hidden="true" onClick={onClose} />
      <section ref={panel} className="ui-sheet__panel" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
        <button
          type="button"
          className="ui-sheet__handle"
          aria-label={expanded ? '창 줄이기' : '전체 화면으로 펼치기'}
          aria-expanded={expanded}
          onClick={() => setExpanded((value) => !value)}
          hidden={!mobile}
        >
          <span />
        </button>
        <header className="ui-sheet__header">
          <div className="ui-sheet__titles">
            {subtitle && <span className="ui-sheet__subtitle">{subtitle}</span>}
            <h2 id={titleId} className="ui-sheet__title">{title}</h2>
          </div>
          <div className="ui-sheet__actions">
            {actions}
            <button type="button" className="ui-icon-btn" aria-label="닫기" onClick={onClose}>
              <Icon name="close" size={18} />
            </button>
          </div>
        </header>
        <div className="ui-sheet__body">{children}</div>
        {footer && <footer className="ui-sheet__footer">{footer}</footer>}
      </section>
    </div>,
    document.body,
  );
}
