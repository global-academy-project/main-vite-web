import Icon from '../ui/icon.jsx';

const ICON = { loading: 'spinner', success: 'check', error: 'alert', mail: 'mail', info: 'info' };

/** 결과 화면 머리: 동그란 아이콘 + 제목 + 설명 */
export default function AuthStatus({ kind = 'info', title, children }) {
  return (
    <>
      <span className={`auth2-status is-${kind}`} aria-hidden="true"><Icon name={ICON[kind] ?? 'info'} size={26} strokeWidth={kind === 'success' ? 3 : 2} /></span>
      <h1 role={kind === 'loading' ? 'status' : undefined}>{title}</h1>
      {children && <p className="auth2-sub">{children}</p>}
    </>
  );
}
