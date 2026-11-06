import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { confirmEmailChange } from '../../api/auth';
import AuthLayout from '../../components/auth/auth-layout';
import AuthStatus from '../../components/auth/auth-status.jsx';

const COPY = {
  loading: ['loading', '이메일 변경 링크를 확인하고 있습니다', '잠시만 기다려 주세요.'],
  success: ['success', '이메일을 바꿨습니다', '다음 로그인부터 새 이메일을 쓰세요.'],
  expired: ['error', '링크가 만료됐습니다', '링크는 10분 동안만 쓸 수 있습니다. 내 정보에서 다시 요청하세요.'],
  used: ['info', '이미 사용한 링크입니다', '이메일 변경은 이미 처리됐습니다.'],
  invalid: ['error', '유효하지 않은 링크입니다', '메일의 링크를 다시 눌러 보거나 내 정보에서 다시 요청하세요.'],
};

/** 새 이메일로 간 링크로 이메일 변경 확인 (POST /auth/email/change/confirm) */
export default function VerifyEmailChange() {
  const [query] = useSearchParams();
  const token = query.get('token');
  const [status, setStatus] = useState(token ? 'loading' : 'invalid');
  useEffect(() => {
    if (!token) return;
    confirmEmailChange(token).then(() => setStatus('success')).catch((error) => setStatus(
      error.code === 'TOKEN_EXPIRED_LINK' ? 'expired' : error.code === 'TOKEN_ALREADY_USED' ? 'used' : 'invalid',
    ));
  }, [token]);
  const [kind, title, text] = COPY[status];
  return (
    <AuthLayout compact>
      <AuthStatus kind={kind} title={title}>{text}</AuthStatus>
      {status !== 'loading' && (
        <div className="auth2-actions">
          <Link className="ui-btn ui-btn--primary ui-btn--lg" to="/signin">로그인 화면으로</Link>
          {(status === 'expired' || status === 'invalid') && <p className="auth2-foot"><Link className="auth2-link" to="/me">로그인되어 있다면 내 정보로</Link></p>}
        </div>
      )}
    </AuthLayout>
  );
}
