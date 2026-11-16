import { useEffect, useId, useRef, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import Icon from './icon.jsx';
import { closeConfirm, getConfirmState, subscribeConfirm } from './confirm-store.js';

const FOCUSABLE = 'button:not([disabled])';
const TONE_ICON = { danger: 'warning', warn: 'alert', default: 'info' };

/**
 * 확인 창 자리. App 에 한 번만 둔다. 띄우기는 confirm-store.js 의 confirmAction().
 * PC·태블릿은 가운데 창, 모바일(≤640)은 바텀 시트. 기본 포커스는 취소(안전한 쪽), Esc = 취소.
 * 다른 창(Sheet·알림함) 위에 떠도 키 입력은 이 창이 먼저 받는다(capture).
 */
export default function ConfirmHost() {
  const state = useSyncExternalStore(subscribeConfirm, getConfirmState, getConfirmState);
  if (!state) return null;
  return <ConfirmDialog key={state.id} request={state} />;
}

function ConfirmDialog({ request }) {
  const titleId = useId();
  const messageId = useId();
  const panel = useRef(null);
  const cancelRef = useRef(null);
  const { title, message, confirmLabel = '확인', cancelLabel = '취소', tone = 'default' } = request;

  useEffect(() => {
    const returnTo = document.activeElement;
    cancelRef.current?.focus();
    const onKey = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        closeConfirm(false);
        return;
      }
      if (event.key !== 'Tab' || !panel.current) return;
      event.stopPropagation();
      const items = [...panel.current.querySelectorAll(FOCUSABLE)];
      if (!items.length) { event.preventDefault(); return; }
      const [head, tail] = [items[0], items[items.length - 1]];
      const inside = panel.current.contains(document.activeElement);
      if (!inside) { event.preventDefault(); head.focus(); }
      else if (event.shiftKey && document.activeElement === head) { event.preventDefault(); tail.focus(); }
      else if (!event.shiftKey && document.activeElement === tail) { event.preventDefault(); head.focus(); }
    };
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      if (returnTo && typeof returnTo.focus === 'function' && document.contains(returnTo)) returnTo.focus();
    };
  }, []);

  return createPortal(
    <div className={`ui-confirm ui-confirm--${tone}`} data-confirm-dialog="">
      <div className="ui-confirm__scrim" aria-hidden="true" onClick={() => closeConfirm(false)} />
      <section ref={panel} className="ui-confirm__panel" role="alertdialog" aria-modal="true"
        aria-labelledby={titleId} aria-describedby={message ? messageId : undefined}>
        <span className="ui-confirm__icon" aria-hidden="true"><Icon name={TONE_ICON[tone] ?? 'info'} size={22} /></span>
        <h2 id={titleId} className="ui-confirm__title">{title}</h2>
        {message && <p id={messageId} className="ui-confirm__message">{message}</p>}
        <div className="ui-confirm__actions">
          <button ref={cancelRef} type="button" className="ui-btn ui-btn--ghost" onClick={() => closeConfirm(false)}>{cancelLabel}</button>
          <button type="button" className={`ui-btn ${tone === 'danger' ? 'ui-btn--danger' : 'ui-btn--primary'}`} onClick={() => closeConfirm(true)}>{confirmLabel}</button>
        </div>
      </section>
    </div>,
    document.body,
  );
}
