import { useEffect, useId, useRef, useState } from 'react';
import Icon from './icon.jsx';

/**
 * 필터 드롭다운 (11/14 규칙 "필터는 드롭다운"): 버튼은 "이름 값 ⌄" 한 줄, 누르면 아래에 판이 열린다.
 * 바깥을 누르거나 Esc 면 닫히고 버튼으로 포커스를 돌려준다. 판 내용은 children(close 를 받는 함수도 됨).
 * active: 기본값이 아닌 값을 고른 상태(버튼 테두리 강조)
 */
export default function FilterMenu({ label, value, active = false, children, width, align = 'start' }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef(null);
  const button = useRef(null);
  const panelId = useId();
  const close = (focus = true) => { setOpen(false); if (focus) button.current?.focus(); };

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (event) => { if (!wrap.current?.contains(event.target) && !event.target.closest?.('[data-confirm-dialog]')) setOpen(false); };
    const onKey = (event) => { if (event.key === 'Escape') { event.stopPropagation(); setOpen(false); button.current?.focus(); } };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    wrap.current?.querySelector('.ui-filter__panel input, .ui-filter__panel button')?.focus();
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  return (
    <div className={`ui-filter${open ? ' is-open' : ''}`} ref={wrap}>
      <button ref={button} type="button" className={`ui-filter__btn${active ? ' is-active' : ''}`} aria-expanded={open} aria-controls={panelId} aria-haspopup="dialog" onClick={() => setOpen((value) => !value)}>
        <span className="ui-filter__label">{label}</span>
        <strong className="ui-filter__value">{value}</strong>
        <Icon name={open ? 'chevronUp' : 'chevronDown'} size={16} />
      </button>
      {open && (
        <div id={panelId} className={`ui-filter__panel ui-filter__panel--${align}`} role="dialog" aria-label={label} style={width ? { width } : undefined}>
          {typeof children === 'function' ? children(close) : children}
        </div>
      )}
    </div>
  );
}
