import Icon from '../ui/icon.jsx';

const ICONS = { success: 'check', warning: 'warning', error: 'alert', info: 'info' };

/** 로그인 화면 안내 상자. children 이 없으면 아무것도 그리지 않는다 */
export default function AuthAlert({ type = 'info', children, action }) {
  if (!children) return null;
  return (
    <div className={`auth-alert2 auth-alert2--${type}`} role={type === 'error' || type === 'warning' ? 'alert' : 'status'}>
      <Icon name={ICONS[type] ?? 'info'} size={18} />
      <div className="auth-alert2__body">
        <div>{children}</div>
        {action && <div className="auth-alert2__action">{action}</div>}
      </div>
    </div>
  );
}
