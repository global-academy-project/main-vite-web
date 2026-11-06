import { useId, useState } from 'react';
import Icon from '../ui/icon.jsx';
import { passwordChecks } from '../../utils/auth-validation.js';

/**
 * 로그인 화면 입력칸. 칸 아래 한 줄은 높이를 미리 잡아 둬서 오류 문구가 생겨도 아래가 밀리지 않는다.
 * password 면 보기/숨기기 버튼과 Caps Lock 안내를 붙인다.
 */
export function AuthField({ label, error, hint, required, optional, type = 'text', id, ...rest }) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const helpId = `${inputId}-help`;
  const [shown, setShown] = useState(false);
  const [caps, setCaps] = useState(false);
  const password = type === 'password';
  const message = error || (password && caps ? 'Caps Lock 이 켜져 있습니다.' : hint);
  return (
    <div className={`auth-field2${error ? ' is-error' : ''}`}>
      <label htmlFor={inputId} className="auth-field2__label">
        {label}{required && <span className="auth-field2__req" aria-hidden="true">*</span>}{optional && <span className="auth-field2__opt">선택</span>}
      </label>
      <div className="auth-field2__box">
        <input id={inputId} type={password && shown ? 'text' : type} required={required} aria-invalid={Boolean(error)}
          aria-describedby={message ? helpId : undefined}
          onKeyUp={password ? (event) => setCaps(event.getModifierState?.('CapsLock') ?? false) : undefined}
          onBlur={password ? () => setCaps(false) : undefined}
          {...rest} />
        {password && (
          <button type="button" className="auth-field2__eye" tabIndex={-1} aria-label={shown ? '비밀번호 숨기기' : '비밀번호 보기'} aria-pressed={shown} onClick={() => setShown((value) => !value)}>
            <Icon name={shown ? 'eyeOff' : 'eye'} size={18} />
          </button>
        )}
      </div>
      <span id={helpId} className={`auth-field2__help${error ? ' is-error' : caps && password ? ' is-warn' : ''}`} role={error ? 'alert' : undefined}>{message || ''}</span>
    </div>
  );
}

/** 비밀번호 규칙을 입력하는 동안 하나씩 체크해 보여 준다. confirm 을 주면 일치 여부도 */
export function PasswordChecklist({ value, confirm }) {
  const checks = passwordChecks(value);
  return (
    <ul className="auth-checklist" aria-label="비밀번호 규칙">
      {checks.map((check) => (
        <li key={check.key} className={check.ok ? 'is-ok' : ''}><Icon name="check" size={14} strokeWidth={3} />{check.label}</li>
      ))}
      {confirm !== undefined && <li className={confirm && confirm === value ? 'is-ok' : ''}><Icon name="check" size={14} strokeWidth={3} />확인 일치</li>}
      <li className="auth-checklist__note">최근에 쓴 비밀번호는 다시 쓸 수 없습니다</li>
    </ul>
  );
}
