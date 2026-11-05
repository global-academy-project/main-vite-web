import { forwardRef, useId } from 'react';
import Icon from './icon.jsx';

/**
 * 입력칸. 칸 안 오른쪽에 단위와 상태 아이콘(✓ 확인 / ! 문제), 칸 아래에는 높이를 미리 잡아 둔 한 줄 도움말 자리.
 * 검사 문구가 생겨도 아래 내용이 밀리지 않는다.
 *
 * error 가 있으면 문제 상태(도움말 자리에 error 문구), valid 이면 확인 상태(도움말 자리에 hint).
 * 검사 시점(입력 중에는 숨김, blur·저장 때 표시)은 부르는 쪽 훅이 정한다.
 *
 * @param {{ label: string, hint?: string, error?: string, valid?: boolean, unit?: string,
 *   required?: boolean, multiline?: boolean, id?: string } & React.InputHTMLAttributes} props
 */
const Field = forwardRef(function Field({ label, hint, error, valid = false, unit, required = false, multiline = false, id, className, ...inputProps }, ref) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const helpId = `${inputId}-help`;
  const status = error ? 'error' : valid ? 'ok' : null;
  const Tag = multiline ? 'textarea' : 'input';
  const classes = ['ui-field', status && `ui-field--${status}`, (unit || status) && 'ui-field--has-suffix', className].filter(Boolean).join(' ');

  return (
    <div className={classes}>
      <label className="ui-field__label" htmlFor={inputId}>
        {label}
        {required && <span className="ui-field__required" aria-hidden="true">*</span>}
      </label>
      <div className="ui-field__control">
        <Tag
          ref={ref}
          id={inputId}
          className="ui-field__input"
          aria-invalid={error ? true : undefined}
          aria-describedby={helpId}
          aria-required={required || undefined}
          {...inputProps}
        />
        {(unit || status) && !multiline && (
          <span className="ui-field__suffix">
            {unit}
            {status === 'ok' && <span className="ui-field__mark--ok"><Icon name="check" size={16} strokeWidth={2.6} label="확인" /></span>}
            {status === 'error' && <span className="ui-field__mark--error"><Icon name="alert" size={16} strokeWidth={2.4} label="문제" /></span>}
          </span>
        )}
      </div>
      <span id={helpId} className="ui-field__help">{error || hint || ''}</span>
    </div>
  );
});

export default Field;
