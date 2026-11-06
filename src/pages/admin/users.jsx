import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { siteModes, userStatuses } from '../../api/admin';
import { useWorkSite } from '../../api/workers';
import JobPageLayout from '../../components/job-page-layout';
import PageHeader from '../../components/ui/page-header.jsx';
import { Badge } from '../../components/home/panel.jsx';
import Icon from '../../components/ui/icon.jsx';
import Sheet from '../../components/ui/sheet.jsx';
import StatusView, { Skeleton } from '../../components/ui/status-view.jsx';
import { useAdmin } from '../../hooks/use-admin.js';
import {
  ACCOUNT_ROLE_LABELS, accountActions, dateTime, grantableSites, grantList, grantMap, sameGrants, SITE_ROLE_OPTIONS,
  STATUS_FILTERS, STATUS_TONES, statusCounts, visibleMembers,
} from '../../utils/admin-model.js';
import '../../styles/home.css';
import '../../styles/work.css';
import '../../styles/records.css';
import '../../styles/risk.css';
import '../../styles/permit.css';
import '../../styles/tbm.css';
import '../../styles/site-settings.css';
import '../../styles/admin.css';

const TABS = [{ key: 'users', label: '회원' }, { key: 'sites', label: '현장' }];

/**
 * 관리 (/admin/users, 회사 관리자만). 탭: 회원(가입 승인·현장 권한·계정 관리) / 현장(등록·이름·모드·사용 중지).
 * 작업자 배치 명단(현장 설정)과는 다르다. 주소 ?tab=sites&status=PENDING
 */
export default function AdminUsers() {
  const context = useWorkSite();
  const isAdmin = context.account?.user?.role === 'ADMIN';
  return (
    <JobPageLayout title="관리" user={context.account?.user} contentClassName="work-page">
      {context.loading && <PageHeader title="관리" />}
      {!context.loading && context.error && <><PageHeader title="관리" /><StatusView kind="error" message={context.error} onRetry={context.reload} /></>}
      {!context.loading && !context.error && !isAdmin && <><PageHeader title="관리" /><StatusView kind="empty" title="회사 관리자만 쓸 수 있습니다" message="회원·현장 관리는 회사 관리자(ADMIN) 계정에서 합니다." /></>}
      {!context.loading && !context.error && isAdmin && <AdminPage context={context} />}
    </JobPageLayout>
  );
}

function AdminPage({ context }) {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'sites' ? 'sites' : 'users';
  const data = useAdmin({ enabled: true, onSitesChanged: context.reload });
  const counts = statusCounts(data.users);
  const setParam = (name, value) => setParams((current) => { const next = new URLSearchParams(current); if (value) next.set(name, value); else next.delete(name); return next; }, { replace: true });

  return (
    <div className="work-list rec-page site-page admin-page">
      <PageHeader title="관리" description="회사 관리자용 회원 가입 승인·현장 권한·계정 관리와 현장 등록입니다. 작업자 배치 명단과는 다릅니다."
        badges={counts.PENDING > 0 ? <Badge tone="wait">승인 대기 {counts.PENDING}</Badge> : null}
        actions={<button type="button" className="ui-btn ui-btn--ghost" disabled={data.busy} onClick={data.reload}><Icon name="refresh" size={16} />새로고침</button>} />
      <nav className="site-tabs" aria-label="관리 구분">
        {TABS.map((entry) => (
          <button key={entry.key} type="button" className={`site-tab${tab === entry.key ? ' is-active' : ''}`} aria-current={tab === entry.key ? 'page' : undefined} onClick={() => setParam('tab', entry.key === 'users' ? '' : entry.key)}>
            {entry.label}<span className="site-tab__count">{entry.key === 'users' ? data.users.length : data.sites.length}</span>
          </button>
        ))}
      </nav>
      {tab === 'users' ? <UsersTab data={data} counts={counts} me={context.account.user} status={params.get('status') ?? ''} setStatus={(value) => setParam('status', value)} />
        : <SitesTab data={data} />}
    </div>
  );
}

/* ---------- 회원 ---------- */

function UsersTab({ data, counts, me, status, setStatus }) {
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState(null);
  const filter = Object.hasOwn(userStatuses, status) ? status : '';
  const rows = visibleMembers(data.users, { status: filter, query });
  const open = data.users.find((user) => user.userId === openId) ?? null;
  return (
    <section className="home-panel tbm-card" aria-label="회원">
      <header className="tbm-card__head">
        <div className="admin-filters" role="group" aria-label="회원 상태">
          {STATUS_FILTERS.map((entry) => (
            <button key={entry.value || 'all'} type="button" className={`admin-chip${filter === entry.value ? ' is-active' : ''}${entry.value === 'PENDING' && counts.PENDING ? ' is-alert' : ''}`}
              aria-pressed={filter === entry.value} onClick={() => setStatus(entry.value)}>{entry.label}<span>{counts[entry.value]}</span></button>
          ))}
        </div>
        <div className="tbm-card__actions">
          <label className="site-search"><Icon name="search" size={16} /><span className="sr-only">회원 검색</span>
            <input type="search" value={query} placeholder="이름·이메일·부서" onChange={(event) => setQuery(event.target.value)} /></label>
        </div>
      </header>
      {data.usersLoading && <div className="site-pad"><Skeleton lines={5} /></div>}
      {data.usersError && <StatusView kind="error" compact message={data.usersError} onRetry={data.reload} />}
      {!data.usersLoading && !data.usersError && !rows.length && <StatusView kind="empty" compact title={filter === 'PENDING' ? '승인 대기 중인 회원이 없습니다' : '해당하는 회원이 없습니다'} />}
      {rows.length > 0 && (
        <div className="site-table-wrap">
          <table className="site-table admin-table">
            <thead><tr><th scope="col">이름</th><th scope="col">이메일</th><th scope="col">역할</th><th scope="col">상태</th><th scope="col">현장 권한</th><th scope="col">최근 로그인</th><th scope="col"><span className="sr-only">관리</span></th></tr></thead>
            <tbody>{rows.map((user) => (
              <tr key={user.userId} className={user.status === 'INACTIVE' ? 'is-inactive' : ''}>
                <th scope="row" data-label="이름">{user.name}{user.userId === me.userId && <span className="admin-me">나</span>}{user.department && <span className="rec-help admin-dept">{user.department}{user.jobTitle ? ` · ${user.jobTitle}` : ''}</span>}</th>
                <td data-label="이메일">{user.email}{!user.emailVerified && <> <Badge tone="warn">미인증</Badge></>}</td>
                <td data-label="역할">{ACCOUNT_ROLE_LABELS[user.role]}</td>
                <td data-label="상태"><Badge tone={STATUS_TONES[user.status]}>{userStatuses[user.status]}</Badge>{user.mustChangePassword && <span className="rec-help"> 비밀번호 변경 필요</span>}</td>
                <td data-label="현장">{user.role === 'ADMIN' ? '모든 현장' : user.sites.length ? `${user.sites.length}곳` : <span className="admin-none">없음</span>}</td>
                <td data-label="최근 로그인">{dateTime(user.lastLoginAt) || '—'}</td>
                <td className="site-table__act"><button type="button" className="ui-btn ui-btn--ghost site-edit" onClick={() => setOpenId(user.userId)}>{user.status === 'PENDING' ? '승인' : '관리'}</button></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
      <Sheet open={Boolean(open)} onClose={() => setOpenId(null)} wide title={open ? `${open.name} 님` : ''} subtitle={open?.email}>
        {open && <MemberDetail key={`${open.userId}:${open.status}:${open.role}`} user={open} data={data} me={me} />}
      </Sheet>
    </section>
  );
}

function MemberDetail({ user, data, me }) {
  return (
    <div className="admin-detail">
      <dl className="rec-facts admin-facts">
        <div><dt>상태</dt><dd><Badge tone={STATUS_TONES[user.status]}>{userStatuses[user.status]}</Badge></dd></div>
        <div><dt>계정 역할</dt><dd>{ACCOUNT_ROLE_LABELS[user.role]}</dd></div>
        <div><dt>이메일 인증</dt><dd>{user.emailVerified ? `완료${user.emailVerifiedVia === 'ADMIN' ? ' (관리자 확인)' : ''}` : <Badge tone="warn">미인증</Badge>}</dd></div>
        <div><dt>부서 · 직책</dt><dd>{[user.department, user.jobTitle].filter(Boolean).join(' · ') || '—'}</dd></div>
        <div><dt>연락처</dt><dd>{user.phone || '—'}</dd></div>
        <div><dt>가입</dt><dd>{dateTime(user.createdAt) || '—'}</dd></div>
        <div><dt>최근 로그인</dt><dd>{dateTime(user.lastLoginAt) || '없음'}</dd></div>
        <div><dt>로그인 실패</dt><dd className={user.failedLoginCount ? 'admin-warn' : ''}>{user.failedLoginCount ?? 0}회</dd></div>
      </dl>
      {user.status === 'PENDING' ? <Approve user={user} data={data} /> : <Grants user={user} data={data} />}
      <AccountActions user={user} data={data} me={me} />
    </div>
  );
}

function GrantTable({ sites, grants, setGrants, disabled }) {
  if (!sites.length) return <p className="rec-help">권한을 줄 현장이 없습니다. 현장 탭에서 먼저 현장을 등록하세요.</p>;
  return (
    <ul className="admin-grants">
      {sites.map((site) => (
        <li key={site.siteId} className={grants[site.siteId] ? 'is-on' : ''}>
          <span className="admin-grants__site"><strong>{site.name}</strong><span className="rec-help">#{site.siteId}{site.active === false ? ' · 사용 중지 현장' : ''}</span></span>
          <div className="permit-check__options admin-grants__roles" role="group" aria-label={`${site.name} 권한`}>
            {SITE_ROLE_OPTIONS.map((option) => (
              <button key={option.value || 'none'} type="button" disabled={disabled} className={`permit-check__btn ${option.value ? 'is-yes' : 'is-unknown'}`}
                aria-pressed={(grants[site.siteId] ?? '') === option.value} onClick={() => setGrants({ ...grants, [site.siteId]: option.value })}>{option.label}</button>
            ))}
          </div>
        </li>
      ))}
    </ul>
  );
}

function Approve({ user, data }) {
  const [role, setRole] = useState('MEMBER');
  const [grants, setGrants] = useState({});
  const list = grantList(grants);
  const blocked = !user.emailVerified ? '이메일 인증 전입니다. 메일 확인을 기다리거나, 본인을 직접 확인했다면 아래 "이메일 인증 처리"를 누르세요.'
    : role === 'MEMBER' && !list.length ? '일반 회원은 현장 권한을 1개 이상 줘야 합니다.' : '';
  return (
    <section className="admin-block" aria-labelledby="admin-approve">
      <h3 id="admin-approve">가입 승인</h3>
      <div className="permit-check__options admin-role" role="group" aria-label="계정 역할">
        {['MEMBER', 'ADMIN'].map((value) => <button key={value} type="button" className="permit-check__btn is-unknown" aria-pressed={role === value} onClick={() => setRole(value)}>{ACCOUNT_ROLE_LABELS[value]}</button>)}
      </div>
      {role === 'ADMIN'
        ? <p className="rec-note"><Icon name="info" size={16} />회사 관리자는 모든 현장에 접근하고 회원·현장을 관리할 수 있습니다.</p>
        : <GrantTable sites={grantableSites(data.sites, user)} grants={grants} setGrants={setGrants} disabled={data.busy} />}
      {blocked && <p className="rec-help admin-hint">{blocked}</p>}
      <div className="site-form__actions">
        <button type="button" className="ui-btn ui-btn--primary" disabled={data.busy || Boolean(blocked)} onClick={() => data.approve(user, role, role === 'ADMIN' ? [] : list)}>가입 승인</button>
      </div>
    </section>
  );
}

function Grants({ user, data }) {
  const saved = grantMap(user);
  const [grants, setGrants] = useState(saved);
  if (user.role === 'ADMIN') {
    return (
      <section className="admin-block"><h3>현장 권한</h3>
        <p className="rec-note"><Icon name="info" size={16} />회사 관리자는 모든 현장에 접근합니다. 개별 현장 권한은 일반 회원으로 바꾼 뒤 정합니다.</p></section>
    );
  }
  const changed = !sameGrants(grants, saved);
  return (
    <section className="admin-block" aria-labelledby="admin-grants">
      <h3 id="admin-grants">현장 권한 <span className="rec-help">저장하면 통째로 바뀌고, 권한 없음으로 바꾼 현장은 회수됩니다</span></h3>
      <GrantTable sites={grantableSites(data.sites, user)} grants={grants} setGrants={setGrants} disabled={data.busy || user.status === 'INACTIVE'} />
      <div className="site-form__actions">
        {changed && <button type="button" className="ui-btn ui-btn--ghost" onClick={() => setGrants(saved)}>변경 취소</button>}
        <button type="button" className="ui-btn ui-btn--primary" disabled={data.busy || !changed} onClick={() => data.saveGrants(user, grantList(grants))}>현장 권한 저장</button>
      </div>
    </section>
  );
}

const ACTION_TEXT = {
  verifyEmail: { label: '이메일 인증 처리', help: '메일이 막힌 환경에서 본인을 직접 확인했을 때만 씁니다.' },
  unlock: { label: '잠금 해제', help: '로그인 실패가 많아 잠긴 계정을 풉니다.' },
  temporaryPassword: { label: '임시 비밀번호 발급', help: '한 번만 보여 줍니다. 본인은 다음 로그인 때 바꿔야 하고 기존 로그인은 모두 끊깁니다.', confirm: true },
  role: { label: '역할 변경', help: '', confirm: true },
  deactivate: { label: '사용 중지', help: '퇴사 등. 바로 모든 로그인이 끊기고 기록은 남습니다.', confirm: true, danger: true },
  reactivate: { label: '다시 사용', help: '사용 중지한 계정을 다시 쓰게 합니다.' },
};

function AccountActions({ user, data, me }) {
  const [asking, setAsking] = useState(null);
  const [password, setPassword] = useState('');
  const actions = accountActions(user, me.userId);
  const nextRole = user.role === 'ADMIN' ? 'MEMBER' : 'ADMIN';
  const run = async (action) => {
    setAsking(null);
    if (action === 'temporaryPassword') { const value = await data.temporaryPassword(user); if (typeof value === 'string') setPassword(value); return; }
    if (action === 'role') { await data.changeRole(user, nextRole); return; }
    await data[action](user);
  };
  const text = (action) => (action === 'role'
    ? { ...ACTION_TEXT.role, label: nextRole === 'ADMIN' ? '회사 관리자로 바꾸기' : '일반 회원으로 바꾸기', help: nextRole === 'ADMIN' ? '모든 현장 접근과 회원·현장 관리 권한이 생깁니다.' : '관리 권한이 빠집니다. 현장 권한은 따로 정해야 합니다.' }
    : ACTION_TEXT[action]);
  if (!actions.length && !password) return null;
  return (
    <section className="admin-block" aria-labelledby="admin-account">
      <h3 id="admin-account">계정 관리</h3>
      {password && (
        <div className="admin-password" role="status">
          <span>임시 비밀번호 (이 창을 닫으면 다시 볼 수 없습니다)</span>
          <code>{password}</code>
          <button type="button" className="ui-btn ui-btn--ghost" onClick={() => { navigator.clipboard?.writeText(password).catch(() => {}); }}>복사</button>
        </div>
      )}
      <ul className="admin-actions">
        {actions.map((action) => {
          const info = text(action);
          return (
            <li key={action} className={info.danger ? 'is-danger' : ''}>
              <span className="admin-actions__text"><strong>{info.label}</strong>{info.help && <span className="rec-help">{info.help}</span>}</span>
              {asking === action ? (
                <span className="admin-actions__confirm">
                  <button type="button" className="ui-btn ui-btn--ghost" onClick={() => setAsking(null)}>그만두기</button>
                  <button type="button" className={`ui-btn ${info.danger ? 'site-leave__danger' : 'ui-btn--primary'}`} disabled={data.busy} onClick={() => run(action)}>확정</button>
                </span>
              ) : (
                <button type="button" className="ui-btn ui-btn--ghost" disabled={data.busy} onClick={() => (info.confirm ? setAsking(action) : run(action))}>{info.label}</button>
              )}
            </li>
          );
        })}
      </ul>
      {user.userId === me.userId && <p className="rec-help">자기 자신의 역할 변경·사용 중지는 할 수 없습니다.</p>}
    </section>
  );
}

/* ---------- 현장 ---------- */

function SitesTab({ data }) {
  const [edit, setEdit] = useState(null);
  const [error, setError] = useState('');
  const save = async (event) => {
    event.preventDefault();
    if (!edit.name.trim()) { setError('현장 이름을 입력하세요.'); return; }
    if (await data.saveSite(edit.siteId ?? null, edit)) setEdit(null);
  };
  return (
    <section className="home-panel tbm-card" aria-label="현장">
      <header className="tbm-card__head">
        <div><h2>현장 <span className="home-panel__count">{data.sites.length}</span></h2><p className="rec-help">사용 중지한 현장도 보입니다. 마감 시각 같은 운영 설정은 각 현장의 "현장 설정"에서 합니다.</p></div>
        <div className="tbm-card__actions"><button type="button" className="ui-btn ui-btn--primary" disabled={data.busy} onClick={() => { setError(''); setEdit({ name: '', mode: 'VERIFY', active: true }); }}>현장 추가</button></div>
      </header>
      {data.sitesLoading && <div className="site-pad"><Skeleton lines={4} /></div>}
      {data.sitesError && <StatusView kind="error" compact message={data.sitesError} onRetry={data.reload} />}
      {!data.sitesLoading && !data.sitesError && !data.sites.length && <StatusView kind="empty" compact title="등록된 현장이 없습니다" />}
      {data.sites.length > 0 && (
        <div className="site-table-wrap">
          <table className="site-table">
            <thead><tr><th scope="col">번호</th><th scope="col">이름</th><th scope="col">모드</th><th scope="col">업종</th><th scope="col">근로자</th><th scope="col">상태</th><th scope="col"><span className="sr-only">편집</span></th></tr></thead>
            <tbody>{data.sites.map((site) => (
              <tr key={site.siteId} className={site.active ? '' : 'is-inactive'}>
                <td data-label="번호">#{site.siteId}</td>
                <th scope="row" data-label="이름">{site.name}</th>
                <td data-label="모드"><Badge tone="info">{siteModes[site.mode]}</Badge></td>
                <td data-label="업종">{site.industry || '—'}</td>
                <td data-label="근로자">{site.employeeCount == null ? '—' : `${site.employeeCount}명`}</td>
                <td data-label="상태">{site.active ? <Badge tone="done">사용 중</Badge> : <Badge tone="neutral">사용 중지</Badge>}</td>
                <td className="site-table__act"><button type="button" className="ui-btn ui-btn--ghost site-edit" disabled={data.busy} onClick={() => { setError(''); setEdit({ ...site }); }}>수정</button></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
      <Sheet open={Boolean(edit)} onClose={() => setEdit(null)} title={edit?.siteId ? '현장 수정' : '현장 추가'} subtitle={edit?.siteId ? `#${edit.siteId}` : undefined}
        footer={<><button type="button" className="ui-btn ui-btn--ghost" onClick={() => setEdit(null)}>취소</button><button type="submit" form="admin-site-form" className="ui-btn ui-btn--primary ui-btn--lg" disabled={data.busy}>저장</button></>}>
        {edit && (
          <form id="admin-site-form" className="site-form site-form--sheet" onSubmit={save}>
            <fieldset>
              <legend className="sr-only">현장</legend>
              <label className="risk-field risk-field--wide site-field"><span className="risk-field__label">현장 이름<span className="risk-req" aria-hidden="true">*</span></span>
                <input required maxLength={100} value={edit.name} aria-invalid={Boolean(error)} onChange={(event) => { setError(''); setEdit({ ...edit, name: event.target.value }); }} />
                <span className={`site-field__hint${error ? ' is-error' : ''}`}>{error}</span></label>
              <div className="risk-field--wide">
                <span className="risk-field__label admin-label">운영 모드</span>
                <div className="admin-modes">
                  {Object.entries(siteModes).map(([value, label]) => (
                    <label key={value} className={`admin-mode${edit.mode === value ? ' is-on' : ''}`}>
                      <input type="radio" name="site-mode" value={value} checked={edit.mode === value} onChange={() => setEdit({ ...edit, mode: value })} />
                      <strong>{label}</strong>
                      <span className="rec-help">{value === 'VERIFY' ? '대형 현장. 자기가 올린 문서는 스스로 승인할 수 없습니다.' : '소규모 사업장. 요청한 사람도 직접 승인할 수 있습니다.'}</span>
                    </label>
                  ))}
                </div>
              </div>
              {edit.siteId && (
                <label className="site-check risk-field--wide"><input type="checkbox" checked={edit.active} onChange={(event) => setEdit({ ...edit, active: event.target.checked })} />
                  <span>사용 중 (끄면 새 권한을 줄 수 없고, 기록은 남습니다)</span></label>
              )}
            </fieldset>
          </form>
        )}
      </Sheet>
    </section>
  );
}
