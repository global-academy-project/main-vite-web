import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  dismissNotification, getNotificationPreferences, getNotifications, getUnreadCount,
  readAllNotifications, readNotification, saveNotificationPreferences,
} from '../api/notifications';
import { getCachedCurrentUser, refreshWorkSite } from '../api/workers';
import { setLastSite } from '../api/users';
import { useToast } from '../components/ui/toast-context.js';

const POLL_MS = 30000;

/**
 * 알림함 상태와 동작. 기존 notification-bell.jsx 의 규칙을 그대로 옮겼다.
 *  - 안 읽은 수는 30초마다 조회 (변경 요청 중에는 건너뜀)
 *  - 목록·받기 설정은 열 때 조회, "안 읽은 알림만" 이 바뀌면 다시 조회
 *  - 변경은 한 번에 하나만. 응답을 못 받으면(WRITE_OUTCOME_UNKNOWN) 새로고침 전까지 잠근다 (자동 재전송 없음)
 *  - 대상 기록으로 갈 때 다른 현장 알림이면 권한을 다시 확인하고 현장을 바꾼 뒤 이동
 */
export function useNotifications() {
  const navigate = useNavigate();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(null);
  const [countError, setCountError] = useState('');
  const [result, setResult] = useState(null);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [settings, setSettings] = useState(null);
  const [savedSettings, setSavedSettings] = useState(null);
  const [sites, setSites] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [revision, setRevision] = useState(0);
  const pending = useRef(false);
  const mounted = useRef(false);
  const key = `${unreadOnly}:${revision}`;
  const loaded = result?.key === key;

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    let active = true;
    let timer;
    const poll = async () => {
      if (!pending.current) {
        try {
          const count = await getUnreadCount();
          if (active && !pending.current) { setUnreadCount(count); setCountError(''); }
        } catch (requestError) {
          if (active) setCountError(requestError.message || '알림 수 조회에 실패했습니다.');
        }
      }
      if (active) timer = setTimeout(poll, POLL_MS);
    };
    void poll();
    return () => { active = false; clearTimeout(timer); };
  }, [revision]);

  useEffect(() => {
    if (!open) return;
    let active = true;
    Promise.all([getNotifications({ unreadOnly }), getNotificationPreferences()]).then(([list, prefs]) => {
      if (active) { setResult({ key, data: list }); setSettings(prefs); setSavedSettings(prefs); }
    }).catch((requestError) => {
      if (active) setResult({ key, error: requestError.message || '알림 조회에 실패했습니다.' });
    });
    // 현장 이름 표시용. 못 받아도 목록은 보인다 (현장 #id 로 표시)
    getCachedCurrentUser().then((account) => { if (active) setSites(account.sites); }).catch(() => {});
    return () => { active = false; };
  }, [open, unreadOnly, key]);

  const run = async (action, success) => {
    if (pending.current || blocked || !loaded || result.error) return false;
    pending.current = true; setBusy(true); setError('');
    try {
      await action();
      if (mounted.current) {
        if (success) toast.show({ tone: 'success', message: success });
        setRevision((value) => value + 1);
      }
      return true;
    } catch (requestError) {
      if (mounted.current) {
        setError(requestError.message || '알림 변경에 실패했습니다.');
        if (requestError.code === 'WRITE_OUTCOME_UNKNOWN') setBlocked(true);
      }
      return false;
    } finally { pending.current = false; if (mounted.current) setBusy(false); }
  };

  const refresh = async () => {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError('');
    try {
      const [list, prefs, count] = await Promise.all([
        getNotifications({ unreadOnly }), getNotificationPreferences(), getUnreadCount(),
      ]);
      if (mounted.current) {
        setResult({ key, data: list }); setSettings(prefs); setSavedSettings(prefs); setUnreadCount(count); setCountError('');
        setBlocked(false);
        toast.show({ tone: 'info', message: '최신 알림과 설정을 불러왔습니다. 반영 여부를 확인하세요.' });
      }
    } catch (requestError) {
      if (mounted.current) setError(requestError.message || '알림 재조회에 실패했습니다.');
    } finally { pending.current = false; if (mounted.current) setBusy(false); }
  };

  const openRecord = (notification, path) => run(async () => {
    if (notification.siteId != null) {
      const account = await getCachedCurrentUser({ force: true });
      if (!account.sites.some((site) => site.siteId === notification.siteId)) throw new Error('알림 대상 현장 권한이 없습니다.');
      if (account.currentSiteId !== notification.siteId) {
        await setLastSite(notification.siteId);
        refreshWorkSite();
      }
    }
    if (!notification.readAt) await readNotification(notification.id);
    if (mounted.current) { setOpen(false); navigate(path); }
  }, '');

  const dismiss = (notification) => {
    if (notification.severity === 'CRITICAL' && !window.confirm('안전 중요 알림을 목록에서 끕니까? 내용을 확인한 후 진행하세요.')) return;
    void run(() => dismissNotification(notification.id), '알림을 목록에서 껐습니다.');
  };

  const settingsDirty = Boolean(settings && savedSettings) && JSON.stringify(settings) !== JSON.stringify(savedSettings);
  const toggleSetting = (type, field, value) => setSettings((current) => current.map((row) => (row.type === type ? { ...row, [field]: value } : row)));

  return {
    open, setOpen, toggle: () => setOpen((value) => !value),
    unreadCount, countError, unreadOnly, setUnreadOnly,
    loaded, items: loaded && !result.error ? result.data.items : [], listError: loaded ? result.error ?? '' : '',
    settings, settingsDirty, toggleSetting, resetSettings: () => setSettings(savedSettings),
    sites, error, busy, blocked, locked: busy || blocked || !loaded || Boolean(result?.error),
    refresh: () => { void refresh(); },
    readOne: (notification) => { void run(() => readNotification(notification.id), '읽음으로 표시했습니다.'); },
    readAll: () => { void run(readAllNotifications, '전체 현장 알림을 모두 읽음 처리했습니다.'); },
    dismiss,
    openRecord: (notification, path) => { void openRecord(notification, path); },
    saveSettings: () => run(() => saveNotificationPreferences(settings), '알림 설정을 저장했습니다.'),
  };
}
