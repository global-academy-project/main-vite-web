import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { resetPassword } from '../../api/auth';
import { authErrorMessage } from '../../constants/auth-errors';
import AuthAlert from '../../components/auth/auth-alert';
import { AuthField, PasswordChecklist } from '../../components/auth/auth-field.jsx';
import AuthLayout from '../../components/auth/auth-layout';
import AuthStatus from '../../components/auth/auth-status.jsx';
import { validPassword } from '../../utils/auth-validation.js';
import { getDetailMessages, getFieldErrors } from '../../utils/validation-details';

const LINK_ERRORS = ['TOKEN_EXPIRED_LINK', 'TOKEN_INVALID', 'TOKEN_ALREADY_USED'];

/** 메일 링크로 새 비밀번호 정하기 (POST /auth/password/reset). 성공하면 로그인 화면에 안내를 띄운다 */
export default function ResetPassword() {
  const [query] = useSearchParams();
  const navigate = useNavigate();
  const token = query.get('token');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState({});
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  if (!token || (error && LINK_ERRORS.includes(error.code))) {
    return (
      <AuthLayout compact>
        <AuthStatus kind="error" title={error?.code === 'TOKEN_EXPIRED_LINK' ? '링크가 만료됐습니다' : '쓸 수 없는 링크입니다'}>
          {error ? authErrorMessage(error) : '비밀번호 재설정 링크가 없습니다.'} 비밀번호 찾기에서 새 링크를 받으세요.
        </AuthStatus>
        <div className="auth2-actions"><Link className="ui-btn ui-btn--primary ui-btn--lg" to="/forgot-password">새 링크 받기</Link></div>
      </AuthLayout>
    );
  }

  const submit = async (event) => {
    event.preventDefault();
    const next = {};
    if (!validPassword(password)) next.password = '비밀번호 규칙을 모두 지켜 주세요.';
    if (password !== confirm) next.confirm = '비밀번호가 서로 다릅니다.';
    setErrors(next);
    if (Object.keys(next).length || loading) return;
    setLoading(true); setError(null);
    try {
      await resetPassword(token, password);
      navigate('/signin', { replace: true, state: { message: '비밀번호를 바꿨습니다. 새 비밀번호로 로그인하세요.' } });
    } catch (requestError) {
      const fieldErrors = getFieldErrors(requestError, { newPassword: 'password' });
      setErrors(fieldErrors);
      if (!Object.keys(fieldErrors).length) setError(requestError);
    } finally { setLoading(false); }
  };

  return (
    <AuthLayout compact>
      <h1>새 비밀번호 정하기</h1>
      <p className="auth2-sub">바꾸면 다른 기기의 로그인은 모두 끊깁니다.</p>
      {error && <AuthAlert type="error">{getDetailMessages(error).join('\n') || authErrorMessage(error)}</AuthAlert>}
      <form className="auth2-form" onSubmit={submit} noValidate>
        <AuthField label="새 비밀번호" type="password" required autoComplete="new-password" maxLength={64} autoFocus value={password} error={errors.password} onChange={(event) => setPassword(event.target.value)} />
        <AuthField label="새 비밀번호 확인" type="password" required autoComplete="new-password" maxLength={64} value={confirm} error={errors.confirm} onChange={(event) => setConfirm(event.target.value)} />
        <PasswordChecklist value={password} confirm={confirm} />
        <button type="submit" className="ui-btn ui-btn--primary ui-btn--lg" disabled={loading}>{loading ? '바꾸는 중…' : '비밀번호 바꾸기'}</button>
      </form>
    </AuthLayout>
  );
}
