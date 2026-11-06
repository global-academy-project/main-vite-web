import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { resendVerification, signIn } from '../../api/auth';
import { setToken } from '../../api/client';
import { authErrorMessage } from '../../constants/auth-errors';
import AuthAlert from '../../components/auth/auth-alert';
import { AuthField } from '../../components/auth/auth-field.jsx';
import AuthLayout from '../../components/auth/auth-layout';
import { useCooldown } from '../../hooks/use-cooldown.js';
import { readLastEmail, validEmail, writeLastEmail } from '../../utils/auth-validation.js';

/**
 * 로그인 (POST /auth/login). 편의: 마지막 이메일 기억, 비밀번호 보기·Caps Lock 안내,
 * 상태별 안내(인증 전 → 인증 메일 다시 보내기, 승인 대기, 잠김 → 비밀번호 재설정), 재발송은 60초 간격.
 */
export default function Signin() {
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState(() => location.state?.email ?? readLastEmail());
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [rememberEmail, setRememberEmail] = useState(() => Boolean(readLastEmail()));
  const [touched, setTouched] = useState(false);
  const [passwordMissing, setPasswordMissing] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [resent, setResent] = useState('');
  const cooldown = useCooldown(60);
  const emailError = touched && email && !validEmail(email) ? 'name@company.com 같은 이메일 형식으로 입력하세요.' : '';

  const submit = async (event) => {
    event.preventDefault();
    setTouched(true);
    setPasswordMissing(!password);
    if (!validEmail(email) || !password || loading) return;
    setError(null); setResent(''); setLoading(true);
    try {
      const result = await signIn({ email: email.trim(), password, rememberMe: remember });
      writeLastEmail(rememberEmail ? email.trim() : '');
      setToken(result.accessToken, result.expiresIn);
      // "/" 에서 역할별 첫 화면으로 보낸다 (승인자는 승인함, 나머지는 홈)
      navigate(result.mustChangePassword ? '/change-password' : '/');
    } catch (requestError) {
      setError(requestError);
      setPassword('');
    } finally { setLoading(false); }
  };

  const resend = async () => {
    try {
      await resendVerification(email.trim());
      cooldown.start();
      setResent(`${email.trim()} 로 인증 메일을 다시 보냈습니다. 10분 안에 링크를 누르세요.`);
    } catch (requestError) { setResent(authErrorMessage(requestError)); }
  };

  const action = error?.code === 'EMAIL_NOT_VERIFIED'
    ? <button type="button" className="auth2-link" disabled={cooldown.remaining > 0} onClick={resend}>{cooldown.remaining ? `${cooldown.remaining}초 뒤 다시 보낼 수 있음` : '인증 메일 다시 보내기'}</button>
    : error?.code === 'ACCOUNT_LOCKED' ? <Link className="auth2-link" to="/forgot-password" state={{ email }}>비밀번호 재설정하기</Link>
      : error?.code === 'LOGIN_FAILED' ? <Link className="auth2-link" to="/forgot-password" state={{ email }}>비밀번호를 잊으셨나요?</Link> : null;
  const help = error?.code === 'ACCOUNT_PENDING' ? '이메일 인증은 끝났고 관리자가 현장과 역할을 정하는 중입니다. 승인되면 로그인할 수 있습니다.'
    : error?.code === 'ACCOUNT_LOCKED' ? '비밀번호를 재설정하거나 관리자에게 잠금 해제를 요청하세요.' : '';

  return (
    <AuthLayout>
      <h1>로그인</h1>
      <p className="auth2-sub">회사 이메일과 비밀번호로 로그인하세요.</p>
      {location.state?.message && !error && <AuthAlert type="success">{location.state.message}</AuthAlert>}
      {error && (
        <AuthAlert type={error.code === 'ACCOUNT_PENDING' ? 'info' : error.code === 'EMAIL_NOT_VERIFIED' ? 'warning' : 'error'} action={action}>
          {authErrorMessage(error)}{help && `\n${help}`}
        </AuthAlert>
      )}
      {resent && <AuthAlert type="success">{resent}</AuthAlert>}
      <form className="auth2-form" onSubmit={submit} noValidate>
        <AuthField label="이메일" type="email" name="email" autoComplete="username" inputMode="email" required value={email} error={emailError}
          placeholder="name@company.com" onChange={(event) => setEmail(event.target.value)} onBlur={() => setTouched(true)} />
        <AuthField label="비밀번호" type="password" name="password" autoComplete="current-password" required value={password}
          error={passwordMissing && !password ? '비밀번호를 입력하세요.' : ''} onChange={(event) => { setPassword(event.target.value); setPasswordMissing(false); }} />
        <div className="auth2-row">
          <label className="auth2-check"><input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} />로그인 유지</label>
          <Link className="auth2-link" to="/forgot-password" state={{ email }}>비밀번호 찾기</Link>
        </div>
        <label className="auth2-check"><input type="checkbox" checked={rememberEmail} onChange={(event) => setRememberEmail(event.target.checked)} />이 기기에서 이메일 기억하기</label>
        <p className="auth2-hint">로그인 유지를 켜면 로그아웃할 때까지 이어지고, 끄면 30분 뒤 다시 로그인합니다. 공용 PC에서는 둘 다 끄세요.</p>
        <button type="submit" className="ui-btn ui-btn--primary ui-btn--lg" disabled={loading}>{loading ? '로그인 중…' : '로그인'}</button>
      </form>
      <p className="auth2-foot">계정이 없으신가요? <Link className="auth2-link" to="/register">회원가입</Link></p>
    </AuthLayout>
  );
}
