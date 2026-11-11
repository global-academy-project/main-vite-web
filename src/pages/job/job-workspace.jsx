import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useWorkSite } from '../../api/workers';
import JobPageLayout from '../../components/job-page-layout';
import WorkIncidentWarnings from '../../components/work-incident-warnings';
import PageHeader from '../../components/ui/page-header.jsx';
import AgentSheet from '../../components/work/agent-sheet.jsx';
import { Badge } from '../../components/home/panel.jsx';
import WorkCreateForm from '../../components/work/work-create-form.jsx';
import { DocPanel } from '../../components/work/doc-panels.jsx';
import { docLoaders } from '../../components/work/doc-loaders.js';
import ErrorBoundary from '../../components/ui/error-boundary.jsx';
import Icon from '../../components/ui/icon.jsx';
import Sheet from '../../components/ui/sheet.jsx';
import StatusView, { Skeleton } from '../../components/ui/status-view.jsx';
import StepIndicator from '../../components/ui/step-indicator.jsx';
import { useAgentConversation } from '../../hooks/use-agent-conversation.js';
import { useWorkHub } from '../../hooks/use-work-hub.js';
import { useWorkList } from '../../hooks/use-work-list.js';
import { usePeriod } from '../../hooks/use-period.js';
import PeriodBar from '../../components/period-bar.jsx';
import {
  nextAction, PERMIT_STATUS_LABELS, workReady, RISK_STATUS_LABELS, TBM_STATUS_LABELS, timeRange, toneOf, WORK_STATUS_LABELS, WORK_TYPE_LABELS, workStages,
} from '../../utils/home-model.js';
import { jobRecordPath } from '../../utils/job-forms.js';
import { filterWorks, hubDocs, parseDocParam, sortWorks, withBack, workStats } from '../../utils/work-list-model.js';
import '../../styles/home.css';
import '../../styles/work.css';
import '../../styles/risk.css';

const docStatusLabel = (doc) => (doc.type === 'RISK' ? RISK_STATUS_LABELS : doc.type === 'PERMIT' ? PERMIT_STATUS_LABELS : TBM_STATUS_LABELS)[doc.status] ?? doc.status;

/**
 * 작업: ?workId 가 없으면 작업 목록, 있으면 작업 허브(단계 + 지금 할 일 + 문서 드로어).
 * 문서를 열면 주소에 doc=PERMIT-31 처럼 남아 새로고침·공유해도 같은 문서가 열린다.
 */
export default function JobWorkspace() {
  const context = useWorkSite();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const workId = params.get('workId');
  const [sheet, setSheet] = useState(null); // 'create' | 'agent'
  const [assistantTab, setAssistantTab] = useState('WORK_REGISTER');
  const site = context.currentSite;
  // AI 대화는 시트 밖(이 화면)에 두어 시트를 닫았다 열어도 남는다. 현장이 바뀌면 훅이 새 대화로 비운다
  const agentWork = useAgentConversation({ siteId: site?.siteId, taskType: 'WORK_REGISTER' });
  const agentRecord = useAgentConversation({ siteId: site?.siteId, taskType: 'RECORD_QUERY' });

  // 허브에서 현장을 바꾸면 그 작업은 다른 현장 것이므로 목록으로 돌아간다


  return (
    <JobPageLayout title={workId ? '작업 허브' : '작업'} user={context.account?.user} contentClassName="work-page">
      {!site ? <PageHeader title="작업" context={context} /> : (
        <>
          {workId
            ? <ErrorBoundary resetKeys={[workId]}><WorkHub site={site} context={context} workId={workId} params={params} setParams={setParams} /></ErrorBoundary>
            : <WorkList site={site} context={context} onCreate={() => setSheet('create')} onAgent={() => setSheet('agent')} />}
        </>
      )}

      <Sheet open={sheet === 'create'} onClose={() => setSheet(null)} title="작업 직접 등록" subtitle={site?.name}
        footer={<><button type="button" className="ui-btn ui-btn--ghost" onClick={() => setSheet(null)}>취소</button><button type="submit" form="work-create-form" className="ui-btn ui-btn--primary ui-btn--lg">작업 저장</button></>}>
        {site && <WorkCreateForm site={site} disabled={context.selecting} onCreated={(saved) => { setSheet(null); navigate(`/job/workspace?workId=${saved.workId}`); }} />}
      </Sheet>

      <Sheet open={sheet === 'agent'} onClose={() => setSheet(null)} title="AI 대화" subtitle={`${site?.name ?? ''} · 허가서 연결 · 실행 번호로 다시 조회`} wide>
        {site && <AgentSheet siteId={site.siteId} siteName={site.name} work={agentWork} record={agentRecord} tab={assistantTab} setTab={setAssistantTab} />}
      </Sheet>
    </JobPageLayout>
  );
}

/* ── 작업 목록 ─────────────────────────────────────────────── */

const TYPE_KEYS = Object.keys(WORK_TYPE_LABELS);

function WorkList({ site, context, onCreate, onAgent }) {
  const navigate = useNavigate();
  // 고른 기간은 다른 메뉴에 다녀와도 남는다 (같은 탭 동안). 서버 작업 목록은 한 번에 31일까지
  const period = usePeriod(`works:${site.siteId}`);
  const { from, to } = period;
  const [types, setTypes] = useState([]);
  const [stage, setStage] = useState(''); // 위 숫자 칸으로 고른 진행 칸 (utils/work-list-model.workStage)
  const [query, setQuery] = useState('');
  const [actionOnly, setActionOnly] = useState(false);
  const [lookup, setLookup] = useState('');
  const list = useWorkList(site.siteId, from, to);
  const all = useMemo(() => list.works.data ?? [], [list.works.data]);
  const rows = useMemo(() => sortWorks(filterWorks(all, { types, stage, query, actionOnly })), [all, types, stage, query, actionOnly]);
  const stats = workStats(all);
  const zoneName = (id) => list.zones.data?.find((zone) => zone.zoneId === id)?.name ?? (id ? `구역 #${id}` : '구역 미지정');


  return (
    <div className="work-list">
      <PageHeader title="작업" description="작업을 누르면 작업 허브에서 다음 할 일을 이어 갑니다." context={context}
        actions={<>
          <button type="button" className="ui-btn ui-btn--ghost" onClick={onAgent}>AI 대화</button>
          <Link className="ui-btn ui-btn--secondary" to="/dashboard">대화로 만들기</Link>
          <button type="button" className="ui-btn ui-btn--primary" onClick={onCreate}>작업 직접 등록</button>
        </>} />

      <ul className="work-stats" aria-label="작업 상태별 건수">
        {stats.map((stat) => {
          const active = stat.key === 'ALL' ? !stage : stage === stat.key;
          return (
            <li key={stat.key}>
              <button type="button" aria-pressed={active} className={`work-stat work-stat--${stat.tone}${active ? ' is-active' : ''}`}
                onClick={() => setStage(stat.key === 'ALL' || stage === stat.key ? '' : stat.key)}>
                <span className="work-stat__label">{stat.label}</span>
                <strong className="work-stat__value">{list.works.status === 'ready' ? stat.value : '–'}</strong>
              </button>
            </li>
          );
        })}
      </ul>

      <section className="work-filters" aria-label="작업 검색 조건">
        <div className="work-filters__row">
          <PeriodBar period={period} />
          <div className="work-types" role="group" aria-label="작업 종류">
            {TYPE_KEYS.map((type) => (
              <button key={type} type="button" className="work-chip" aria-pressed={types.includes(type)}
                onClick={() => setTypes((value) => (value.includes(type) ? value.filter((item) => item !== type) : [...value, type]))}>
                {types.includes(type) && <Icon name="check" size={14} />}{WORK_TYPE_LABELS[type]}
              </button>
            ))}
          </div>
        </div>
        <div className="work-filters__row">
          <label className="work-search"><span className="sr-only">작업명 검색</span>
            <input type="search" value={query} placeholder="작업명 검색" onChange={(event) => setQuery(event.target.value)} />
          </label>
          <label className="work-toggle"><input type="checkbox" checked={actionOnly} onChange={(event) => setActionOnly(event.target.checked)} />할 일 있는 작업만</label>
          <form className="work-lookup" onSubmit={(event) => { event.preventDefault(); if (/^\d+$/.test(lookup.trim())) navigate(`/job/workspace?workId=${lookup.trim()}`); }}>
            <label><span className="sr-only">작업 번호로 찾기</span><input inputMode="numeric" value={lookup} placeholder="작업 번호" onChange={(event) => setLookup(event.target.value)} /></label>
            <button type="submit" className="ui-btn ui-btn--ghost" disabled={!/^\d+$/.test(lookup.trim())}>열기</button>
          </form>
        </div>
        <p className="work-filters__help" role={period.error ? 'alert' : undefined}>{period.error || `${from === to ? from : `${from} ~ ${to}`} · ${rows.length}건 표시`}</p>
      </section>

      <section className="home-panel work-table-panel" aria-label="작업 목록">
        {list.works.status === 'loading' && <div className="home-panel__pad"><Skeleton lines={6} /></div>}
        {list.works.status === 'error' && <StatusView kind={list.works.code === 403 ? 'forbidden' : 'error'} message={list.works.error} onRetry={list.reload} />}
        {list.works.status === 'ready' && !rows.length && (
          <StatusView kind="empty" title={all.length ? '조건에 맞는 작업이 없습니다' : '이 기간에 등록된 작업이 없습니다'}
            message={all.length ? '검색 조건을 바꿔 보세요.' : '대화로 만들거나 직접 등록하세요.'}
            action={all.length ? { label: '조건 초기화', onClick: () => { setTypes([]); setStage(''); setQuery(''); setActionOnly(false); } } : { label: '작업 직접 등록', onClick: onCreate }} />
        )}
        {list.works.status === 'ready' && rows.length > 0 && (
          <table className="home-table work-table">
            <thead>
              <tr><th scope="col">작업일</th><th scope="col">작업</th><th scope="col">종류</th><th scope="col">위험성평가</th><th scope="col">허가</th><th scope="col">TBM</th><th scope="col">진행</th><th scope="col">지금 할 일</th></tr>
            </thead>
            <tbody>
              {rows.map((work) => {
                const stages = workStages(work);
                const next = nextAction(work);
                const permits = (work.permits ?? []).filter((permit) => permit.status !== 'SUPERSEDED');
                return (
                  <tr key={work.workId}>
                    <td data-label="작업일" className="work-table__date">{work.workDate?.slice(5).replace('-', '/')}</td>
                    <td data-label="작업">
                      <span className="home-table__name"><Link to={`/job/workspace?workId=${work.workId}`} className="home-table__title">{work.title}</Link><span className="work-table__id">#{work.workId}</span></span>
                      <span className={`home-table__facts${work.zoneId ? '' : ' is-warn'}`}>{[zoneName(work.zoneId), timeRange(work.startAt, work.endAt), work.workerCount != null ? `${work.workerCount}명` : ''].filter(Boolean).join(' · ')}</span>
                    </td>
                    <td data-label="종류"><Badge tone={work.highRisk ? 'warn' : 'neutral'}>{WORK_TYPE_LABELS[work.workType] ?? work.workType}</Badge></td>
                    <td data-label="위험성평가">{work.riskAssessment ? <Badge tone={toneOf(work.riskAssessment.status)}>{RISK_STATUS_LABELS[work.riskAssessment.status]}</Badge> : <span className="work-none">없음</span>}</td>
                    <td data-label="허가">{permits.length ? <span className="work-badges">{permits.map((permit) => <Badge key={permit.permitId} tone={toneOf(permit.status)}>{PERMIT_STATUS_LABELS[permit.status]}</Badge>)}</span> : <span className="work-none">{work.workType === 'GENERAL' ? '해당 없음' : '없음'}</span>}</td>
                    <td data-label="TBM">{work.tbm ? <Badge tone={toneOf(work.tbm.status)}>{TBM_STATUS_LABELS[work.tbm.status]}</Badge> : <span className="work-none">없음</span>}</td>
                    <td data-label="진행">
                      <span className="home-dots" role="img" aria-label={stages.map((step) => `${step.label} ${step.hint || step.state}`).join(', ')}>
                        {stages.map((step) => <span key={step.key} className={`home-dot home-dot--${step.state}`} title={`${step.label} · ${step.hint || ''}`} />)}
                      </span>
                    </td>
                    <td data-label="지금 할 일">{next.path ? <Link to={`/job/workspace?workId=${work.workId}`} className={`home-next home-next--${next.tone}`}>{next.label}</Link> : <Badge tone={next.tone}>{next.label}</Badge>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

/* ── 작업 허브 ─────────────────────────────────────────────── */

function WorkHub({ site, context, workId, params, setParams }) {
  const hub = useWorkHub(site.siteId, workId);
  const docParam = parseDocParam(params.get('doc'));
  const [entry, setEntry] = useState(null);
  const work = hub.work;
  const docs = useMemo(() => hubDocs(work), [work]);
  const openDoc = docParam ? docs.find((doc) => doc.key === docParam.key) ?? { ...docParam, label: docParam.type } : null;

  // 열린 문서 조회: effect 안에서 부르고 응답 콜백에서만 상태를 바꾼다. 문서가 바뀌면 늦게 온 응답은 버린다.
  const [docRevision, setDocRevision] = useState(0);
  const openKey = openDoc?.key;
  const siteId = site.siteId;
  useEffect(() => {
    const doc = parseDocParam(openKey);
    if (!doc) return undefined;
    let cancelled = false;
    docLoaders[doc.type](doc, siteId)
      .then((data) => { if (!cancelled) setEntry({ key: doc.key, status: 'ready', data }); })
      .catch((error) => { if (!cancelled) setEntry({ key: doc.key, status: 'error', error: error.message }); });
    return () => { cancelled = true; };
  }, [openKey, siteId, docRevision]);
  const reloadDoc = useCallback(() => setDocRevision((value) => value + 1), []);

  const open = (doc) => setParams({ workId, doc: doc.key });
  const close = () => setParams({ workId }, { replace: true });

  if (hub.status === 'loading') return <div className="work-hub"><Skeleton lines={8} height={20} /></div>;
  if (hub.status === 'error') {
    return <StatusView kind={hub.code === 403 ? 'forbidden' : hub.code === 404 ? 'empty' : 'error'} title={hub.code === 404 ? '작업을 찾을 수 없습니다' : undefined} message={hub.error} onRetry={hub.reload} action={hub.code === 404 ? { label: '작업 목록', onClick: () => setParams({}) } : undefined} />;
  }

  const stages = workStages(work);
  const next = nextAction(work);
  const zone = hub.zones.find((item) => item.zoneId === work.zoneId);
  const docForStage = (key) => docs.find((doc) => doc.type === ({ risk: 'RISK', permit: 'PERMIT', tbm: 'TBM' })[key]);
  const nextDoc = next.path ? docs.find((doc) => doc.id && next.path === jobRecordPath(doc.type, doc.id)) : null;

  return (
    <div className="work-hub">
      <PageHeader title={work.title} context={context} onBeforeSelect={() => setParams({})}
        badges={<><Badge tone={work.highRisk ? 'warn' : 'neutral'}>{WORK_TYPE_LABELS[work.workType] ?? work.workType}</Badge>{/* 작업 상태는 서버에서 바뀌지 않아(작업 승인·종료 API 없음) 문서가 다 승인됐는지로 보인다 */}<Badge tone={workReady(work) ? 'done' : toneOf(work.status)}>{workReady(work) ? '작업 준비 완료' : work.status === 'DRAFT' ? '준비 중' : (WORK_STATUS_LABELS[work.status] ?? work.status)}</Badge></>}
        description={`작업 #${work.workId} · ${zone?.name ?? (work.zoneId ? `구역 #${work.zoneId}` : '구역 미지정')} · ${work.workDate} ${timeRange(work.startAt, work.endAt)} · 작업자 ${work.workerCount ?? '-'}명`}
        actions={<Link className="ui-btn ui-btn--ghost" to="/job/workspace">작업 목록</Link>} />
      {hub.error && <p className="work-form__error" role="alert"><Icon name="alert" size={16} />{hub.error}</p>}

      <section className="home-panel work-progress" aria-label="진행 단계">
        <div className="work-progress__steps">
          <StepIndicator steps={stages} onSelect={(key) => { const doc = docForStage(key); if (doc?.id) open(doc); }} />
        </div>
        <div className={`work-next work-next--${next.tone}`}>
          <span className="work-next__text"><span className="work-next__eyebrow">지금 할 일</span><strong>{next.label}</strong></span>
          {nextDoc ? <button type="button" className="ui-btn ui-btn--primary ui-btn--lg" onClick={() => open(nextDoc)}>지금 하기</button>
            : next.path ? <Link className="ui-btn ui-btn--primary ui-btn--lg" to={withBack(next.path, work.workId)}>지금 하기</Link> : null}
        </div>
      </section>

      <div className="work-hub__grid">
        <section aria-labelledby="hub-docs" className="work-docs">
          <h2 id="hub-docs" className="work-sec">문서</h2>
          <ul className="work-docs__list">
            {docs.map((doc) => (
              <li key={doc.key} className={`work-doc${doc.id ? '' : ' is-missing'}`}>
                <div className="work-doc__head">
                  <h3 className="work-doc__title">{doc.label}</h3>
                  {doc.id ? <Badge tone={toneOf(doc.status)}>{docStatusLabel(doc)}</Badge> : <Badge tone="todo">작성 전</Badge>}
                </div>
                <p className="work-doc__meta">{doc.id ? `${doc.permitNo ?? `#${doc.id}`}` : '아직 만들지 않았습니다.'}</p>
                <div className="work-doc__actions">
                  {doc.id ? <>
                    <button type="button" className="ui-btn ui-btn--secondary" onClick={() => open(doc)}>열기</button>
                    <Link className="ui-btn ui-btn--ghost" to={withBack(jobRecordPath(doc.type, doc.id), work.workId)}>전체 화면</Link>
                  </> : <Link className="ui-btn ui-btn--secondary" to={withBack(doc.createPath, work.workId)}>작성하기</Link>}
                </div>
              </li>
            ))}
          </ul>
          {work.briefMissing && <p className="work-filters__help">붙은 문서 요약을 찾지 못했습니다. 각 화면에서 직접 확인하세요.</p>}
          {work.description && <><h2 className="work-sec">작업 내용</h2><p className="work-desc">{work.description}</p></>}
        </section>
        <section aria-label="관련 아차사고 경고" className="home-panel work-warnings">
          <WorkIncidentWarnings key={`work-warnings-${work.workId}`} siteId={site.siteId} initialWorkId={work.workId} />
        </section>
      </div>

      <Sheet open={Boolean(openDoc)} onClose={close} title={openDoc?.label ?? ''} subtitle={openDoc?.id ? jobRecordPath(openDoc.type, openDoc.id) : ''}
        actions={openDoc?.id && <Link className="ui-icon-btn" to={withBack(jobRecordPath(openDoc.type, openDoc.id), work.workId)} aria-label="전체 화면으로 열기"><Icon name="external" size={18} /></Link>}>
        {openDoc && (
          <DocPanel doc={openDoc} entry={entry?.key === openDoc.key ? entry : null} siteId={site.siteId} zones={hub.zones} backWorkId={work.workId} showFull
            onReload={reloadDoc} onDone={() => { reloadDoc(); hub.reload(); }} />
        )}
      </Sheet>
    </div>
  );
}
