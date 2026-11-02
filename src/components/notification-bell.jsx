import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  dismissNotification, getNotificationPreferences, getNotifications, getUnreadCount,
  readAllNotifications, readNotification, saveNotificationPreferences,
} from '../api/notifications';
import { getCachedCurrentUser, refreshWorkSite } from '../api/workers';
import { setLastSite } from '../api/users';
import { jobRecordPath } from '../utils/job-forms';
import '../style/notification-bell.css';

const labels = {
  APPROVAL_REQUEST: '승인 요청', APPROVAL_RESULT: '승인 결과', BLOCKED: '작업 차단',
  NEAR_MISS_WARNING: '아차사고 경고', DEADLINE: '마감', ACTION_DUE: '조치 기한',
  AGENT_DONE: 'AI 처리 완료', DOCUMENT_READY: '문서 준비', JOB_FAILED: '작업 실패', ACCOUNT: '계정', SYSTEM: '시스템',
};

export default function NotificationBell() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(null);
  const [countError, setCountError] = useState('');
  const [result, setResult] = useState(null);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [settings, setSettings] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
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
      if (active) timer = setTimeout(poll, 30000);
    };
    void poll();
    return () => { active = false; clearTimeout(timer); };
  }, [revision]);

  useEffect(() => {
    if (!open) return;
    let active = true;
    Promise.all([getNotifications({ unreadOnly }), getNotificationPreferences()]).then(([list, prefs]) => {
      if (active) {
        setResult({ key, data: list }); setSettings(prefs);
      }
    }).catch((requestError) => {
      if (active) setResult({ key, error: requestError.message || '알림 조회에 실패했습니다.' });
    });
    return () => { active = false; };
  }, [open, unreadOnly, key]);

  const run = async (action, success) => {
    if (pending.current || blocked || !loaded || result.error) return;
    pending.current = true; setBusy(true); setError(''); setMessage('');
    try {
      await action();
      if (mounted.current) { setMessage(success); setRevision((value) => value + 1); }
    } catch (requestError) {
      if (mounted.current) {
        setError(requestError.message || '알림 변경에 실패했습니다.');
        if (requestError.code === 'WRITE_OUTCOME_UNKNOWN') setBlocked(true);
      }
    } finally { pending.current = false; if (mounted.current) setBusy(false); }
  };
  const refresh = async () => {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError(''); setMessage('');
    try {
      const [list, prefs, count] = await Promise.all([
        getNotifications({ unreadOnly }), getNotificationPreferences(), getUnreadCount(),
      ]);
      if (mounted.current) {
        setResult({ key, data: list }); setSettings(prefs); setUnreadCount(count); setCountError('');
        setBlocked(false); setMessage('최신 알림과 설정을 불러왔습니다. 반영 여부를 확인하세요.');
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
    await readNotification(notification.id);
    if (mounted.current) { setOpen(false); navigate(path); }
  }, '알림을 읽고 기록 화면으로 이동했습니다.');
  const locked = busy || blocked || !loaded || Boolean(result?.error);

  return <div className="notification-container">
    <button type="button" className="notification" aria-label={countError ? '알림 열기 (조회 오류)'
      : `알림 열기 (안 읽음 ${unreadCount ?? '미조회'})`} aria-expanded={open} aria-controls="notification-panel"
    onClick={() => setOpen((value) => !value)}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 17h12l-2-3V9a4 4 0 0 0-8 0v5l-2 3Z" /><path d="M10 20h4" /></svg>
      <span className="notification-count">{countError ? '!' : unreadCount ?? '?'}</span>
    </button>
    {open && <section id="notification-panel" className="notification-panel" aria-label="내 알림">
      <div className="notification-toolbar"><h2>내 알림</h2><button type="button" onClick={() => setOpen(false)}>닫기</button></div>
      <p>안 읽은 알림: {countError ? '조회 실패' : unreadCount ?? '조회 중'} · 30초마다 수 조회</p>
      {countError && <p role="alert">{countError}</p>}
      {error && <p role="alert">{error}</p>}{message && <p role="status">{message}</p>}
      {blocked && <p role="alert">변경 결과가 불확실합니다. 새로고침 후 반영 여부를 확인하세요. 자동 재전송하지 않습니다.</p>}
      <div className="notification-toolbar">
        <button type="button" disabled={busy} onClick={() => { void refresh(); }}>새로고침 (설정 편집 초기화)</button>
        <button type="button" disabled={locked} onClick={() => { void run(readAllNotifications, '전체 현장 알림을 모두 읽음 처리했습니다.'); }}>모두 읽음</button>
      </div>
      <label><input type="checkbox" checked={unreadOnly} disabled={busy} onChange={(event) => setUnreadOnly(event.target.checked)} />안 읽은 알림만</label>
      <p>권한 있는 모든 현장의 최신 알림입니다. 서버의 최대 목록 범위 내에서 표시합니다.</p>
      {!loaded ? <p role="status">알림 조회 중...</p> : result.error ? <p role="alert">{result.error}</p>
        : result.data.items.length ? <ul className="notification-list">{result.data.items.map((notification) => {
          const path = jobRecordPath(notification.targetType, notification.targetId);
          return <li key={notification.id}>
            <h3>{notification.title}</h3>
            <p>{labels[notification.type]} · {notification.severity} · {notification.readAt ? '읽음' : '안 읽음'}
              {notification.siteId != null && ` · 현장 #${notification.siteId}`}</p>
            <p>{notification.message}</p><p>{notification.createdAt}</p>
            <div className="notification-toolbar">
              {path ? <button type="button" disabled={locked} onClick={() => { void openRecord(notification, path); }}>대상 기록 조회</button>
                : notification.targetId != null && <span>대상 화면 미지원: {notification.targetType} #{notification.targetId}</span>}
              <button type="button" disabled={locked || Boolean(notification.readAt)} onClick={() => {
                void run(() => readNotification(notification.id), '알림을 읽음 처리했습니다.');
              }}>읽음</button>
              <button type="button" disabled={locked} onClick={() => {
                if (notification.severity === 'CRITICAL' && !window.confirm('안전 중요 알림을 목록에서 끕니까? 내용을 확인한 후 진행하세요.')) return;
                void run(() => dismissNotification(notification.id), '알림을 목록에서 껐습니다.');
              }}>끄기</button>
            </div>
          </li>;
        })}</ul> : <p>표시할 알림이 없습니다.</p>}
      {settings && <details><summary>종류별 받기 설정</summary>
        <p>안전 필수 웹 알림은 끌 수 없습니다. 문자 설정은 수신 선호이며 실제 문자 발송을 보장하지 않습니다.</p>
        <form onSubmit={(event) => {
          event.preventDefault(); void run(() => saveNotificationPreferences(settings), '알림 설정을 저장했습니다.');
        }}>
          <fieldset disabled={locked}>
            {settings.map((entry) => <div key={entry.type}>
              <strong>{labels[entry.type]}{entry.mandatory && ' (필수)'}</strong>
              {['webEnabled', 'smsEnabled'].map((field) => <label key={field}>
                <input type="checkbox" checked={entry[field]} disabled={field === 'webEnabled' && entry.mandatory}
                  onChange={(event) => setSettings((current) => current.map((row) => row.type === entry.type
                    ? { ...row, [field]: event.target.checked } : row))} />{field === 'webEnabled' ? '웹' : '문자'}
              </label>)}
            </div>)}
            <button type="submit">받기 설정 저장</button>
          </fieldset>
        </form>
      </details>}
    </section>}
  </div>;
}
