import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { forgotPassword } from '../../api/auth';
import { authErrorMessage } from '../../constants/auth-errors';
import AuthAlert from '../../components/auth/auth-alert';
import { AuthField } from '../../components/auth/auth-field.jsx';
import AuthLayout from '../../components/auth/auth-layout';
import AuthStatus from '../../components/auth/auth-status.jsx';
import { useCooldown } from '../../hooks/use-cooldown.js';
import { validEmail } from '../../utils/auth-validation.js';

/**
 * 비밀번호 찾기 (POST /auth/password/forgot). 서버는 계정이 있든 없든 같은 응답을 준다(가입 여부를 알려 주지 않음).
 * 편의: 로그인 화면에서 쓴 이메일을 미리 채움, 보낸 뒤 60초 뒤 다시 보내기.
 */
export default function ForgotPassword() {
  const location = useLocation();
  const [email, setEmail] = useState(location.state?.email ?? '');
  const [touched, setTouched] = useState(false);
  const [sentTo, setSentTo] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const cooldown = useCooldown(60);
  const emailError = touched && !validEmail(email) ? (email ? 'name@company.com 같은 이메일 형식으로 입력하세요.' : '가입할 때 쓴 이메일을 입력하세요.') : '';

  const send = async (event) => {
    event?.preventDefault();
    setTouched(true);
    if (!validEmail(email) || loading || cooldown.remaining) return;
    setLoading(true); setError('');
    try {
      await forgotPassword(email.trim());
      setSentTo(email.trim()); cooldown.start();
    } catch (requestError) { setError(authErrorMessage(requestError)); } finally { setLoading(false); }
  };

  if (sentTo) {
    return (
      <AuthLayout compact>
        <AuthStatus kind="mail" title="재설정 메일을 보냈습니다"><b>{sentTo}</b> 로 가입된 계정이 있으면 비밀번호 재설정 링크를 보냈습니다. 링크는 10분 동안 한 번만 쓸 수 있습니다.</AuthStatus>
        {error && <AuthAlert type="error">{error}</AuthAlert>}
        <div className="auth2-actions">
          <button type="button" className="ui-btn ui-btn--secondary ui-btn--lg" disabled={loading || cooldown.remaining > 0} onClick={() => send()}>
            {cooldown.remaining ? `${cooldown.remaining}초 뒤 다시 보낼 수 있습니다` : '메일 다시 보내기'}
          </button>
          <p className="auth2-foot"><button type="button" className="auth2-link" onClick={() => setSentTo('')}>다른 이메일로 보내기</button> · <Link className="auth2-link" to="/signin" state={{ email: sentTo }}>로그인 화면으로</Link></p>
        </div>
      </AuthLayout>
    );
  }
  return (
    <AuthLayout compact>
      <h1>비밀번호 찾기</h1>
      <p className="auth2-sub">가입한 이메일로 비밀번호 재설정 링크를 보내 드립니다.</p>
      {error && <AuthAlert type="error">{error}</AuthAlert>}
      <form className="auth2-form" onSubmit={send} noValidate>
        <AuthField label="이메일" type="email" required autoComplete="email" inputMode="email" placeholder="name@company.com" autoFocus
          value={email} error={emailError} onChange={(event) => setEmail(event.target.value)} onBlur={() => setTouched(true)} />
        <button type="submit" className="ui-btn ui-btn--primary ui-btn--lg" disabled={loading}>{loading ? '보내는 중…' : '재설정 링크 보내기'}</button>
      </form>
      <p className="auth2-hint">잠긴 계정도 비밀번호를 재설정하면 다시 로그인할 수 있습니다.</p>
      <p className="auth2-foot"><Link className="auth2-link" to="/signin" state={{ email }}>로그인 화면으로</Link></p>
    </AuthLayout>
  );
}
