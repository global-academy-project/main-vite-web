import { useRef } from 'react';
import { PHONE_PARTS, digitsOnly, splitPhone } from '../utils/auth-validation.js';

/**
 * 전화번호 세 칸(3·4·4). 숫자만 들어가고, 칸이 차면 다음 칸으로, 빈 칸에서 지우면 앞 칸으로 간다.
 * 번호 전체를 붙여 넣으면 알아서 나눈다. parts: ['010', '1234', '5678'] (선택 항목이라 기본값 없음)
 */
export default function PhoneInput({ parts, onChange, onBlur, id, invalid, describedBy, disabled, className = '', label = '전화번호' }) {
  const refs = [useRef(null), useRef(null), useRef(null)];
  const update = (index, raw) => {
    const digits = digitsOnly(raw);
    // 붙여 넣기·자동 완성으로 한 칸에 긴 번호가 들어오면 세 칸으로 나눈다
    if (digits.length > PHONE_PARTS[index]) {
      const split = splitPhone(index === 0 ? digits : parts.slice(0, index).join('') + digits);
      onChange(split);
      const open = split.findIndex((part, i) => part.length < PHONE_PARTS[i]);
      refs[open === -1 ? 2 : open].current?.focus();
      return;
    }
    const next = parts.map((part, i) => (i === index ? digits : part));
    onChange(next);
    if (digits.length === PHONE_PARTS[index] && index < 2) refs[index + 1].current?.focus();
  };
  const back = (index) => (event) => {
    if (event.key === 'Backspace' && !parts[index] && index > 0) { event.preventDefault(); refs[index - 1].current?.focus(); }
  };
  return (
    <div className={`phone-input ${className}`.trim()} role="group" aria-label={label} aria-describedby={describedBy}
      onBlur={(event) => { if (onBlur && !event.currentTarget.contains(event.relatedTarget)) onBlur(); }}>
      {PHONE_PARTS.map((size, index) => (
        <span key={index} className="phone-input__cell">
          {index > 0 && <span className="phone-input__dash" aria-hidden="true">-</span>}
          <input ref={refs[index]} id={index === 0 ? id : undefined} type="text" inputMode="numeric" pattern="[0-9]*" autoComplete={index === 0 ? 'tel' : 'off'}
            maxLength={index === 0 ? 11 : size + 7} size={size} value={parts[index] ?? ''} disabled={disabled} aria-invalid={invalid || undefined}
            aria-label={`${label} ${['앞', '가운데', '끝'][index]} ${index === 1 ? '3~4' : size}자리`}
            onChange={(event) => update(index, event.target.value)} onKeyDown={back(index)} />
        </span>
      ))}
    </div>
  );
}
