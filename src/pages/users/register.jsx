import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { signUp } from '../../api/auth';
import { authErrorMessage } from '../../constants/auth-errors';
import AuthAlert from '../../components/auth/auth-alert';
import { AuthField, PasswordChecklist } from '../../components/auth/auth-field.jsx';
import AuthLayout from '../../components/auth/auth-layout';
import { joinPhone, koreanOnly, NAME_MAX, NAME_MIN, phonePartsError, signupBody, splitPhone } from '../../utils/auth-validation.js';
import PhoneInput from '../../components/phone-input.jsx';
import { getDetailMessages, getFieldErrors } from '../../utils/validation-details';

const EMPTY = { email: '', name: '', password: '', passwordConfirm: '', phone: '', department: '', jobTitle: '' };

/**
 * 회원가입 (POST /auth/signup). 서버가 받는 선택 항목(전화번호·부서·직책)도 함께 보낸다(예전 화면은 입력만 받고 보내지 않았다).
 * 편의: 비밀번호 규칙 실시간 체크·보기, 전화번호 하이픈 자동 제거, 이미 가입된 이메일이면 로그인·비밀번호 찾기로 바로.
 */
export default function Register() {
  const navigate = useNavigate();
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [formError, setFormError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [blocked, setBlocked] = useState({}); // 막은 글자를 쳤을 때 잠깐 보이는 안내
  const [phoneParts, setPhoneParts] = useState(() => splitPhone(''));
  const setPhone = (parts) => { setPhoneParts(parts); setForm((current) => ({ ...current, phone: joinPhone(parts) })); setErrors((current) => ({ ...current, phone: '' })); };
  const set = (field) => (event) => setForm({ ...form, [field]: event.target.value });
  // 이름은 한글만, 전화번호는 숫자만: 다른 글자는 칸에 들어가지 않게 바로 걸러 내고 안내한다
  const setOnly = (field, clean, message) => (event) => {
    const raw = event.target.value;
    const value = clean(raw);
    setForm({ ...form, [field]: value });
    setBlocked({ ...blocked, [field]: value !== raw ? message : '' });
  };
  const blur = (field) => () => { setTouched({ ...touched, [field]: true }); setBlocked((current) => ({ ...current, [field]: '' })); };
  // 입력하면서 보이는 검사는 칸을 떠난 뒤부터 (치는 중에는 빨간 글씨를 띄우지 않는다)
  const live = { ...(signupBody(form).errors ?? {}), phone: phonePartsError(phoneParts) };
  const shown = (field) => errors[field] || blocked[field] || (touched[field] && form[field] ? live[field] : '');

  const submit = async (event) => {
    event.preventDefault();
    if (loading) return;
    const result = signupBody(form);
    const phoneError = phonePartsError(phoneParts);
    if (phoneError) result.errors = { ...(result.errors ?? {}), phone: phoneError };
    setErrors(result.errors ?? {});
    setTouched(Object.fromEntries(Object.keys(EMPTY).map((key) => [key, true])));
    if (result.errors) return;
    setLoading(true); setFormError(null);
    try {
      await signUp(result.body);
      navigate('/register/done', { state: { email: result.body.email } });
    } catch (requestError) {
      if (requestError.code === 'EMAIL_DUPLICATED') { setErrors({ email: '이미 가입된 이메일입니다.' }); setFormError(requestError); return; }
      const fieldErrors = getFieldErrors(requestError);
      setErrors(fieldErrors);
      if (!Object.keys(fieldErrors).length) setFormError(requestError);
    } finally { setLoading(false); }
  };

  return (
    <AuthLayout steps={0} wide>
      <h1>회원가입</h1>
      <p className="auth2-sub">가입 후 이메일 인증과 관리자 승인이 끝나면 로그인할 수 있습니다.</p>
      {formError && (
        <AuthAlert type="error" action={formError.code === 'EMAIL_DUPLICATED' && <><Link className="auth2-link" to="/signin" state={{ email: form.email }}>로그인하기</Link><Link className="auth2-link" to="/forgot-password" state={{ email: form.email }}>비밀번호 찾기</Link></>}>
          {formError.code === 'EMAIL_DUPLICATED' ? '이미 가입된 이메일입니다. 인증 메일을 못 받았다면 로그인 화면에서 다시 보낼 수 있습니다.' : getDetailMessages(formError).join('\n') || authErrorMessage(formError)}
        </AuthAlert>
      )}
      <form className="auth2-form" onSubmit={submit} noValidate>
        <AuthField label="이메일" type="email" name="email" required autoComplete="email" inputMode="email" placeholder="name@company.com"
          value={form.email} error={shown('email')} hint="인증 메일을 받을 주소입니다." onChange={set('email')} onBlur={blur('email')} />
        <AuthField label="이름" name="name" required autoComplete="name" lang="ko" value={form.name} error={shown('name')}
          hint={`한글 ${NAME_MIN}~${NAME_MAX}자 · 띄어쓰기·영문·숫자는 쓸 수 없습니다.`}
          onChange={setOnly('name', koreanOnly, `이름은 한글만 ${NAME_MAX}자까지 입력할 수 있습니다.`)} onBlur={blur('name')} />
        <div className="auth2-grid">
          <AuthField label="비밀번호" type="password" name="password" required autoComplete="new-password" maxLength={64}
            value={form.password} error={shown('password')} onChange={set('password')} onBlur={blur('password')} />
          <AuthField label="비밀번호 확인" type="password" name="passwordConfirm" required autoComplete="new-password" maxLength={64}
            value={form.passwordConfirm} error={shown('passwordConfirm')} onChange={set('passwordConfirm')} onBlur={blur('passwordConfirm')} />
        </div>
        <PasswordChecklist value={form.password} confirm={form.passwordConfirm} />
        <p className="auth2-section">소속 정보 <span>· 관리자가 승인할 때 참고합니다</span></p>
        <div className={`auth-field2${shown('phone') ? ' is-error' : ''}`}>
          <label htmlFor="signup-phone" className="auth-field2__label">전화번호<span className="auth-field2__opt">선택</span></label>
          <PhoneInput id="signup-phone" className="phone-input--auth" parts={phoneParts} onChange={setPhone} onBlur={blur('phone')} invalid={Boolean(shown('phone'))} describedBy="signup-phone-help" />
          <span id="signup-phone-help" className={`auth-field2__help${shown('phone') ? ' is-error' : ''}`}>{shown('phone') || '숫자만 칸별로 입력하세요. 칸이 차면 다음 칸으로 넘어갑니다.'}</span>
        </div>
        <div className="auth2-grid">
          <AuthField label="부서" name="department" optional autoComplete="organization-title" maxLength={100} value={form.department} error={shown('department')} onChange={set('department')} onBlur={blur('department')} />
          <AuthField label="직책" name="jobTitle" optional maxLength={50} value={form.jobTitle} error={shown('jobTitle')} onChange={set('jobTitle')} onBlur={blur('jobTitle')} />
        </div>
        <button type="submit" className="ui-btn ui-btn--primary ui-btn--lg" disabled={loading}>{loading ? '가입 중…' : '가입 신청'}</button>
      </form>
      <p className="auth2-foot">이미 계정이 있나요? <Link className="auth2-link" to="/signin">로그인</Link></p>
    </AuthLayout>
  );
}
