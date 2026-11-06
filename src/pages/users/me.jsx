import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { logout } from '../../api/auth';
import { clearToken } from '../../api/client';
import { siteRoles, useWorkSite } from '../../api/workers';
import JobPageLayout from '../../components/job-page-layout';
import PasswordRules from '../../components/auth/password-rules';
import PageHeader from '../../components/ui/page-header.jsx';
import { Badge } from '../../components/home/panel.jsx';
import Icon from '../../components/ui/icon.jsx';
import StatusView, { Skeleton } from '../../components/ui/status-view.jsx';
import { useProfile } from '../../hooks/use-profile.js';
import { ACCOUNT_ROLE_LABELS } from '../../utils/admin-model.js';
import { NOTIFICATION_TYPE_LABELS } from '../../utils/notification-model.js';
import { emailBody, passwordBody, profileBody, profileForm, sameProfile } from '../../utils/profile-model.js';
import { joinPhone, koreanOnly, NAME_MAX, NAME_MIN, phonePartsError, splitPhone } from '../../utils/auth-validation.js';
import PhoneInput from '../../components/phone-input.jsx';
import '../../styles/home.css';
import '../../styles/work.css';
import '../../styles/records.css';
import '../../styles/risk.css';
import '../../styles/permit.css';
import '../../styles/tbm.css';
import '../../styles/site-settings.css';
import '../../styles/admin.css';
import '../../styles/profile.css';

/**
 * 내 정보 (/me). 기본 정보 · 내 현장 · 비밀번호 변경 · 이메일 변경 · 알림 받기 설정 · 로그아웃.
 * 쓰는 API: GET·PATCH /users/me, POST /auth/password/change, POST /users/me/email-change, GET·PUT /notifications/preferences
 * 임시 비밀번호로 로그인했을 때의 강제 변경은 /change-password (로그인 화면 틀) 가 맡는다.
 */
export default function Me() {
  const context = useWorkSite();
  const navigate = useNavigate();
  const data = useProfile();
  const user = data.me?.user;
  const doLogout = async () => {
    try { await logout(); } finally { clearToken(); navigate('/signin', { replace: true }); }
  };

  return (
    <JobPageLayout title="내 정보" user={context.account?.user} contentClassName="work-page">
      <div className="work-list rec-page site-page profile-page">
        <PageHeader title="내 정보" description="내 기본 정보와 보안, 알림 받기 설정을 관리합니다."
          actions={<>
            <button type="button" className="ui-btn ui-btn--ghost" disabled={Boolean(data.busy)} onClick={data.reload}><Icon name="refresh" size={16} />새로고침</button>
            <button type="button" className="ui-btn ui-btn--ghost" onClick={doLogout}>로그아웃</button>
          </>} />
        {data.loading && <section className="home-panel"><div className="home-panel__pad"><Skeleton lines={6} /></div></section>}
        {data.error && <section className="home-panel"><StatusView kind="error" message={data.error} onRetry={data.reload} /></section>}
        {user && (
          <div className="profile-grid">
            <div className="profile-col">
              <Summary me={data.me} />
              <Sites me={data.me} context={context} />
              <Preferences data={data} />
            </div>
            <div className="profile-col">
              <ProfileForm key={`${data.me.lockVersion}`} user={user} data={data} />
              <PasswordForm data={data} />
              <EmailForm user={user} data={data} />
            </div>
          </div>
        )}
      </div>
    </JobPageLayout>
  );
}

function Summary({ me }) {
  const user = me.user;
  return (
    <section className="home-panel tbm-card profile-summary" aria-label="계정 요약">
      <div className="profile-summary__top">
        <span className="profile-avatar" aria-hidden="true">{Array.from(user.name || user.email || 'U')[0]}</span>
        <div className="profile-summary__name">
          <h2>{user.name}</h2>
          <span className="rec-help">{user.email}</span>
        </div>
      </div>
      <dl className="rec-facts profile-facts">
        <div><dt>계정 역할</dt><dd>{ACCOUNT_ROLE_LABELS[user.role] ?? user.role}</dd></div>
        <div><dt>이메일 인증</dt><dd>{user.emailVerified ? <Badge tone="done">완료</Badge> : <Badge tone="warn">미인증</Badge>}</dd></div>
        <div><dt>부서</dt><dd>{user.department || '미등록'}</dd></div>
        <div><dt>직책</dt><dd>{user.jobTitle || '미등록'}</dd></div>
      </dl>
      {user.mustChangePassword && <p className="rec-note rec-note--block"><Icon name="lock" size={16} />임시 비밀번호를 쓰고 있습니다. 아래에서 새 비밀번호로 바꾸세요.</p>}
    </section>
  );
}

function Sites({ me, context }) {
  const current = context.currentSite?.siteId ?? me.currentSiteId;
  return (
    <section className="home-panel tbm-card" aria-labelledby="profile-sites">
      <header className="tbm-card__head"><div><h2 id="profile-sites">내 현장 <span className="home-panel__count">{me.sites.length}</span></h2>
        <p className="rec-help">{me.user.role === 'ADMIN' ? '회사 관리자는 모든 현장에 접근합니다.' : '권한이 있는 현장과 역할입니다. 권한 변경은 회사 관리자에게 요청하세요.'}</p></div></header>
      {me.sites.length ? (
        <ul className="site-list">
          {me.sites.map((site) => (
            <li key={site.siteId} className={site.siteId === current ? 'is-current' : ''}>
              <span className="site-list__main"><strong>{site.name}</strong><span className="rec-help">{siteRoles[site.role] ?? site.role}</span></span>
              {site.siteId === current ? <Badge tone="done">지금 현장</Badge>
                : <button type="button" className="ui-btn ui-btn--ghost site-edit" disabled={context.selecting || context.loading} onClick={() => context.selectSite(site.siteId)}>이 현장으로</button>}
            </li>
          ))}
        </ul>
      ) : <p className="rec-help site-pad">등록된 현장 권한이 없습니다.</p>}
    </section>
  );
}

function Field({ label, error, hint, required, onChange, ...rest }) {
  return (
    <label className="risk-field site-field">
      <span className="risk-field__label">{label}{required && <span className="risk-req" aria-hidden="true">*</span>}</span>
      <input required={required} aria-invalid={Boolean(error)} {...rest} onChange={(event) => onChange(event.target.value)} />
      <span className={`site-field__hint${error ? ' is-error' : ''}`}>{error || hint || ''}</span>
    </label>
  );
}

function ProfileForm({ user, data }) {
  const saved = profileForm(user);
  const [form, setForm] = useState(saved);
  const [errors, setErrors] = useState({});
  const [blocked, setBlocked] = useState({});
  const [phoneParts, setPhoneParts] = useState(() => splitPhone(user.phone ?? ''));
  const set = (field, value) => setForm({ ...form, [field]: value });
  const setPhone = (parts) => { setPhoneParts(parts); setForm((current) => ({ ...current, phone: joinPhone(parts) })); setErrors((current) => ({ ...current, phone: '' })); };
  // 이름은 한글만: 다른 글자는 바로 걸러 내고 안내한다
  const setOnly = (field, clean, message) => (raw) => {
    const value = clean(raw);
    setForm({ ...form, [field]: value });
    setBlocked({ ...blocked, [field]: value !== raw ? message : '' });
  };
  const changed = !sameProfile(form, saved);
  return (
    <section className="home-panel tbm-card" aria-labelledby="profile-basic">
      <header className="tbm-card__head"><div><h2 id="profile-basic">기본 정보</h2><p className="rec-help">이름과 연락처, 소속을 고칠 수 있습니다. 이메일은 아래 "이메일 변경"에서 바꿉니다.</p></div></header>
      <form className="site-form" onSubmit={async (event) => {
        event.preventDefault();
        const result = profileBody(form);
        const phoneError = phonePartsError(phoneParts);
        if (phoneError) result.errors = { ...(result.errors ?? {}), phone: phoneError };
        setErrors(result.errors ?? {});
        if (result.errors) return;
        const saved = await data.saveProfile(result.body);
        if (!saved.ok) setErrors(saved.fieldErrors);
      }}>
        <fieldset disabled={data.busy === 'profile'}>
          <legend className="sr-only">기본 정보</legend>
          <Field label="이름" required lang="ko" value={form.name} error={errors.name || blocked.name} hint={`한글 ${NAME_MIN}~${NAME_MAX}자`} autoComplete="name"
            onChange={setOnly('name', koreanOnly, `이름은 한글만 ${NAME_MAX}자까지 입력할 수 있습니다.`)} onBlur={() => setBlocked({ ...blocked, name: '' })} />
          <div className="risk-field site-field">
            <label htmlFor="profile-phone" className="risk-field__label">전화번호</label>
            <PhoneInput id="profile-phone" className="phone-input--app" parts={phoneParts} onChange={setPhone} invalid={Boolean(errors.phone)} describedBy="profile-phone-help" />
            <span id="profile-phone-help" className={`site-field__hint${errors.phone ? ' is-error' : ''}`}>{errors.phone || '숫자만 칸별로 · 세 칸 모두 비우면 지웁니다'}</span>
          </div>
          <Field label="부서" maxLength={100} value={form.department} error={errors.department} onChange={(value) => set('department', value)} />
          <Field label="직책" maxLength={50} value={form.jobTitle} error={errors.jobTitle} onChange={(value) => set('jobTitle', value)} />
        </fieldset>
        <div className="site-form__actions">
          {changed && <button type="button" className="ui-btn ui-btn--ghost" onClick={() => { setForm(saved); setPhoneParts(splitPhone(user.phone ?? '')); setErrors({}); }}>변경 취소</button>}
          <button type="submit" className="ui-btn ui-btn--primary" disabled={!changed || Boolean(data.busy)}>저장</button>
        </div>
      </form>
    </section>
  );
}

const EMPTY_PASSWORD = { currentPassword: '', newPassword: '', confirm: '' };

function PasswordForm({ data }) {
  const [form, setForm] = useState(EMPTY_PASSWORD);
  const [errors, setErrors] = useState({});
  const set = (field, value) => setForm({ ...form, [field]: value });
  return (
    <section className="home-panel tbm-card" aria-labelledby="profile-password">
      <header className="tbm-card__head"><div><h2 id="profile-password">비밀번호 변경</h2><p className="rec-help">바꾸면 다른 기기의 로그인은 끊기고, 이 기기는 그대로 이어집니다.</p></div></header>
      <form className="site-form" onSubmit={async (event) => {
        event.preventDefault();
        const result = passwordBody(form);
        setErrors(result.errors ?? {});
        if (result.errors) return;
        const saved = await data.savePassword(result.body);
        if (saved.ok) setForm(EMPTY_PASSWORD); else setErrors(saved.fieldErrors);
      }}>
        <fieldset disabled={data.busy === 'password'}>
          <legend className="sr-only">비밀번호 변경</legend>
          <Field label="현재 비밀번호" required type="password" autoComplete="current-password" value={form.currentPassword} error={errors.currentPassword} onChange={(value) => set('currentPassword', value)} />
          <span aria-hidden="true" className="profile-spacer" />
          <Field label="새 비밀번호" required type="password" autoComplete="new-password" value={form.newPassword} error={errors.newPassword} onChange={(value) => set('newPassword', value)} />
          <Field label="새 비밀번호 확인" required type="password" autoComplete="new-password" value={form.confirm} error={errors.confirm} onChange={(value) => set('confirm', value)} />
          <div className="risk-field--wide profile-rules"><PasswordRules /></div>
        </fieldset>
        <div className="site-form__actions">
          <button type="submit" className="ui-btn ui-btn--primary" disabled={Boolean(data.busy) || !form.currentPassword || !form.newPassword}>비밀번호 변경</button>
        </div>
      </form>
    </section>
  );
}

function EmailForm({ user, data }) {
  const [form, setForm] = useState({ newEmail: '', currentPassword: '' });
  const [errors, setErrors] = useState({});
  const [sentTo, setSentTo] = useState('');
  const set = (field, value) => setForm({ ...form, [field]: value });
  return (
    <section className="home-panel tbm-card" aria-labelledby="profile-email">
      <header className="tbm-card__head"><div><h2 id="profile-email">이메일 변경</h2><p className="rec-help">지금 이메일: {user.email}. 새 주소로 간 확인 링크를 10분 안에 눌러야 바뀝니다.</p></div></header>
      {sentTo && <p className="rec-note"><Icon name="info" size={16} />{sentTo} 로 확인 메일을 보냈습니다. 메일함을 확인하세요.</p>}
      <form className="site-form" onSubmit={async (event) => {
        event.preventDefault();
        const result = emailBody(form, user.email);
        setErrors(result.errors ?? {});
        if (result.errors) return;
        const sent = await data.sendEmailChange(result.body);
        if (sent.ok) { setSentTo(result.body.newEmail); setForm({ newEmail: '', currentPassword: '' }); } else setErrors(sent.fieldErrors);
      }}>
        <fieldset disabled={data.busy === 'email'}>
          <legend className="sr-only">이메일 변경</legend>
          <Field label="새 이메일" required type="email" autoComplete="email" value={form.newEmail} error={errors.newEmail} onChange={(value) => set('newEmail', value)} />
          <Field label="현재 비밀번호" required type="password" autoComplete="current-password" value={form.currentPassword} error={errors.currentPassword} onChange={(value) => set('currentPassword', value)} />
        </fieldset>
        <div className="site-form__actions">
          <button type="submit" className="ui-btn ui-btn--primary" disabled={Boolean(data.busy) || !form.newEmail || !form.currentPassword}>확인 메일 보내기</button>
        </div>
      </form>
    </section>
  );
}

function Preferences({ data }) {
  return (
    <section className="home-panel tbm-card" aria-labelledby="profile-prefs">
      <header className="tbm-card__head"><div><h2 id="profile-prefs">알림 받기 설정</h2><p className="rec-help">안전 필수 알림의 웹 알림은 끌 수 없습니다. 문자는 받기 희망이며 실제 발송을 보장하지 않습니다.</p></div></header>
      {data.prefsLoading && <div className="site-pad"><Skeleton lines={4} /></div>}
      {data.prefsError && <StatusView kind="error" compact message={data.prefsError} onRetry={data.reload} />}
      {data.prefs && (
        <>
          <div className="site-table-wrap">
            <table className="site-table profile-prefs">
              <thead><tr><th scope="col">종류</th><th scope="col">웹</th><th scope="col">문자</th></tr></thead>
              <tbody>{data.prefs.map((entry) => {
                const label = NOTIFICATION_TYPE_LABELS[entry.type] ?? entry.type;
                return (
                  <tr key={entry.type}>
                    <th scope="row">{label}{entry.mandatory && <span className="profile-must">필수</span>}</th>
                    {['webEnabled', 'smsEnabled'].map((field) => (
                      <td key={field} className="profile-prefs__cell">
                        <label className="profile-switch">
                          <input type="checkbox" role="switch" checked={entry[field]} disabled={Boolean(data.busy) || (field === 'webEnabled' && entry.mandatory)}
                            aria-label={`${label} ${field === 'webEnabled' ? '웹' : '문자'} 알림`} onChange={(event) => data.togglePreference(entry.type, field, event.target.checked)} />
                          <span aria-hidden="true" />
                        </label>
                      </td>
                    ))}
                  </tr>
                );
              })}</tbody>
            </table>
          </div>
          <div className="site-form__actions site-pad">
            {data.prefsChanged && <button type="button" className="ui-btn ui-btn--ghost" onClick={data.resetPreferences}>변경 취소</button>}
            <button type="button" className="ui-btn ui-btn--primary" disabled={!data.prefsChanged || Boolean(data.busy)} onClick={data.savePreferences}>설정 저장</button>
          </div>
        </>
      )}
    </section>
  );
}
