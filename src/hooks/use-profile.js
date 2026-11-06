import { useEffect, useRef, useState } from 'react';
import { changePassword, getMe, requestEmailChange, updateMe } from '../api/users';
import { getNotificationPreferences, saveNotificationPreferences } from '../api/notifications';
import { setToken } from '../api/client';
import { refreshWorkSite } from '../api/workers';
import { authErrorMessage } from '../constants/auth-errors';
import { getDetailMessages, getFieldErrors } from '../utils/validation-details';
import { changedPreferences } from '../utils/profile-model.js';
import { useToast } from '../components/ui/toast-context.js';

const messageOf = (error, fallback) => getDetailMessages(error).join('\n') || authErrorMessage(error) || fallback;

/**
 * 내 정보 화면 상태와 동작.
 *  - GET /users/me 로 기본 정보·lockVersion·현장을, GET /notifications/preferences 로 알림 설정을 받는다
 *  - 내 정보 저장(PATCH /users/me)은 lockVersion 을 같이 보내고, 409 면 최신 정보를 다시 받아 알린다(자동 재저장 없음)
 *  - 비밀번호 변경(POST /auth/password/change)은 새 토큰을 받아 바꿔 끼운다
 *  - 이메일 변경은 새 주소로 확인 메일을 보낸다(링크를 눌러야 바뀜)
 *  - 저장하면 머리의 이름 등이 바뀌도록 계정 캐시를 새로 받는다
 */
export function useProfile() {
  const toast = useToast();
  const [me, setMe] = useState({ key: null, data: null, error: '' });
  const [prefs, setPrefs] = useState({ key: null, saved: null, current: null, error: '' });
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState('');
  const pending = useRef(false);
  const key = String(revision);

  useEffect(() => {
    let active = true;
    getMe().then((data) => { if (active) setMe({ key, data, error: '' }); })
      .catch((error) => { if (active) setMe({ key, data: null, error: messageOf(error, '내 정보를 불러오지 못했습니다.') }); });
    getNotificationPreferences().then((list) => { if (active) setPrefs({ key, saved: list, current: list, error: '' }); })
      .catch((error) => { if (active) setPrefs({ key, saved: null, current: null, error: error.message || '알림 설정을 불러오지 못했습니다.' }); });
    return () => { active = false; };
  }, [key]);

  /** 쓰기 한 번. 성공 { ok: true, value } / 실패 { ok: false, fieldErrors } */
  const run = async (kind, action, { success, fieldMap } = {}) => {
    if (pending.current) return { ok: false, fieldErrors: {} };
    pending.current = true; setBusy(kind);
    try {
      const value = await action();
      if (success) toast.show({ tone: 'success', message: success, duration: 6000 });
      return { ok: true, value };
    } catch (error) {
      const fieldErrors = getFieldErrors(error, fieldMap);
      if (!Object.keys(fieldErrors).length) toast.show({ tone: 'error', message: messageOf(error, '저장하지 못했습니다.'), duration: 8000 });
      return { ok: false, fieldErrors, error };
    } finally { pending.current = false; setBusy(''); }
  };

  const saveProfile = async (body) => {
    const result = await run('profile', async () => {
      const saved = await updateMe({ ...body, lockVersion: me.data.lockVersion });
      setMe((current) => ({ ...current, data: saved }));
      refreshWorkSite();
      return saved;
    }, { success: '내 정보를 저장했습니다.' });
    if (!result.ok && result.error?.status === 409) {
      toast.show({ tone: 'info', message: '다른 곳에서 먼저 바뀌었습니다. 최신 정보로 다시 불러왔으니 확인 후 다시 저장하세요.', duration: 9000 });
      setRevision((value) => value + 1);
    }
    return result;
  };

  const savePassword = (body) => run('password', async () => {
    const token = await changePassword(body);
    if (token?.accessToken) setToken(token.accessToken, token.expiresIn);
    return true;
  }, { success: '비밀번호를 바꿨습니다. 다음 로그인부터 새 비밀번호를 쓰세요.', fieldMap: { newPassword: 'newPassword' } });

  const sendEmailChange = (body) => run('email', () => requestEmailChange(body.newEmail, body.currentPassword),
    { success: `${body.newEmail} 로 확인 메일을 보냈습니다. 10분 안에 링크를 눌러야 바뀝니다.` });

  const togglePreference = (type, field, value) => setPrefs((current) => ({
    ...current, current: current.current.map((entry) => (entry.type === type ? { ...entry, [field]: value } : entry)),
  }));
  const savePreferences = () => run('prefs', async () => {
    const changes = changedPreferences(prefs.saved, prefs.current);
    const saved = await saveNotificationPreferences(changes);
    setPrefs((current) => ({ ...current, saved, current: saved }));
    return saved;
  }, { success: '알림 받기 설정을 저장했습니다.' });

  const loading = me.key !== key;
  return {
    me: loading ? null : me.data, error: loading ? '' : me.error, loading, busy, reload: () => setRevision((value) => value + 1),
    saveProfile, savePassword, sendEmailChange,
    prefs: prefs.key === key ? prefs.current : null, prefsError: prefs.key === key ? prefs.error : '', prefsLoading: prefs.key !== key,
    prefsChanged: Boolean(prefs.saved && prefs.current && changedPreferences(prefs.saved, prefs.current).length),
    togglePreference, savePreferences, resetPreferences: () => setPrefs((current) => ({ ...current, current: current.saved })),
  };
}
