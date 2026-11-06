import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { resendVerification } from '../../api/auth';
import { authErrorMessage } from '../../constants/auth-errors';
import AuthAlert from '../../components/auth/auth-alert';
import { AuthField } from '../../components/auth/auth-field.jsx';
import AuthLayout from '../../components/auth/auth-layout';
import SignupSteps from '../../components/auth/signup-steps.jsx';
import AuthStatus from '../../components/auth/auth-status.jsx';
import { useCooldown } from '../../hooks/use-cooldown.js';
import { validEmail } from '../../utils/auth-validation.js';

/** 가입 완료 → 인증 메일 안내 (POST /auth/email/verify/resend 로 다시 보내기, 60초 간격). 링크 만료 화면에서도 온다 */
export default function RegisterDone() {
  const location = useLocation();
  const known = location.state?.email ?? '';
  const [email, setEmail] = useState(known);
  const [message, setMessage] = useState(null);
  const [sending, setSending] = useState(false);
  const cooldown = useCooldown(60);
  const expired = Boolean(location.state?.expired);

  const resend = async (event) => {
    event.preventDefault();
    if (!validEmail(email) || sending || cooldown.remaining) return;
    setSending(true); setMessage(null);
    try {
      await resendVerification(email.trim());
      cooldown.start();
      setMessage({ type: 'success', text: `${email.trim()} 로 인증 메일을 다시 보냈습니다. 메일함과 스팸함을 확인하세요.` });
    } catch (error) { setMessage({ type: 'error', text: authErrorMessage(error) }); } finally { setSending(false); }
  };

  return (
    <AuthLayout compact>
      <AuthStatus kind="mail" title={expired ? '새 인증 메일을 받으세요' : '인증 메일을 보냈습니다'}>
        {known && !expired ? <><b>{known}</b> 로 보낸 링크를 눌러 인증을 마쳐 주세요. 링크는 10분 동안 쓸 수 있습니다.</> : '가입한 이메일을 적으면 새 인증 링크를 보냅니다. 링크는 10분 동안 쓸 수 있습니다.'}
      </AuthStatus>
      <SignupSteps current={1} />
      {message && <AuthAlert type={message.type}>{message.text}</AuthAlert>}
      <form className="auth2-form" onSubmit={resend} noValidate>
        {(!known || expired) && (
          <AuthField label="가입한 이메일" type="email" required autoComplete="email" value={email} placeholder="name@company.com"
            error={email && !validEmail(email) ? '이메일 형식으로 입력하세요.' : ''} onChange={(event) => setEmail(event.target.value)} />
        )}
        <button type="submit" className="ui-btn ui-btn--secondary ui-btn--lg" disabled={!validEmail(email) || sending || cooldown.remaining > 0}>
          {sending ? '보내는 중…' : cooldown.remaining ? `${cooldown.remaining}초 뒤 다시 보낼 수 있습니다` : '인증 메일 다시 보내기'}
        </button>
      </form>
      <p className="auth2-hint">메일이 안 오면 스팸함을 확인하세요. 메일이 막힌 환경이면 관리자가 직접 확인 후 인증 처리할 수 있습니다.</p>
      <p className="auth2-foot"><Link className="auth2-link" to="/signin" state={{ email }}>로그인 화면으로</Link></p>
    </AuthLayout>
  );
}
