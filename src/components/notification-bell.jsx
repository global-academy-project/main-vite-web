import { useEffect, useRef, useState } from 'react';
import { useNotifications } from '../hooks/use-notifications.js';
import Icon from './ui/icon.jsx';
import StatusView, { Skeleton } from './ui/status-view.jsx';
import {
  badgeText, groupNotifications, NOTIFICATION_TYPE_LABELS, notificationTarget, relativeTime, severityOf, siteLabel,
} from '../utils/notification-model.js';
import '../style/notification-bell.css';

/**
 * 머리말 알림함. PC·태블릿은 종 아래 드롭다운, 모바일(≤640)은 화면 전체 패널.
 * 목록(오늘·어제·이전) ↔ 받기 설정 두 화면. 상태와 서버 요청은 use-notifications.
 */
export default function NotificationBell() {
  const notes = useNotifications();
  const { open, setOpen } = notes;
  const [view, setView] = useState('list');
  const containerRef = useRef(null);
  const buttonRef = useRef(null);
  const panelRef = useRef(null);
  const badge = badgeText(notes.unreadCount);

  useEffect(() => {
    if (!open) return undefined;
    panelRef.current?.focus();
    const close = () => { setOpen(false); buttonRef.current?.focus(); };
    const onKey = (event) => { if (event.key === 'Escape') close(); };
    const onDown = (event) => { if (!containerRef.current?.contains(event.target)) setOpen(false); };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('mousedown', onDown); };
  }, [open, setOpen]);

  const close = () => { setOpen(false); buttonRef.current?.focus(); };

  return (
    <div className="notification-container" ref={containerRef}>
      <button ref={buttonRef} type="button" className="notification"
        aria-label={notes.countError ? '알림 열기 (안 읽은 수 조회 오류)' : `알림 열기 (안 읽음 ${notes.unreadCount ?? '조회 중'})`}
        aria-expanded={open} aria-controls="notification-panel" onClick={() => { setView('list'); notes.toggle(); }}>
        <Icon name="bell" size={20} strokeWidth={1.8} />
        {notes.countError ? <span className="notification-count notification-count--error" aria-hidden="true">!</span>
          : badge && <span className="notification-count" aria-hidden="true">{badge}</span>}
      </button>
      {open && (
        <>
          <div className="notif-scrim" aria-hidden="true" onClick={close} />
          <section id="notification-panel" ref={panelRef} className="notif-panel" role="dialog" aria-label={view === 'list' ? '알림' : '알림 받기 설정'} tabIndex={-1}>
            {view === 'list'
              ? <NotificationList notes={notes} onSettings={() => setView('settings')} onClose={close} />
              : <NotificationSettings notes={notes} onBack={() => setView('list')} onClose={close} />}
          </section>
        </>
      )}
    </div>
  );
}

function Alerts({ notes }) {
  return (
    <>
      {notes.countError && <p className="notif-alert" role="alert"><Icon name="alert" size={16} />안 읽은 수: {notes.countError}</p>}
      {notes.error && <p className="notif-alert" role="alert"><Icon name="alert" size={16} />{notes.error}</p>}
      {notes.blocked && <p className="notif-alert" role="alert"><Icon name="warning" size={16} />변경 결과가 불확실합니다. 새로고침 후 반영 여부를 확인하세요. 자동 재전송하지 않습니다.</p>}
    </>
  );
}

function NotificationList({ notes, onSettings, onClose }) {
  const groups = groupNotifications(notes.items);
  const unread = notes.unreadCount ?? 0;
  return (
    <>
      <header className="notif-head">
        <div className="notif-head__title">
          <h2>알림</h2>
          {unread > 0 && <span className="notif-pill">안 읽음 {unread > 99 ? '99+' : unread}</span>}
        </div>
        <div className="notif-head__actions">
          <button type="button" className="ui-icon-btn" aria-label="새로고침 (설정 편집 초기화)" title="새로고침" disabled={notes.busy} onClick={notes.refresh}><Icon name="refresh" size={18} /></button>
          <button type="button" className="ui-icon-btn" aria-label="받기 설정" title="받기 설정" disabled={!notes.settings} onClick={onSettings}><Icon name="site" size={18} /></button>
          <button type="button" className="ui-icon-btn" aria-label="알림 닫기" title="닫기" onClick={onClose}><Icon name="close" size={18} /></button>
        </div>
      </header>
      <div className="notif-bar">
        <div className="notif-seg" role="group" aria-label="알림 보기">
          <button type="button" aria-pressed={!notes.unreadOnly} disabled={notes.busy} onClick={() => notes.setUnreadOnly(false)}>전체</button>
          <button type="button" aria-pressed={notes.unreadOnly} disabled={notes.busy} onClick={() => notes.setUnreadOnly(true)}>안 읽음</button>
        </div>
        <button type="button" className="notif-text-btn" disabled={notes.locked || unread === 0} onClick={notes.readAll}><Icon name="check" size={16} />모두 읽음</button>
      </div>
      <Alerts notes={notes} />
      <div className="notif-body">
        {!notes.loaded && <div className="notif-pad" role="status" aria-label="알림 조회 중"><Skeleton lines={5} height={18} /></div>}
        {notes.listError && <StatusView kind="error" message={notes.listError} onRetry={notes.refresh} />}
        {notes.loaded && !notes.listError && !notes.items.length && (
          <StatusView kind="empty" title={notes.unreadOnly ? '안 읽은 알림이 없습니다' : '표시할 알림이 없습니다'} message="새 알림이 오면 여기에 표시됩니다." />
        )}
        {groups.map((group) => (
          <section key={group.label} className="notif-group" aria-label={group.label}>
            <h3 className="notif-group__title">{group.label}</h3>
            <ul className="notif-list">
              {group.items.map((notification) => <NotificationItem key={notification.id} notification={notification} notes={notes} />)}
            </ul>
          </section>
        ))}
      </div>
      <footer className="notif-foot">권한 있는 모든 현장의 최신 알림 · 안 읽은 수는 30초마다 갱신</footer>
    </>
  );
}

function NotificationItem({ notification, notes }) {
  const severity = severityOf(notification.severity);
  const target = notificationTarget(notification);
  const unread = !notification.readAt;
  const site = siteLabel(notification.siteId, notes.sites);
  return (
    <li className={`notif-item notif-item--${severity.tone}${unread ? ' is-unread' : ''}`}>
      <span className="notif-item__icon" aria-hidden="true"><Icon name={severity.icon} size={18} /></span>
      <div className="notif-item__body">
        <p className="notif-item__meta">
          <span className="notif-item__type">{NOTIFICATION_TYPE_LABELS[notification.type] ?? notification.type}</span>
          {notification.severity !== 'INFO' && <span className="notif-item__sev">{severity.label}</span>}
          {site && <span className="notif-item__site">{site}</span>}
          <time className="notif-item__time" dateTime={notification.createdAt ?? undefined}>{relativeTime(notification.createdAt)}</time>
        </p>
        <p className="notif-item__title">
          {unread && <span className="notif-dot"><span className="sr-only">안 읽음</span></span>}
          {notification.title}
        </p>
        {notification.message && <p className="notif-item__msg">{notification.message}</p>}
        <div className="notif-item__actions">
          {target
            ? <button type="button" className="ui-btn ui-btn--secondary notif-item__open" disabled={notes.locked} onClick={() => notes.openRecord(notification, target.path)}>{target.label}<Icon name="send" size={14} /></button>
            : notification.targetId != null && <span className="notif-item__note">이 화면에서 열 수 없는 기록 ({notification.targetType} #{notification.targetId})</span>}
          <span className="notif-item__spacer" />
          <button type="button" className="notif-text-btn" disabled={notes.locked || !unread} onClick={() => notes.readOne(notification)}>{unread ? '읽음 표시' : '읽음'}</button>
          <button type="button" className="notif-text-btn" disabled={notes.locked} onClick={() => notes.dismiss(notification)}>끄기</button>
        </div>
      </div>
    </li>
  );
}

function NotificationSettings({ notes, onBack, onClose }) {
  return (
    <form className="notif-settings" onSubmit={(event) => { event.preventDefault(); void notes.saveSettings(); }}>
      <header className="notif-head">
        <div className="notif-head__title">
          <button type="button" className="ui-icon-btn" aria-label="알림 목록으로" onClick={onBack}><Icon name="chevronLeft" size={18} /></button>
          <h2>받기 설정</h2>
        </div>
        <div className="notif-head__actions">
          <button type="button" className="ui-icon-btn" aria-label="알림 닫기" title="닫기" onClick={onClose}><Icon name="close" size={18} /></button>
        </div>
      </header>
      <p className="notif-note"><Icon name="lock" size={16} />안전 필수 웹 알림은 끌 수 없습니다. 문자 설정은 수신 선호이며 실제 문자 발송을 보장하지 않습니다.</p>
      <Alerts notes={notes} />
      <div className="notif-body">
        <fieldset className="notif-prefs" disabled={notes.locked}>
          <legend className="sr-only">종류별 받기 설정</legend>
          <div className="notif-prefs__head" aria-hidden="true"><span>종류</span><span>웹</span><span>문자</span></div>
          {notes.settings?.map((entry) => {
            const label = NOTIFICATION_TYPE_LABELS[entry.type] ?? entry.type;
            return (
              <div key={entry.type} className="notif-prefs__row">
                <span className="notif-prefs__label">{label}{entry.mandatory && <span className="notif-prefs__must">필수</span>}</span>
                {['webEnabled', 'smsEnabled'].map((field) => (
                  <label key={field} className="notif-switch">
                    <input type="checkbox" role="switch" checked={entry[field]} disabled={field === 'webEnabled' && entry.mandatory}
                      aria-label={`${label} ${field === 'webEnabled' ? '웹' : '문자'} 알림${field === 'webEnabled' && entry.mandatory ? ' (필수, 끌 수 없음)' : ''}`}
                      onChange={(event) => notes.toggleSetting(entry.type, field, event.target.checked)} />
                    <span className="notif-switch__track" aria-hidden="true" />
                  </label>
                ))}
              </div>
            );
          })}
        </fieldset>
      </div>
      <footer className="notif-foot notif-foot--actions">
        <button type="button" className="ui-btn ui-btn--ghost" disabled={!notes.settingsDirty || notes.busy} onClick={notes.resetSettings}>되돌리기</button>
        <button type="submit" className="ui-btn ui-btn--primary" disabled={notes.locked || !notes.settingsDirty}>받기 설정 저장</button>
      </footer>
    </form>
  );
}
