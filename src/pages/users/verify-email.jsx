import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { verifyEmail } from '../../api/auth';
import AuthLayout from '../../components/auth/auth-layout';
import SignupSteps from '../../components/auth/signup-steps.jsx';
import AuthStatus from '../../components/auth/auth-status.jsx';

const COPY = {
  loading: ['loading', '인증 링크를 확인하고 있습니다', '잠시만 기다려 주세요.'],
  success: ['success', '이메일 인증을 마쳤습니다', '이제 관리자가 현장과 역할을 정하면 로그인할 수 있습니다.'],
  expired: ['error', '인증 링크가 만료됐습니다', '링크는 10분 동안만 쓸 수 있습니다. 새 링크를 받으세요.'],
  used: ['info', '이미 인증한 링크입니다', '인증은 끝났습니다. 로그인 화면에서 승인 상태를 확인하세요.'],
  invalid: ['error', '유효하지 않은 링크입니다', '메일의 링크를 다시 눌러 보거나 새 링크를 받으세요.'],
};

/** 메일 링크로 이메일 인증 (POST /auth/email/verify). 만료·잘못된 링크면 새 인증 메일을 바로 받으러 간다 */
export default function VerifyEmail() {
  const [query] = useSearchParams();
  const token = query.get('token');
  const [status, setStatus] = useState(token ? 'loading' : 'invalid');
  useEffect(() => {
    if (!token) return;
    verifyEmail(token).then(() => setStatus('success')).catch((error) => setStatus(
      error.code === 'TOKEN_EXPIRED_LINK' ? 'expired' : error.code === 'TOKEN_ALREADY_USED' ? 'used' : 'invalid',
    ));
  }, [token]);
  const [kind, title, text] = COPY[status];
  return (
    <AuthLayout compact>
      <AuthStatus kind={kind} title={title}>{text}</AuthStatus>
      {(status === 'success' || status === 'used') && <SignupSteps current={2} />}
      {status !== 'loading' && (
        <div className="auth2-actions">
          {(status === 'expired' || status === 'invalid')
            ? <Link className="ui-btn ui-btn--primary ui-btn--lg" to="/register/done" state={{ expired: true }}>새 인증 메일 받기</Link>
            : <Link className="ui-btn ui-btn--primary ui-btn--lg" to="/signin">로그인 화면으로</Link>}
          {(status === 'expired' || status === 'invalid') && <p className="auth2-foot"><Link className="auth2-link" to="/signin">로그인 화면으로</Link></p>}
        </div>
      )}
    </AuthLayout>
  );
}
