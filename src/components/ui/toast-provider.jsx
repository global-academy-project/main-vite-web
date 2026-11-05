import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Icon from './icon.jsx';
import { ToastContext } from './toast-context.js';

const icons = { success: 'check', error: 'alert', info: 'info' };
const MAX = 3;

export default function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());
  const seq = useRef(0);

  const dismiss = useCallback((id) => {
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    setToasts((list) => list.filter((toast) => toast.id !== id));
  }, []);

  const show = useCallback(({ tone = 'info', message, duration } = {}) => {
    if (!message) return null;
    seq.current += 1;
    const id = seq.current;
    setToasts((list) => [...list, { id, tone, message }].slice(-MAX));
    // 오류는 읽을 시간이 더 필요하다
    const ms = duration ?? (tone === 'error' ? 7000 : 4000);
    timers.current.set(id, setTimeout(() => dismiss(id), ms));
    return id;
  }, [dismiss]);

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach((timer) => clearTimeout(timer));
  }, []);

  const value = useMemo(() => ({ show, dismiss }), [show, dismiss]);
  const polite = toasts.filter((toast) => toast.tone !== 'error');
  const urgent = toasts.filter((toast) => toast.tone === 'error');

  const render = (toast) => (
    <div key={toast.id} className={`ui-toast ui-toast--${toast.tone}`}>
      <span className="ui-toast__icon"><Icon name={icons[toast.tone] ?? 'info'} /></span>
      <span className="ui-toast__message">{toast.message}</span>
      <button type="button" className="ui-toast__close" aria-label="알림 닫기" onClick={() => dismiss(toast.id)}>
        <Icon name="close" size={16} />
      </button>
    </div>
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="ui-toasts">
        {/* 알림 영역은 항상 있어야 화면 읽기 프로그램이 새 문구를 읽는다 */}
        <div role="status" aria-live="polite" style={{ display: 'contents' }}>{polite.map(render)}</div>
        <div role="alert" aria-live="assertive" style={{ display: 'contents' }}>{urgent.map(render)}</div>
      </div>
    </ToastContext.Provider>
  );
}
