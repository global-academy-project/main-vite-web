import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useWorkSite } from '../../api/workers';
import { getSiteWorks } from '../../api/jobs';
import JobPageLayout from '../../components/job-page-layout';
import PageHeader from '../../components/ui/page-header.jsx';
import { TagChips, TagEditor } from '../../components/incident-tags';
import WorkIncidentWarnings from '../../components/work-incident-warnings';
import { Badge } from '../../components/home/panel.jsx';
import Field from '../../components/ui/field.jsx';
import Icon from '../../components/ui/icon.jsx';
import Sheet from '../../components/ui/sheet.jsx';
import StatusView, { Skeleton } from '../../components/ui/status-view.jsx';
import { useIncidents } from '../../hooks/use-incidents.js';
import {
  accidentTypes, EMPTY_INCIDENT_FILTERS, filterIncidents, hasIncidentFilters, INCIDENT_STATUS_LABELS, incidentStats, severityOf, shortOccurred, validateIncidentForm,
} from '../../utils/incident-model.js';
import { localDate } from '../../utils/job-forms';
import { WORK_TYPE_LABELS } from '../../utils/home-model.js';
import '../../style/job/job-incidents.css';
import '../../styles/home.css';
import '../../styles/work.css';
import '../../styles/approvals.css';
import '../../styles/records.css';

const TABS = [{ key: 'reports', label: '보고 목록' }, { key: 'warnings', label: '작업 경고' }];
const pad2 = (value) => String(value).padStart(2, '0');
const nowLocalMinute = (date = new Date()) => `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}T${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
const EMPTY_FORM = { title: '', zoneId: '', workId: '', occurredAt: '', description: '', immediateAction: '' };

/**
 * 아차사고. 보고 목록(표) + 보고 열기(오른쪽 드로어 / 모바일 바텀 시트: 내용 · 태그 검토 · 관련 사고) + 작업 경고 탭.
 * 주소: ?incidentId=보고번호 (드로어), ?tab=warnings&workId=작업번호 (작업 경고)
 */
export default function JobIncidents() {
  const context = useWorkSite();
  const site = context.currentSite;
  return (
    <JobPageLayout title="아차사고" user={context.account?.user} contentClassName="work-page">
      {site
        ? <IncidentPage key={site.siteId} site={site} context={context} reporter={context.account?.user} />
        : <PageHeader title="아차사고" context={context} />}
    </JobPageLayout>
  );
}

function IncidentPage({ site, context, reporter }) {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'warnings' ? 'warnings' : 'reports';
  const openId = /^\d+$/.test(params.get('incidentId') ?? '') ? params.get('incidentId') : null;
  const data = useIncidents({ siteId: site.siteId, initialId: openId, disabled: context.selecting });
  const [creating, setCreating] = useState(false);

  const setQuery = (next) => {
    const merged = { tab: tab === 'warnings' ? 'warnings' : '', incidentId: openId ?? '', workId: params.get('workId') ?? '', ...next };
    setParams(Object.fromEntries(Object.entries(merged).filter(([, value]) => value)));
  };
  const openIncident = async (id) => { if (await data.open(id)) setQuery({ incidentId: String(id) }); };
  // 알림·다른 화면 링크로 주소의 보고 번호만 바뀌었을 때도 그 보고를 연다 (같은 번호는 한 번만 시도)
  const tried = useRef(openId);
  const { loading, selected, open } = data;
  useEffect(() => {
    if (!openId || loading || String(selected?.nearMissId ?? '') === openId || tried.current === openId) return;
    tried.current = openId;
    void open(openId);
  }, [openId, loading, selected, open]);
  const closeIncident = () => { data.close(); setQuery({ incidentId: '' }); };

  return (
    <div className="work-list rec-page">
      <PageHeader title="아차사고" description="보고하면 같은 구역 작업에 경고가 자동으로 붙습니다." context={context} onBeforeSelect={() => setParams({})}
        actions={<>
          <button type="button" className="ui-btn ui-btn--ghost" disabled={data.busy} onClick={data.reload}><Icon name="refresh" size={16} />새로고침</button>
          <button type="button" className="ui-btn ui-btn--primary" disabled={data.locked} onClick={() => setCreating(true)}>보고 작성</button>
        </>} />

      {data.uncertain && (
        <div className="work-form__error" role="alert">
          <Icon name="warning" size={16} />
          <span>저장 결과가 불확실합니다. 최신 보고를 다시 받아 반영 여부를 확인할 때까지 추가 저장을 멈췄습니다.</span>
          <button type="button" className="ui-btn ui-btn--ghost" disabled={data.busy || data.loading} onClick={() => {
            if (window.confirm('최신 목록과 보고 내용에서 저장 여부를 확인했습니까? 확인 후 잠금을 해제합니다.')) data.unlock();
          }}>반영 여부 확인 후 잠금 해제</button>
        </div>
      )}
      {data.error && !openId && !creating && <p className="work-form__error" role="alert"><Icon name="alert" size={16} />{data.error}</p>}

      <div className="home-assistant__tabs appr-tabs" role="tablist" aria-label="아차사고 화면">
        {TABS.map((item) => (
          <button key={item.key} type="button" role="tab" aria-selected={tab === item.key} className={`home-assistant__tab${tab === item.key ? ' is-active' : ''}`}
            onClick={() => setQuery({ tab: item.key === 'warnings' ? 'warnings' : '', workId: '' })}>
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'reports'
        ? <ReportList data={data} onOpen={openIncident} onCreate={() => setCreating(true)} openId={openId} />
        : <WarningsTab site={site} workId={params.get('workId')} onPick={(workId) => setQuery({ workId: String(workId) })} disabled={context.selecting} />}

      <Sheet open={Boolean(openId)} onClose={closeIncident} wide
        title={data.selected ? data.selected.title : '아차사고'} subtitle={openId ? `아차사고 #${openId}` : ''}>
        {openId && <IncidentDetail data={data} openId={openId} onOpen={openIncident} />}
      </Sheet>

      <Sheet open={creating} onClose={() => setCreating(false)} title="아차사고 보고" subtitle={site.name}
        footer={<><button type="button" className="ui-btn ui-btn--ghost" onClick={() => setCreating(false)}>취소</button><button type="submit" form="incident-create-form" className="ui-btn ui-btn--primary ui-btn--lg" disabled={data.locked}>보고 저장</button></>}>
        {creating && <IncidentForm data={data} reporter={reporter} onSaved={(saved) => { setCreating(false); setQuery({ incidentId: String(saved.nearMissId), tab: '' }); }} />}
      </Sheet>
    </div>
  );
}

function ReportList({ data, onOpen, onCreate, openId }) {
  const [filters, setFilters] = useState(EMPTY_INCIDENT_FILTERS);
  const incidents = useMemo(() => data.resources?.incidents ?? [], [data.resources]);
  const rows = useMemo(() => filterIncidents(incidents, filters), [incidents, filters]);
  const stats = incidentStats(incidents);
  const codes = data.resources?.codes ?? [];
  const zones = data.resources?.zones ?? [];
  const zoneName = (id) => zones.find((zone) => zone.zoneId === id)?.name ?? (id ? `구역 #${id}` : '구역 미지정');
  const update = (key, value) => setFilters((prev) => ({ ...prev, [key]: value }));
  const ready = Boolean(data.resources) && !data.loading;

  return (
    <>
      <ul className="work-stats" aria-label="보고 건수">
        {[
          { key: '', label: '전체 (최근 50건)', value: stats.total, tone: 'neutral' },
          { key: 'week', label: '최근 7일', value: stats.week, tone: 'wait' },
          { key: 'untagged', label: '태그 없음', value: stats.untagged, tone: 'block' },
        ].map((stat) => (
          <li key={stat.key || 'all'}>
            <button type="button" aria-pressed={filters.view === stat.key} className={`work-stat work-stat--${stat.tone}${filters.view === stat.key ? ' is-active' : ''}`} onClick={() => update('view', stat.key)}>
              <span className="work-stat__label">{stat.label}</span>
              <strong className="work-stat__value">{ready ? stat.value : '–'}</strong>
            </button>
          </li>
        ))}
      </ul>

      <section className="work-filters" aria-label="보고 검색 조건">
        <div className="work-filters__row">
          <label className="appr-select"><span className="sr-only">구역</span>
            <select value={filters.zoneId} onChange={(event) => update('zoneId', event.target.value)}>
              <option value="">구역 전체</option>
              {zones.map((zone) => <option key={zone.zoneId} value={zone.zoneId}>{zone.code} · {zone.name}</option>)}
            </select>
          </label>
          <div className="work-period" role="group" aria-label="발생일">
            <label><span className="sr-only">발생일 시작</span><input type="date" value={filters.from} max={filters.to || '9999-12-31'} onChange={(event) => update('from', event.target.value)} /></label>
            <span aria-hidden="true">~</span>
            <label><span className="sr-only">발생일 끝</span><input type="date" max="9999-12-31" value={filters.to} min={filters.from || undefined} onChange={(event) => update('to', event.target.value)} /></label>
          </div>
          <label className="work-search"><span className="sr-only">제목·내용 검색</span>
            <input type="search" value={filters.keyword} placeholder="제목·내용 검색" onChange={(event) => update('keyword', event.target.value)} />
          </label>
          {hasIncidentFilters(filters) && <button type="button" className="ui-btn ui-btn--ghost" onClick={() => setFilters(EMPTY_INCIDENT_FILTERS)}>조건 초기화</button>}
        </div>
      </section>

      <section className="home-panel work-table-panel" aria-label="보고 목록">
        {!ready && !data.loadError && <div className="home-panel__pad"><Skeleton lines={6} /></div>}
        {data.loadError && <StatusView kind="error" message={data.loadError} onRetry={data.reload} />}
        {ready && !rows.length && (
          <StatusView kind="empty" title={incidents.length ? '조건에 맞는 보고가 없습니다' : '아직 저장된 보고가 없습니다'}
            message={incidents.length ? '검색 조건을 바꿔 보세요.' : '위험할 뻔한 일을 보고하면 같은 구역 작업에 경고가 붙습니다.'}
            action={incidents.length ? { label: '조건 초기화', onClick: () => setFilters(EMPTY_INCIDENT_FILTERS) } : { label: '보고 작성', onClick: onCreate }} />
        )}
        {ready && rows.length > 0 && (
          <table className="home-table rec-table">
            <thead><tr><th scope="col">발생</th><th scope="col">보고</th><th scope="col">구역</th><th scope="col">중대도</th><th scope="col">사고 유형</th><th scope="col">관련 작업</th><th scope="col"><span className="sr-only">열기</span></th></tr></thead>
            <tbody>
              {rows.map((item) => {
                const severity = severityOf(item, codes);
                const types = accidentTypes(item, codes);
                return (
                  <tr key={item.nearMissId} className={String(item.nearMissId) === openId ? 'is-new' : ''}>
                    <td data-label="발생" className="work-table__date">{shortOccurred(item.occurredAt)}</td>
                    <td data-label="보고">
                      <span className="home-table__name"><button type="button" className="appr-row-title" onClick={() => onOpen(item.nearMissId)}>{item.title}</button><span className="work-table__id">#{item.nearMissId}</span></span>
                      {item.description && <span className="home-table__facts rec-snippet">{item.description}</span>}
                    </td>
                    <td data-label="구역">{zoneName(item.zoneId)}</td>
                    <td data-label="중대도">{severity ? <Badge tone={severity.tone}>{severity.label}</Badge> : <span className="work-none">미분류</span>}</td>
                    <td data-label="사고 유형">{types.length ? types.join(', ') : <span className="work-none">미분류</span>}</td>
                    <td data-label="관련 작업">{item.workId ? <Link className="home-panel__link" to={`/job/workspace?workId=${item.workId}`}>작업 #{item.workId}</Link> : <span className="work-none">없음</span>}</td>
                    <td data-label="열기"><button type="button" className="ui-btn ui-btn--secondary appr-open" disabled={data.busy} onClick={() => onOpen(item.nearMissId)}>보기</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
      <p className="work-filters__help">서버가 주는 최근 50건 안에서 조건을 적용합니다.</p>
    </>
  );
}

function IncidentDetail({ data, openId, onOpen }) {
  const [query, setQuery] = useState('');
  const incident = data.selected;
  if (!incident || String(incident.nearMissId) !== openId) {
    if (data.error) return <StatusView kind="error" compact message={data.error} onRetry={() => onOpen(openId)} />;
    return <div className="home-panel__pad"><Skeleton lines={6} /></div>;
  }
  const codes = data.resources?.codes ?? [];
  const zone = data.resources?.zones.find((item) => item.zoneId === incident.zoneId);
  return (
    <div className="rec-detail">
      {data.error && <p className="work-form__error" role="alert"><Icon name="alert" size={16} />{data.error}</p>}
      <dl className="rec-facts">
        <div><dt>발생 일시</dt><dd>{incident.occurredAt?.replace('T', ' ').slice(0, 16) ?? '-'}</dd></div>
        <div><dt>구역</dt><dd>{zone ? `${zone.code} · ${zone.name}` : '구역 미지정'}</dd></div>
        <div><dt>관련 작업</dt><dd>{incident.workId ? <Link to={`/job/workspace?workId=${incident.workId}`}>작업 #{incident.workId}</Link> : '없음'}</dd></div>
        <div><dt>상태</dt><dd>{INCIDENT_STATUS_LABELS[incident.status] ?? incident.status ?? '-'} · 판 {incident.lockVersion}</dd></div>
      </dl>
      <section className="rec-block">
        <h3 className="rec-block__title">발생 상황</h3>
        <p className="rec-text">{incident.description}</p>
        {incident.immediateAction && <><h3 className="rec-block__title">즉시 조치</h3><p className="rec-text">{incident.immediateAction}</p></>}
      </section>

      <section className="rec-block">
        <div className="rec-block__head">
          <h3 className="rec-block__title">태그 검토</h3>
          {data.tagsDirty && <Badge tone="warn">저장 안 됨</Badge>}
        </div>
        <p className="rec-help">태그 저장은 전체 교체입니다. 다른 사용자가 먼저 저장해 판이 바뀌면 "최신 보고 다시 받기" 후 다시 검토하세요. 중대도는 하나만 고를 수 있습니다.</p>
        <div className="rec-tags"><TagEditor tags={data.tags} codes={codes} disabled={data.locked} onChange={data.setTags} /></div>
        <div className="rec-actions">
          <button type="button" className="ui-btn ui-btn--ghost" disabled={data.locked} onClick={() => onOpen(incident.nearMissId)}><Icon name="refresh" size={16} />최신 보고 다시 받기</button>
          <button type="button" className="ui-btn ui-btn--primary" disabled={data.locked || !data.tagsDirty} onClick={data.saveTags}>태그 저장</button>
        </div>
      </section>

      <section className="rec-block">
        <h3 className="rec-block__title">관련 사고 찾기</h3>
        <p className="rec-help">이 현장 안에서 지금 태그와 검색어로 비슷한 보고를 찾습니다. 공공 자료(MSDS·KOSHA 가이드 등) 검색은 AI 서버 검색이 연결된 뒤에 들어갑니다.</p>
        <form className="rec-search" onSubmit={(event) => { event.preventDefault(); void data.searchRelated(query); }}>
          <label className="work-search"><span className="sr-only">관련 사고 검색어</span>
            <input type="search" maxLength={500} value={query} disabled={data.locked} placeholder="검색어 (선택)" onChange={(event) => setQuery(event.target.value)} />
          </label>
          <button type="submit" className="ui-btn ui-btn--secondary" disabled={data.locked}>찾기</button>
        </form>
        {data.related && (data.related.length
          ? <ul className="rec-related">
            {data.related.map((item) => (
              <li key={item.nearMissId}>
                <button type="button" className="rec-related__item" onClick={() => onOpen(item.nearMissId)}>
                  <span className="rec-related__title">{item.title}<span className="work-table__id">#{item.nearMissId}</span></span>
                  <span className="rec-related__meta">{[item.zoneName, shortOccurred(item.occurredAt)].filter(Boolean).join(' · ')}</span>
                  {item.description && <span className="rec-related__desc">{item.description}</span>}
                  {item.immediateAction && <span className="rec-related__desc">당시 조치: {item.immediateAction}</span>}
                </button>
                <TagChips tags={item.tags} codes={codes} />
              </li>
            ))}
          </ul>
          : <p className="rec-help">조건과 일치하는 보고가 없습니다. 태그를 해제하거나 검색어를 바꿔 보세요.</p>)}
      </section>
    </div>
  );
}

function IncidentForm({ data, reporter, onSaved }) {
  // 발생 일시는 지금 시각을 기본으로 넣어 둔다 (고칠 수 있음)
  const [form, setForm] = useState(() => ({ ...EMPTY_FORM, occurredAt: nowLocalMinute() }));
  const [errors, setErrors] = useState({});
  const update = (key, value) => { setForm((prev) => ({ ...prev, [key]: value })); if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined })); };
  const submit = async (event) => {
    event.preventDefault();
    const found = validateIncidentForm(form);
    setErrors(found);
    if (Object.keys(found).length) return;
    const saved = await data.create(form);
    if (saved) onSaved(saved);
  };
  return (
    <form id="incident-create-form" className="rec-form" onSubmit={submit} noValidate>
      {data.error && <p className="work-form__error" role="alert"><Icon name="alert" size={16} />{data.error}</p>}
      <fieldset className="rec-form__fields" disabled={data.locked}>
        <legend className="sr-only">새 아차사고 보고</legend>
        <Field className="rec-form__wide" label="보고 제목" required maxLength={200} value={form.title} error={errors.title} placeholder="예: 탱크 맨홀 주변 미끄러짐" onChange={(event) => update('title', event.target.value)} />
        <Field label="발생 일시" required type="datetime-local" max="9999-12-31T23:59" value={form.occurredAt} error={errors.occurredAt} onChange={(event) => update('occurredAt', event.target.value)} />
        <div className="ui-field">
          <label className="ui-field__label" htmlFor="incident-zone">작업구역</label>
          <div className="ui-field__control">
            <select id="incident-zone" className="ui-field__input" value={form.zoneId} onChange={(event) => update('zoneId', event.target.value)}>
              <option value="">구역 미지정</option>
              {data.resources?.zones.map((zone) => <option key={zone.zoneId} value={zone.zoneId}>{zone.code} · {zone.name}</option>)}
            </select>
          </div>
          <span className="ui-field__help">같은 구역 작업에 경고가 붙습니다.</span>
        </div>
        <Field label="관련 작업 ID" hint="선택 · 작업 목록의 #번호" inputMode="numeric" value={form.workId} error={errors.workId} onChange={(event) => update('workId', event.target.value)} />
        <Field label="보고자" value={reporter?.name ?? reporter?.email ?? ''} readOnly />
        <Field className="rec-form__wide" label="발생 상황" required multiline rows={4} maxLength={20000} value={form.description} error={errors.description} placeholder="무엇이 어떻게 위험했는지 적어 주세요." onChange={(event) => update('description', event.target.value)} />
        <Field className="rec-form__wide" label="즉시 조치" multiline rows={3} maxLength={10000} value={form.immediateAction} error={errors.immediateAction} placeholder="바로 한 조치가 있으면 적어 주세요." onChange={(event) => update('immediateAction', event.target.value)} />
      </fieldset>
      <p className="work-form__help">자동 태깅은 이번 연결 범위에 들어 있지 않습니다. 저장한 뒤 보고를 열어 태그를 직접 검토해 주세요.</p>
    </form>
  );
}

/** 작업 경고: 왼쪽 작업 고르기(기본 오늘) → 오른쪽 그 작업의 경고(기존 부품) */
function WarningsTab({ site, workId, onPick, disabled }) {
  const [date, setDate] = useState(localDate);
  const [state, setState] = useState({ key: null, works: [], error: '' });
  const key = `${site.siteId}:${date}`;
  useEffect(() => {
    let active = true;
    getSiteWorks(site.siteId, date).then((works) => { if (active) setState({ key, works, error: '' }); })
      .catch((requestError) => { if (active) setState({ key, works: [], error: requestError.message || '작업 목록을 불러오지 못했습니다.' }); });
    return () => { active = false; };
  }, [site.siteId, date, key]);
  const loading = state.key !== key;
  const picked = /^\d+$/.test(workId ?? '') ? workId : null;

  return (
    <div className="rec-warn">
      <section className="home-panel rec-warn__works" aria-label="작업 고르기">
        <header className="home-panel__head">
          <h2 className="home-panel__title">작업</h2>
          <label className="rec-warn__date"><span className="sr-only">작업일</span><input type="date" max="9999-12-31" value={date} onChange={(event) => setDate(event.target.value)} /></label>
        </header>
        <div className="home-panel__body">
          {loading && <div className="home-panel__pad"><Skeleton lines={4} /></div>}
          {!loading && state.error && <StatusView kind="error" compact message={state.error} />}
          {!loading && !state.error && !state.works.length && <StatusView kind="empty" compact title="이 날짜에 등록된 작업이 없습니다" />}
          {!loading && state.works.length > 0 && (
            <ul className="home-list">
              {state.works.map((work) => (
                <li key={work.workId}>
                  <button type="button" className={`home-list__item rec-warn__work${String(work.workId) === picked ? ' is-active' : ''}`} aria-pressed={String(work.workId) === picked} onClick={() => onPick(work.workId)}>
                    <span className="home-list__main">
                      <span className="home-list__kind">{WORK_TYPE_LABELS[work.workType] ?? work.workType} · #{work.workId}</span>
                      <span className="home-list__title">{work.title}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
      <section className="home-panel work-warnings rec-warn__list" aria-label="작업 경고">
        {picked
          ? <WorkIncidentWarnings key={`${site.siteId}-${picked}`} siteId={site.siteId} initialWorkId={picked} disabled={disabled} />
          : <StatusView kind="empty" title="작업을 고르세요" message="왼쪽에서 작업을 고르면 그 작업에 붙은 아차사고 경고와 확인 기록이 보입니다. 긴급 경고는 확인할 때 조치 내용을 꼭 적어야 합니다." />}
      </section>
    </div>
  );
}
