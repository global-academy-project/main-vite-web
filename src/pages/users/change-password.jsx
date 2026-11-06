import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { logout } from '../../api/auth';
import { changePassword, getMe } from '../../api/users';
import { clearToken, setToken } from '../../api/client';
import { authErrorMessage } from '../../constants/auth-errors';
import AuthAlert from '../../components/auth/auth-alert';
import { AuthField, PasswordChecklist } from '../../components/auth/auth-field.jsx';
import AuthLayout from '../../components/auth/auth-layout';
import { validPassword } from '../../utils/auth-validation.js';
import { getDetailMessages, getFieldErrors } from '../../utils/validation-details';

/**
 * 비밀번호 변경 (POST /auth/password/change). 주로 임시 비밀번호로 로그인했을 때 강제로 오는 화면.
 * 평소 변경은 내 정보 화면 안에서 한다. 바꾸면 이 기기에는 새 토큰을 받아 그대로 이어진다.
 */
export default function ChangePassword() {
  const navigate = useNavigate();
  const [must, setMust] = useState(false);
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const set = (field) => (event) => setForm({ ...form, [field]: event.target.value });

  useEffect(() => {
    getMe().then((me) => setMust(me?.user?.mustChangePassword === true)).catch(() => {});
  }, []);

  const doLogout = async () => {
    try { await logout(); } finally { clearToken(); navigate('/signin', { replace: true }); }
  };

  const submit = async (event) => {
    event.preventDefault();
    const next = {};
    if (!form.currentPassword) next.currentPassword = must ? '받은 임시 비밀번호를 입력하세요.' : '현재 비밀번호를 입력하세요.';
    if (!validPassword(form.newPassword)) next.newPassword = '비밀번호 규칙을 모두 지켜 주세요.';
    else if (form.newPassword === form.currentPassword) next.newPassword = '지금 비밀번호와 다르게 정하세요.';
    if (form.newPassword !== form.confirm) next.confirm = '비밀번호가 서로 다릅니다.';
    setErrors(next);
    if (Object.keys(next).length || loading) return;
    setLoading(true); setError(null);
    try {
      const result = await changePassword({ currentPassword: form.currentPassword, newPassword: form.newPassword });
      setToken(result.accessToken, result.expiresIn);
      navigate('/dashboard', { replace: true });
    } catch (requestError) {
      const fieldErrors = getFieldErrors(requestError, { newPassword: 'newPassword' });
      if (requestError.code === 'PASSWORD_MISMATCH') fieldErrors.currentPassword = authErrorMessage(requestError);
      setErrors(fieldErrors);
      if (!Object.keys(fieldErrors).length) setError(requestError);
    } finally { setLoading(false); }
  };

  return (
    <AuthLayout compact>
      <h1>비밀번호 변경</h1>
      {must
        ? <AuthAlert type="warning">임시 비밀번호로 로그인했습니다. 계속하려면 새 비밀번호를 정하세요.</AuthAlert>
        : <p className="auth2-sub">바꾸면 다른 기기의 로그인은 끊기고, 이 기기는 그대로 이어집니다.</p>}
      {error && <AuthAlert type="error">{getDetailMessages(error).join('\n') || authErrorMessage(error)}</AuthAlert>}
      <form className="auth2-form" onSubmit={submit} noValidate>
        <AuthField label={must ? '임시 비밀번호' : '현재 비밀번호'} type="password" required autoComplete="current-password" autoFocus
          value={form.currentPassword} error={errors.currentPassword} onChange={set('currentPassword')} />
        <AuthField label="새 비밀번호" type="password" required autoComplete="new-password" maxLength={64} value={form.newPassword} error={errors.newPassword} onChange={set('newPassword')} />
        <AuthField label="새 비밀번호 확인" type="password" required autoComplete="new-password" maxLength={64} value={form.confirm} error={errors.confirm} onChange={set('confirm')} />
        <PasswordChecklist value={form.newPassword} confirm={form.confirm} />
        <button type="submit" className="ui-btn ui-btn--primary ui-btn--lg" disabled={loading}>{loading ? '바꾸는 중…' : '비밀번호 바꾸기'}</button>
      </form>
      <p className="auth2-foot">
        {!must && <><Link className="auth2-link" to="/me">내 정보로 돌아가기</Link> · </>}
        <button type="button" className="auth2-link" onClick={doLogout}>로그아웃</button>
      </p>
    </AuthLayout>
  );
}
