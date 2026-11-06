import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { siteRoles, useWorkSite } from '../../api/workers';
import JobPageLayout from '../../components/job-page-layout';
import PageHeader from '../../components/ui/page-header.jsx';
import { Badge } from '../../components/home/panel.jsx';
import Icon from '../../components/ui/icon.jsx';
import Sheet from '../../components/ui/sheet.jsx';
import StatusView, { Skeleton } from '../../components/ui/status-view.jsx';
import { useSiteSettings } from '../../hooks/use-site-settings.js';
import { localDate } from '../../utils/job-forms';
import { joinPhone, phonePartsError } from '../../utils/auth-validation.js';
import PhoneInput from '../../components/phone-input.jsx';
import {
  EMPLOYMENT_LABELS, EMPTY_TEAM, EMPTY_ZONE, equipmentBody, equipmentForm, matches, settingsBody, settingsForm,
  SITE_MODE_LABELS, SITE_TABS, tabOf, TEAM_TYPE_LABELS, teamBody, zoneBody,
} from '../../utils/site-settings-model.js';
import '../../styles/home.css';
import '../../styles/work.css';
import '../../styles/records.css';
import '../../styles/risk.css';
import '../../styles/permit.css';
import '../../styles/tbm.css';
import '../../styles/site-settings.css';

const EMPTY_WORKER = { name: '', phone: '', phoneParts: ['', '', ''], clearPhone: false, jobType: '', employmentType: 'DIRECT', teamId: '', assignedFrom: '' };

/**
 * 현장 설정 (/job/list). 탭: 현장 정보 · 구역 · 설비 · 작업자 · 팀·협력업체. 주소 ?tab= 로 탭을 연다.
 * 조회는 현장 권한이면 누구나, 변경은 현장 관리자 이상(팀은 회사 관리자). 최종 판단은 서버.
 */
export default function JobSearch() {
  const context = useWorkSite();
  const site = context.currentSite;
  return (
    <JobPageLayout title="현장 설정" user={context.account?.user} contentClassName="work-page">
      {site
        ? <SettingsPage key={site.siteId} site={site} context={context} />
        : <PageHeader title="현장 설정" context={context} />}
    </JobPageLayout>
  );
}

function SettingsPage({ site, context }) {
  const [params, setParams] = useSearchParams();
  const tab = tabOf(params.get('tab'));
  const data = useSiteSettings({ site, user: context.account?.user, disabled: context.selecting || context.loading });
  const [edit, setEdit] = useState(null); // { kind, form, errors }
  const counts = { zones: data.resources.zones?.length, equipment: data.resources.equipment?.length, workers: data.resources.workers?.length, teams: data.resources.teams?.length };
  const open = (kind, form) => setEdit({ kind, form, errors: {} });
  const close = () => setEdit(null);

  return (
    <div className="work-list rec-page site-page">
      <PageHeader title="현장 설정" description="현장 운영 설정과 구역·설비·작업자·팀 기준 정보를 관리합니다." context={context}
        actions={<button type="button" className="ui-btn ui-btn--ghost" disabled={data.busy} onClick={data.reload}><Icon name="refresh" size={16} />새로고침</button>} />

      <nav className="site-tabs" aria-label="현장 설정 구분">
        {SITE_TABS.map((entry) => (
          <button key={entry.key} type="button" className={`site-tab${tab === entry.key ? ' is-active' : ''}`} aria-current={tab === entry.key ? 'page' : undefined}
            onClick={() => setParams((current) => { const next = new URLSearchParams(current); next.set('tab', entry.key); return next; }, { replace: true })}>
            {entry.label}{counts[entry.key] != null && <span className="site-tab__count">{counts[entry.key]}</span>}
            {data.errors[entry.key === 'site' ? 'settings' : entry.key] && <Icon name="alert" size={14} className="site-tab__warn" />}
          </button>
        ))}
      </nav>

      {!data.permissions.manageSite && <p className="rec-note"><Icon name="info" size={16} />보기 전용입니다. 변경은 현장 관리자 이상만 할 수 있습니다.</p>}
      {data.anyBlocked && (
        <div className="work-form__error" role="alert"><Icon name="warning" size={16} /><span>저장 결과나 최신 판을 확인해야 합니다. 새로고침으로 서버 반영 여부를 확인한 뒤 계속하세요.</span>
          <button type="button" className="ui-btn ui-btn--ghost" onClick={data.reload}>새로고침</button></div>
      )}

      {tab === 'site' && <SiteTab data={data} context={context} site={site} />}
      {tab === 'zones' && <ZonesTab data={data} onEdit={(entry) => open('zones', entry ? { ...entry, zoneType: entry.zoneType ?? '', hazardNote: entry.hazardNote ?? '' } : { ...EMPTY_ZONE })} />}
      {tab === 'equipment' && <EquipmentTab data={data} onEdit={(entry) => open('equipment', equipmentForm(entry))} />}
      {tab === 'workers' && <WorkersTab data={data} onEdit={(entry) => open('workers', entry
        ? { ...EMPTY_WORKER, ...entry, phone: '', phoneParts: ['', '', ''], jobType: entry.jobType ?? '', teamId: entry.teamId == null ? '' : String(entry.teamId) }
        : { ...EMPTY_WORKER })} />}
      {tab === 'teams' && <TeamsTab data={data} onEdit={(entry) => open('teams', entry ? { ...entry, businessNo: entry.businessNo ?? '' } : { ...EMPTY_TEAM })} />}

      <EditSheet edit={edit} setEdit={setEdit} data={data} onClose={close} />
    </div>
  );
}

/* ---------- 현장 정보 ---------- */

function SiteTab({ data, context, site }) {
  const settings = data.resources.settings;
  const [form, setForm] = useState(null);
  const [errors, setErrors] = useState({});
  const current = form ?? settingsForm(settings);
  const set = (field, value) => setForm({ ...current, [field]: value });
  const editable = data.can('settings');
  const sites = context.account?.sites ?? [];

  return (
    <div className="site-grid">
      <section className="home-panel tbm-card" aria-labelledby="site-settings">
        <header className="tbm-card__head">
          <div>
            <h2 id="site-settings">{settings?.name ?? site.name} {settings && <Badge tone="info">{SITE_MODE_LABELS[settings.mode] ?? settings.mode}</Badge>}{settings && !settings.active && <Badge tone="block">사용 중지</Badge>}</h2>
            <p className="rec-help">마감 시각은 작업 현황·홈의 미완료 집계와 알림에 쓰입니다. 현장 이름·모드는 회사 관리자가 바꿉니다.</p>
          </div>
        </header>
        {data.loading('settings') && <div className="status-pad site-pad"><Skeleton lines={4} /></div>}
        {data.errors.settings && <StatusView kind="error" compact message={data.errors.settings} onRetry={data.reload} />}
        {settings && (
          <form className="site-form" onSubmit={async (event) => {
            event.preventDefault();
            const result = settingsBody(current);
            setErrors(result.errors ?? {});
            if (result.errors) return;
            if (await data.saveSettings(result.body)) setForm(null);
          }}>
            <fieldset disabled={!editable}>
              <legend className="sr-only">운영 설정</legend>
              <h3 className="site-form__group">마감·알림</h3>
              <Input label="TBM 마감 시각" required type="time" value={current.tbmDeadline} error={errors.tbmDeadline} onChange={(value) => set('tbmDeadline', value)} />
              <Input label="안전일지 마감 시각" required type="time" value={current.dailyLogDeadline} error={errors.dailyLogDeadline} hint="TBM 마감보다 늦어야 합니다" onChange={(value) => set('dailyLogDeadline', value)} />
              <Input label="승인 재알림 (분)" required type="number" min="5" max="1440" value={current.approvalDueMinutes} error={errors.approvalDueMinutes} hint="승인 요청 후 이 시간이 지나면 다시 알림 · 5~1440" onChange={(value) => set('approvalDueMinutes', value)} />
              <Input label="아차사고 경고 기간 (일)" required type="number" min="1" max="365" value={current.nearMissWarnDays} error={errors.nearMissWarnDays} hint="같은 구역 아차사고를 며칠 전까지 경고에 쓸지 · 1~365" onChange={(value) => set('nearMissWarnDays', value)} />
              <h3 className="site-form__group">현장 정보</h3>
              <Input label="업종" maxLength={50} value={current.industry} error={errors.industry} placeholder="예: 석유화학" onChange={(value) => set('industry', value)} />
              <Input label="근로자 수" type="number" min="0" value={current.employeeCount} error={errors.employeeCount} onChange={(value) => set('employeeCount', value)} />
              <Input label="주소" wide maxLength={255} value={current.address} error={errors.address} onChange={(value) => set('address', value)} />
            </fieldset>
            {editable && (
              <div className="site-form__actions">
                {form && <button type="button" className="ui-btn ui-btn--ghost" onClick={() => { setForm(null); setErrors({}); }}>변경 취소</button>}
                <button type="submit" className="ui-btn ui-btn--primary" disabled={!form || data.busy}>설정 저장</button>
              </div>
            )}
          </form>
        )}
      </section>

      <section className="home-panel tbm-card" aria-labelledby="site-list">
        <header className="tbm-card__head"><div><h2 id="site-list">내 현장 <span className="home-panel__count">{sites.length}</span></h2><p className="rec-help">권한이 있는 현장입니다. 고르면 모든 화면이 그 현장으로 바뀝니다.</p></div></header>
        <ul className="site-list">
          {sites.map((entry) => {
            const current = entry.siteId === site.siteId;
            return (
              <li key={entry.siteId} className={current ? 'is-current' : ''}>
                <span className="site-list__main"><strong>{entry.name}</strong><span className="rec-help">#{entry.siteId} · {siteRoles[entry.role] ?? entry.role}</span></span>
                {current ? <Badge tone="done">지금 현장</Badge>
                  : <button type="button" className="ui-btn ui-btn--ghost" disabled={context.selecting} onClick={() => context.selectSite(entry.siteId)}>이 현장으로</button>}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

function Input({ label, required, error, hint, wide, onChange, type = 'text', ...rest }) {
  return (
    <label className={`risk-field site-field${wide ? ' risk-field--wide' : ''}`}>
      <span className="risk-field__label">{label}{required && <span className="risk-req" aria-hidden="true">*</span>}</span>
      <input type={type} required={required} aria-invalid={Boolean(error)} {...rest} onChange={(event) => onChange(event.target.value)} />
      <span className={`site-field__hint${error ? ' is-error' : ''}`}>{error || hint || ''}</span>
    </label>
  );
}

/* ---------- 목록 탭 공통 ---------- */

function ListTab({ title, help, data, kind, addLabel, onAdd, searchFields, children, toolbar }) {
  const [query, setQuery] = useState('');
  const list = data.resources[kind];
  const shown = (list ?? []).filter((entry) => matches(entry, query, searchFields));
  return (
    <section className="home-panel tbm-card" aria-label={title}>
      <header className="tbm-card__head">
        <div><h2>{title} {list && <span className="home-panel__count">{list.length}</span>}</h2>{help && <p className="rec-help">{help}</p>}</div>
        <div className="tbm-card__actions">
          <label className="site-search"><Icon name="search" size={16} /><span className="sr-only">{title} 검색</span>
            <input type="search" value={query} placeholder="이름·코드 검색" onChange={(event) => setQuery(event.target.value)} /></label>
          {onAdd && <button type="button" className="ui-btn ui-btn--primary" disabled={!data.can(kind)} onClick={onAdd}>{addLabel}</button>}
        </div>
      </header>
      {toolbar}
      {data.loading(kind) && <div className="site-pad"><Skeleton lines={4} /></div>}
      {data.errors[kind] && <StatusView kind="error" compact message={data.errors[kind]} onRetry={data.reload} />}
      {list && !list.length && <StatusView kind="empty" compact title="아직 등록된 항목이 없습니다" />}
      {list && list.length > 0 && !shown.length && <p className="rec-help site-pad">검색 결과가 없습니다.</p>}
      {shown.length > 0 && <div className="site-table-wrap">{children(shown)}</div>}
    </section>
  );
}

const ActiveBadge = ({ active }) => (active ? <Badge tone="done">사용 중</Badge> : <Badge tone="neutral">사용 중지</Badge>);

function EditButton({ data, kind, onClick, label = '수정', disabled }) {
  return <button type="button" className="ui-btn ui-btn--ghost site-edit" disabled={!data.can(kind) || disabled} onClick={onClick}>{label}</button>;
}

function ZonesTab({ data, onEdit }) {
  return (
    <ListTab title="구역" help="작업·아차사고·점검표에서 고르는 현장 구역입니다. 사용 중지한 구역도 함께 보입니다." data={data} kind="zones"
      addLabel="구역 추가" onAdd={() => onEdit(null)} searchFields={['code', 'name', 'zoneType']}>
      {(rows) => (
        <table className="site-table">
          <thead><tr><th scope="col">코드</th><th scope="col">이름</th><th scope="col">유형</th><th scope="col">밀폐</th><th scope="col">유해·위험 참고</th><th scope="col">상태</th><th scope="col"><span className="sr-only">편집</span></th></tr></thead>
          <tbody>{rows.map((entry) => (
            <tr key={entry.zoneId} className={entry.active ? '' : 'is-inactive'}>
              <td data-label="코드"><code>{entry.code}</code></td>
              <th scope="row" data-label="이름">{entry.name}</th>
              <td data-label="유형">{entry.zoneType || '—'}</td>
              <td data-label="밀폐">{entry.confined ? <Badge tone="warn">밀폐공간</Badge> : '—'}</td>
              <td data-label="참고" className="site-table__note">{entry.hazardNote || '—'}</td>
              <td data-label="상태"><ActiveBadge active={entry.active} /></td>
              <td className="site-table__act"><EditButton data={data} kind="zones" onClick={() => onEdit(entry)} /></td>
            </tr>
          ))}</tbody>
        </table>
      )}
    </ListTab>
  );
}

function EquipmentTab({ data, onEdit }) {
  const zoneName = (id) => data.resources.zones?.find((zone) => zone.zoneId === id)?.name ?? (id ? `구역 #${id}` : '—');
  return (
    <ListTab title="설비" help="설비 점검표 대상입니다. 다음 점검·교정일이 지나면 점검 기한 지남으로 표시됩니다." data={data} kind="equipment"
      addLabel="설비 추가" onAdd={() => onEdit(null)} searchFields={['code', 'name', 'equipmentType']}>
      {(rows) => (
        <table className="site-table">
          <thead><tr><th scope="col">코드</th><th scope="col">이름</th><th scope="col">종류</th><th scope="col">구역</th><th scope="col">다음 점검·교정일</th><th scope="col">상태</th><th scope="col"><span className="sr-only">편집</span></th></tr></thead>
          <tbody>{rows.map((entry) => (
            <tr key={entry.equipmentId} className={entry.active ? '' : 'is-inactive'}>
              <td data-label="코드"><code>{entry.code}</code></td>
              <th scope="row" data-label="이름">{entry.name}</th>
              <td data-label="종류"><code>{entry.equipmentType}</code></td>
              <td data-label="구역">{zoneName(entry.zoneId)}</td>
              <td data-label="다음 점검">{entry.nextInspectionDate ?? '미정'}{entry.inspectionOverdue && <> <Badge tone="block">기한 지남</Badge></>}</td>
              <td data-label="상태"><ActiveBadge active={entry.active} /></td>
              <td className="site-table__act"><EditButton data={data} kind="equipment" onClick={() => onEdit(entry)} /></td>
            </tr>
          ))}</tbody>
        </table>
      )}
    </ListTab>
  );
}

function WorkersTab({ data, onEdit }) {
  const [assign, setAssign] = useState({ workerId: '', date: localDate() });
  const toolbar = data.permissions.manageSite && (
    <form className="site-assign" onSubmit={(event) => {
      event.preventDefault();
      if (!/^\d+$/.test(assign.workerId)) return;
      void data.assign(assign.workerId, assign.date).then((ok) => { if (ok) setAssign({ workerId: '', date: localDate() }); });
    }}>
      <span className="rec-help">떠났던 작업자를 다시 배치:</span>
      <label className="risk-field"><span className="sr-only">작업자 번호</span><input inputMode="numeric" placeholder="작업자 번호" value={assign.workerId} onChange={(event) => setAssign({ ...assign, workerId: event.target.value.replace(/\D/g, '') })} /></label>
      <label className="risk-field"><span className="sr-only">배치일</span><input type="date" max="9999-12-31" value={assign.date} onChange={(event) => setAssign({ ...assign, date: event.target.value })} /></label>
      <button type="submit" className="ui-btn ui-btn--ghost" disabled={!data.can('workers') || !assign.workerId}>배치</button>
    </form>
  );
  return (
    <ListTab title="작업자" help="지금 현장에 배치된 작업자입니다. TBM 참석자 목록에 쓰입니다. 연락처는 개인정보라 목록에 나오지 않습니다." data={data} kind="workers"
      addLabel="작업자 추가" onAdd={() => onEdit(null)} searchFields={['name', 'jobType', 'teamName', 'workerId']} toolbar={toolbar}>
      {(rows) => (
        <table className="site-table">
          <thead><tr><th scope="col">번호</th><th scope="col">이름</th><th scope="col">직종</th><th scope="col">고용 형태</th><th scope="col">팀</th><th scope="col">배치</th><th scope="col"><span className="sr-only">편집</span></th></tr></thead>
          <tbody>{rows.map((entry) => (
            <tr key={entry.workerId}>
              <td data-label="번호">#{entry.workerId}</td>
              <th scope="row" data-label="이름">{entry.name}</th>
              <td data-label="직종">{entry.jobType || '—'}</td>
              <td data-label="고용">{EMPLOYMENT_LABELS[entry.employmentType] ?? entry.employmentType}</td>
              <td data-label="팀">{entry.teamName ?? '미지정'}</td>
              <td data-label="배치">{entry.assignedFrom} ~ {entry.assignedTo ?? '배치 중'}</td>
              <td className="site-table__act"><EditButton data={data} kind="workers" disabled={!Number.isInteger(entry.lockVersion)} onClick={() => onEdit(entry)} /></td>
            </tr>
          ))}</tbody>
        </table>
      )}
    </ListTab>
  );
}

function TeamsTab({ data, onEdit }) {
  return (
    <ListTab title="팀·협력업체" help={data.permissions.manageTeams ? '회사 전체에서 함께 쓰는 팀입니다.' : '회사 전체에서 함께 쓰는 팀입니다. 변경은 회사 관리자만 할 수 있습니다.'}
      data={data} kind="teams" addLabel="팀 추가" onAdd={data.permissions.manageTeams ? () => onEdit(null) : null} searchFields={['name', 'businessNo']}>
      {(rows) => (
        <table className="site-table">
          <thead><tr><th scope="col">이름</th><th scope="col">유형</th><th scope="col">사업자등록번호</th><th scope="col">상태</th><th scope="col"><span className="sr-only">편집</span></th></tr></thead>
          <tbody>{rows.map((entry) => (
            <tr key={entry.teamId} className={entry.active ? '' : 'is-inactive'}>
              <th scope="row" data-label="이름">{entry.name}</th>
              <td data-label="유형">{TEAM_TYPE_LABELS[entry.teamType] ?? entry.teamType}</td>
              <td data-label="사업자번호">{entry.businessNo || '—'}</td>
              <td data-label="상태"><ActiveBadge active={entry.active} /></td>
              <td className="site-table__act">{data.permissions.manageTeams && <EditButton data={data} kind="teams" onClick={() => onEdit(entry)} />}</td>
            </tr>
          ))}</tbody>
        </table>
      )}
    </ListTab>
  );
}

/* ---------- 등록·수정 시트 ---------- */

const SHEET_TITLES = { zones: ['구역 추가', '구역 수정'], equipment: ['설비 추가', '설비 수정'], workers: ['작업자 추가', '작업자 수정'], teams: ['팀 추가', '팀 수정'] };
const ID_FIELD = { zones: 'zoneId', equipment: 'equipmentId', workers: 'workerId', teams: 'teamId' };

function EditSheet({ edit, setEdit, data, onClose }) {
  const [leaving, setLeaving] = useState(null);
  if (!edit) return <Sheet open={false} onClose={onClose} title="" />;
  const { kind, form, errors } = edit;
  const id = form[ID_FIELD[kind]];
  const set = (field, value) => setEdit({ ...edit, form: { ...form, [field]: value } });
  const close = () => { setLeaving(null); onClose(); };
  const submit = async (event) => {
    event.preventDefault();
    if (kind === 'workers') {
      const phoneError = form.clearPhone ? '' : phonePartsError(form.phoneParts);
      if (phoneError) { setEdit({ ...edit, errors: { phone: phoneError } }); return; }
      if (await data.saveWorker(form)) close();
      return;
    }
    const result = { zones: zoneBody, equipment: equipmentBody, teams: teamBody }[kind](form);
    if (result.errors) { setEdit({ ...edit, errors: result.errors }); return; }
    const save = { zones: data.saveZone, equipment: data.saveEquipment, teams: data.saveTeam }[kind];
    if (await save(id ?? null, result.body)) close();
  };
  const activeTeams = (data.resources.teams ?? []).filter((team) => team.active);
  const activeZones = (data.resources.zones ?? []).filter((zone) => zone.active || String(zone.zoneId) === String(form.zoneId));

  return (
    <Sheet open onClose={close} title={SHEET_TITLES[kind][id ? 1 : 0]} subtitle={id ? `#${id}` : undefined}
      footer={<><button type="button" className="ui-btn ui-btn--ghost" onClick={close}>취소</button><button type="submit" form="site-edit-form" className="ui-btn ui-btn--primary ui-btn--lg" disabled={!data.can(kind)}>저장</button></>}>
      <form id="site-edit-form" className="site-form site-form--sheet" onSubmit={submit}>
        <fieldset disabled={!data.can(kind)}>
          <legend className="sr-only">{SHEET_TITLES[kind][id ? 1 : 0]}</legend>
          {kind === 'zones' && <>
            <Input label="구역 코드" required maxLength={30} value={form.code} error={errors.code} placeholder="예: R-201" onChange={(value) => set('code', value)} />
            <Input label="구역 이름" required maxLength={100} value={form.name} error={errors.name} onChange={(value) => set('name', value)} />
            <Input label="구역 유형" maxLength={30} value={form.zoneType} placeholder="예: PROCESS, TANK" onChange={(value) => set('zoneType', value)} />
            <Check label="밀폐공간" checked={form.confined} onChange={(value) => set('confined', value)} />
            <label className="risk-field risk-field--wide site-field"><span className="risk-field__label">유해·위험 참고</span>
              <textarea rows={3} maxLength={500} value={form.hazardNote} aria-invalid={Boolean(errors.hazardNote)} onChange={(event) => set('hazardNote', event.target.value)} />
              <span className={`site-field__hint${errors.hazardNote ? ' is-error' : ''}`}>{errors.hazardNote || `${form.hazardNote.length}/500자`}</span></label>
            {id && <Check label="사용 중 (끄면 새 작업·점검에서 고를 수 없음)" checked={form.active} onChange={(value) => set('active', value)} />}
          </>}
          {kind === 'equipment' && <>
            <Input label="설비 코드" required maxLength={30} value={form.code} error={errors.code} placeholder="예: P-02" onChange={(value) => set('code', value)} />
            <Input label="설비 이름" required maxLength={100} value={form.name} error={errors.name} placeholder="예: 2번 이송 펌프" onChange={(value) => set('name', value)} />
            <Input label="설비 종류" required maxLength={30} value={form.equipmentType} error={errors.equipmentType} hint="영문 대문자·숫자·_ · 예: CRANE, LIFT, WELDER, GAS_DETECTOR" list="site-equipment-types" onChange={(value) => set('equipmentType', value.toUpperCase())} />
            <datalist id="site-equipment-types">{['CRANE', 'LIFT', 'WELDER', 'GAS_DETECTOR', 'PUMP', 'FAN', 'COMPRESSOR'].map((type) => <option key={type} value={type} />)}</datalist>
            <label className="risk-field site-field"><span className="risk-field__label">놓인 구역</span>
              <select value={form.zoneId} onChange={(event) => set('zoneId', event.target.value)}>
                <option value="">구역 없음</option>
                {activeZones.map((zone) => <option key={zone.zoneId} value={zone.zoneId}>{zone.code} · {zone.name}{zone.active ? '' : ' (사용 중지)'}</option>)}
              </select><span className="site-field__hint" /></label>
            <Input label="다음 점검·교정일" type="date" max="9999-12-31" value={form.nextInspectionDate} hint="지나면 점검 기한 지남으로 표시" onChange={(value) => set('nextInspectionDate', value)} />
            {id && <Check label="사용 중 (끄면 점검표 대상에서 빠짐)" checked={form.active} onChange={(value) => set('active', value)} />}
          </>}
          {kind === 'workers' && <>
            <Input label="이름" required maxLength={50} value={form.name} onChange={(value) => set('name', value)} />
            <div className="risk-field site-field">
              <label htmlFor="worker-phone" className="risk-field__label">{id ? '연락처 (비우면 기존 값 유지)' : '연락처'}</label>
              <PhoneInput id="worker-phone" className="phone-input--app" parts={form.phoneParts} disabled={form.clearPhone} invalid={Boolean(errors.phone)} describedBy="worker-phone-help"
                onChange={(parts) => setEdit({ ...edit, errors: { ...errors, phone: '' }, form: { ...form, phoneParts: parts, phone: joinPhone(parts) } })} />
              <span id="worker-phone-help" className={`site-field__hint${errors.phone ? ' is-error' : ''}`}>{errors.phone || '숫자만 칸별로 입력하세요.'}</span>
            </div>
            {id && <Check label="기존 연락처 지우기" checked={form.clearPhone} onChange={(value) => set('clearPhone', value)} />}
            <Input label="직종" maxLength={50} value={form.jobType ?? ''} placeholder="예: 용접공" onChange={(value) => set('jobType', value)} />
            <label className="risk-field site-field"><span className="risk-field__label">고용 형태</span>
              <select value={form.employmentType} onChange={(event) => set('employmentType', event.target.value)}>
                {Object.entries(EMPLOYMENT_LABELS).map(([value, text]) => <option key={value} value={value}>{text}</option>)}
              </select><span className="site-field__hint" /></label>
            <label className="risk-field site-field"><span className="risk-field__label">팀</span>
              <select value={form.teamId} disabled={!data.resources.teams} onChange={(event) => set('teamId', event.target.value)}>
                <option value="">미지정</option>
                {activeTeams.map((team) => <option key={team.teamId} value={team.teamId}>{team.name}</option>)}
                {form.teamId && !activeTeams.some((team) => String(team.teamId) === String(form.teamId)) && <option value={form.teamId}>기존 팀 #{form.teamId} (사용 중지)</option>}
              </select><span className="site-field__hint" /></label>
            {!id && <Input label="배치 시작일" type="date" max="9999-12-31" value={form.assignedFrom} hint="비우면 오늘" onChange={(value) => set('assignedFrom', value)} />}
          </>}
          {kind === 'teams' && <>
            <Input label="팀·업체 이름" required maxLength={100} value={form.name} error={errors.name} onChange={(value) => set('name', value)} />
            <label className="risk-field site-field"><span className="risk-field__label">유형</span>
              <select value={form.teamType} onChange={(event) => set('teamType', event.target.value)}>
                {Object.entries(TEAM_TYPE_LABELS).map(([value, text]) => <option key={value} value={value}>{text}</option>)}
              </select><span className="site-field__hint" /></label>
            {form.teamType === 'EXTERNAL' && <Input label="사업자등록번호" maxLength={12} value={form.businessNo} error={errors.businessNo} placeholder="000-00-00000" onChange={(value) => set('businessNo', value)} />}
            {id && <Check label="사용 중" checked={form.active} onChange={(value) => set('active', value)} />}
          </>}
        </fieldset>
      </form>
      {kind === 'workers' && id && (
        <section className="site-leave" aria-label="현장 떠남">
          <h3>현장 떠남</h3>
          <p className="rec-help">떠난 작업자는 TBM 참석자 목록에서 빠집니다. 다시 오면 작업자 탭의 "다시 배치"로 되돌립니다.</p>
          {leaving == null
            ? <button type="button" className="ui-btn ui-btn--ghost site-leave__btn" disabled={!data.can('workers')} onClick={() => setLeaving(localDate())}>떠남 처리…</button>
            : (
              <div className="site-leave__confirm">
                <label className="risk-field"><span className="risk-field__label">떠난 날</span><input type="date" max="9999-12-31" value={leaving} onChange={(event) => setLeaving(event.target.value)} /></label>
                <button type="button" className="ui-btn ui-btn--ghost" onClick={() => setLeaving(null)}>그만두기</button>
                <button type="button" className="ui-btn site-leave__danger" disabled={!data.can('workers')} onClick={async () => { if (await data.leave(id, leaving)) close(); }}>{form.name} 떠남 확정</button>
              </div>
            )}
        </section>
      )}
    </Sheet>
  );
}

function Check({ label, checked, onChange }) {
  return (
    <label className="site-check risk-field--wide">
      <input type="checkbox" checked={Boolean(checked)} onChange={(event) => onChange(event.target.checked)} />
      <span>{label}</span>
    </label>
  );
}
