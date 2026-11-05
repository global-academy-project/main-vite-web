import { useCallback, useMemo, useState } from 'react';
import { firstInvalid, visibleErrors } from '../utils/field-validation.js';
import { getFieldErrors } from '../utils/validation-details.js';

/**
 * 폼 입력 검사 훅. rules: { 칸이름: (값, 전체값) => 오류문구 | '' }
 * 웹 검사는 서버 규칙을 미리 알려 주는 용도이고 최종 판단은 서버가 한다.
 * 서버 400(INVALID_REQUEST)의 error.details 는 applyServerError 로 칸에 붙인다.
 */
export function useFieldValidation(values, rules) {
  const [touched, setTouched] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [serverErrors, setServerErrors] = useState({});

  const errors = useMemo(
    () => visibleErrors({ values, rules, touched, submitted, serverErrors }),
    [values, rules, touched, submitted, serverErrors],
  );

  const blur = useCallback((field) => setTouched((prev) => (prev[field] ? prev : { ...prev, [field]: true })), []);

  // 사용자가 칸을 고치면 그 칸의 서버 오류는 지운다
  const changed = useCallback((field) => setServerErrors((prev) => {
    if (!(field in prev)) return prev;
    const next = { ...prev };
    delete next[field];
    return next;
  }), []);

  /** 저장 직전 호출. 통과하면 true, 아니면 첫 문제 칸으로 스크롤·포커스하고 false */
  const validate = useCallback((order) => {
    setSubmitted(true);
    const field = firstInvalid(values, rules, order);
    if (field) focusField(field);
    return !field;
  }, [values, rules]);

  /** 서버 오류를 칸에 붙인다. 칸에 붙지 않은 업무 오류 문구를 돌려준다(토스트·요약 줄용) */
  const applyServerError = useCallback((error) => {
    const fields = getFieldErrors(error);
    setServerErrors(fields);
    const first = Object.keys(fields).find((field) => field in rules);
    if (first) focusField(first);
    const unmatched = Object.keys(fields).filter((field) => !(field in rules));
    if (!Object.keys(fields).length) return error?.message ?? '';
    return unmatched.length ? unmatched.map((field) => fields[field]).join(' ') : '';
  }, [rules]);

  const reset = useCallback(() => { setTouched({}); setSubmitted(false); setServerErrors({}); }, []);

  return { errors, blur, changed, validate, applyServerError, reset };
}

function focusField(field) {
  if (typeof document === 'undefined') return;
  const element = document.querySelector(`[name="${CSS.escape(field)}"]`);
  if (!element) return;
  element.scrollIntoView({ block: 'center', behavior: 'smooth' });
  element.focus({ preventScroll: true });
}
