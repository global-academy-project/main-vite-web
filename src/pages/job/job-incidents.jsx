import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useWorkSite } from '../../api/workers';
import {
  createIncident, getIncident, getIncidents, getSiteZones, getTagCodes,
  reviewIncidentTags, searchIncidents,
} from '../../api/incidents';
import JobPageLayout, { JobPageHeading } from '../../components/job-page-layout';
import { RelatedEvidenceList, TagEditor } from '../../components/incident-tags';
import WorkIncidentWarnings from '../../components/work-incident-warnings';
import { toIncidentFilters } from '../../utils/agentic-rag-tags';
import { JobSiteSelector } from './job-work-form';
import '../../style/job/job-incidents.css';

function IncidentWorkspace({ site, reporter, disabled, initialId }) {
  const [resources, setResources] = useState(null);
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState(null);
  const [tags, setTags] = useState([]);
  const [query, setQuery] = useState('');
  const [result, setResult] = useState(null);
  const [form, setForm] = useState({
    title: '', zoneId: '', workId: '', occurredAt: '', description: '', immediateAction: '',
  });
  const mounted = useRef(false);
  const pending = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getTagCodes(site.siteId), getSiteZones(site.siteId), getIncidents(site.siteId)])
      .then(async ([codes, zones, incidents]) => {
        if (!Array.isArray(codes) || !Array.isArray(zones) || !Array.isArray(incidents)) {
          throw new Error('태그·구역·보고 목록 응답 형식이 올바르지 않습니다.');
        }
        let opened = null;
        if (initialId) {
          opened = await getIncident(initialId);
          if (opened.siteId !== site.siteId) throw new Error('원본 보고의 현장을 먼저 선택해 주세요.');
        }
        if (!cancelled) {
          setResources({ codes, zones, incidents });
          if (opened) { setSelected(opened); setTags(opened.tags); }
          setError('');
        }
      })
      .catch((requestError) => { if (!cancelled) setError(requestError.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [site.siteId, revision, initialId]);

  const apply = (incident) => {
    setSelected(incident);
    setTags(incident.tags);
    setResult(null);
    setResources((current) => ({
      ...current,
      incidents: [incident, ...current.incidents.filter((item) => item.nearMissId !== incident.nearMissId)],
    }));
  };
  const run = async (action) => {
    if (pending.current || disabled || loading) return;
    pending.current = true;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await action();
    } catch (requestError) {
      if (mounted.current) setError(requestError.message || '요청에 실패했습니다.');
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
  };
  const open = (id) => run(async () => {
    const incident = await getIncident(id);
    if (incident.siteId !== site.siteId) throw new Error('선택한 현장의 보고가 아닙니다.');
    if (mounted.current) apply(incident);
  });
  const create = (event) => {
    event.preventDefault();
    void run(async () => {
      if (form.workId && (!/^[1-9]\d*$/.test(form.workId) || !Number.isSafeInteger(Number(form.workId)))) {
        throw new Error('관련 작업 ID는 정확한 양의 정수로 입력하세요.');
      }
      const saved = await createIncident({
        ...form, siteId: site.siteId,
        zoneId: form.zoneId ? Number(form.zoneId) : null,
        workId: form.workId ? Number(form.workId) : null,
      });
      if (!mounted.current) return;
      apply(saved);
      setForm({ title: '', zoneId: '', workId: '', occurredAt: '', description: '', immediateAction: '' });
      setMessage(`보고 #${saved.nearMissId} 저장 완료. 자동 태깅과 무관하게 보고는 DB에 보존됩니다.`);
    });
  };
  const updateForm = (field, value) => setForm((current) => ({ ...current, [field]: value }));
  const locked = disabled || busy || loading || !resources;

  return (
    <>
      {loading && <p role="status">태그 코드표·구역·보고 목록을 불러오는 중입니다...</p>}
      {error && <div className="dashboard-error" role="alert">
        <span>{error}</span>
        <button type="button" disabled={busy || loading} onClick={() => {
          setLoading(true); setRevision((value) => value + 1);
        }}>목록 다시 조회</button>
      </div>}
      {message && <p className="job-review-notice" role="status">{message}</p>}
      <form className="panel job-form" onSubmit={create}>
        <h2>아차사고 보고</h2>
        <fieldset disabled={locked}>
          <legend>{site.name} · 새 보고</legend>
          <div className="job-fields">
            <label>보고 제목<input required maxLength={200} value={form.title}
              onChange={(event) => updateForm('title', event.target.value)} /></label>
            <label>작업구역<select value={form.zoneId} onChange={(event) => updateForm('zoneId', event.target.value)}>
              <option value="">구역 미지정</option>
              {resources?.zones.map((zone) => <option key={zone.zoneId} value={zone.zoneId}>{zone.code} · {zone.name}</option>)}
            </select></label>
            <label>관련 작업 ID (선택)<input type="number" min="1" step="1" value={form.workId}
              onChange={(event) => updateForm('workId', event.target.value)} /></label>
            <label>발생 일시<input required type="datetime-local" value={form.occurredAt}
              onChange={(event) => updateForm('occurredAt', event.target.value)} /></label>
            <label>보고자<input readOnly value={reporter?.name ?? reporter?.email ?? ''} /></label>
            <label className="job-field-wide">발생 상황<textarea required maxLength={20000} rows={4} value={form.description}
              onChange={(event) => updateForm('description', event.target.value)} /></label>
            <label className="job-field-wide">즉시 조치<textarea maxLength={10000} rows={3} value={form.immediateAction}
              onChange={(event) => updateForm('immediateAction', event.target.value)} /></label>
          </div>
          <label className="incident-auto-option"><input type="checkbox" checked={false} disabled readOnly />저장 후 자동 태깅 요청 (비동기 API 연결 대기)</label>
          <p className="job-help">자동 태깅은 Spring이 실행을 등록하고 AI 서버에 처리를 요청하는 방식으로 예정되어 있습니다. 202 응답의 runId 처리·실행 상태 조회 API 연결 전에는 요청하지 않습니다. 외부 모델로 보고 내용을 전송하는 기능도 활성화하지 않았습니다.</p>
          <div className="job-form-actions"><button type="submit">보고 저장</button></div>
        </fieldset>
      </form>

      <section className="panel job-example" aria-label="저장된 아차사고">
        <h2>저장된 보고 <small>최근 50건</small></h2>
        <div className="incident-report-list">
          {resources?.incidents.map((item) => (
            <button type="button" className="job-history-refresh" key={item.nearMissId} disabled={locked}
              aria-pressed={selected?.nearMissId === item.nearMissId} onClick={() => open(item.nearMissId)}>
              #{item.nearMissId} {item.title} · {item.status}
            </button>
          ))}
          {resources?.incidents.length === 0 && <p>아직 저장된 보고가 없습니다.</p>}
        </div>
      </section>

      {selected && (
        <section className="panel job-form" aria-label="아차사고 태그 검토">
          <h2>#{selected.nearMissId} {selected.title}</h2>
          <p>{selected.description}</p>
          <p className="job-help">{selected.occurredAt} · {selected.status} · 판 {selected.lockVersion}</p>
          <TagEditor tags={tags} codes={resources?.codes ?? []} disabled={locked}
            onChange={(next) => { setTags(next); setResult(null); }} />
          <div className="job-form-actions">
            <button type="button" disabled>자동 태깅 요청 (비동기 API 연결 대기)</button>
            <button type="button" disabled={locked} onClick={() => run(async () => {
              if (tags.filter((tag) => tag.axis === 'SEVERITY').length > 1) {
                throw new Error('중대도(SEVERITY)는 하나만 선택할 수 있습니다.');
              }
              const reviewed = await reviewIncidentTags(selected.nearMissId, selected.lockVersion, tags);
              if (mounted.current) { apply(reviewed); setMessage('검토한 태그가 저장되었습니다.'); }
            })}>태그 검토 저장</button>
            <button type="button" className="job-history-refresh" disabled={locked}
              onClick={() => open(selected.nearMissId)}>최신 보고 다시 조회</button>
          </div>
          <p className="job-help">자동 태깅은 AI 서버 처리 후 보고 상세를 다시 조회하는 방식으로 연결할 예정입니다. 사용자 태그 검토 중 충돌이 발생하면 최신 보고를 조회한 뒤 다시 검토하세요.</p>
          <label className="incident-cas-input">관련 사고 검색어
            <input maxLength={500} value={query} disabled={locked} onChange={(event) => { setQuery(event.target.value); setResult(null); }} />
          </label>
          <button type="button" className="job-history-refresh" disabled={locked} onClick={() => run(async () => {
            const found = await searchIncidents({
              siteId: site.siteId, zoneId: selected.zoneId, query,
              filters: toIncidentFilters(tags), limit: 5,
            });
            if (mounted.current) setResult(found);
          })}>현재 태그로 관련 사고 검색</button>
          <p className="job-help">관련 사고 검색은 선택 현장 내 SQL 검색 계약입니다. 공공 MSDS·코샤가이드·SIF 및 Qdrant 검색은 AI 서버 검색 API 연결 전까지 포함하지 않습니다.</p>
        </section>
      )}
      <RelatedEvidenceList result={result} codes={resources?.codes ?? []} onOpen={open} />
      {busy && <p role="status">보고·태그 요청을 처리하는 중입니다...</p>}
      <p className="job-help">작업 경고 연결은 같은 현장·구역에서 현장 설정 near_miss_warn_days(기본 30일) 이내의 보고를 대상으로 하는 계약입니다. 기간은 서버에서 적용하며, 모든 과거 보고를 연결하는 기능이 아닙니다. 경고 확인 및 조치 내용은 1~300자로 입력해야 합니다. 현재 경고 API는 연결 대기 상태입니다.</p>
      <WorkIncidentWarnings siteId={site.siteId} disabled={disabled || loading} />
    </>
  );
}

export default function JobIncidents() {
  const context = useWorkSite();
  const [params] = useSearchParams();
  return (
    <JobPageLayout title="위험·근접 사고" user={context.account?.user} contentClassName="job-management">
      <JobPageHeading title="위험·근접 사고" description="보고 저장 → 자동 태깅 → 사용자 검토 → 관련 사고 검색 → 작업 경고 확인" />
      <JobSiteSelector context={context} />
      <p className="job-demo-notice" role="status">현재 main-server에는 아차사고·태그·구역·검색·경고 API가 구현되어 있지 않습니다. 아래는 해당 계약을 지원하는 서버용 연동 화면이며, 조회 실패 시 저장할 수 없습니다. 일반 작업·작업허가는 별도 화면에서 사용하세요.</p>
      {context.currentSite && <IncidentWorkspace key={context.currentSite.siteId} site={context.currentSite}
        reporter={context.account?.user} disabled={context.selecting} initialId={params.get('incidentId')} />}
    </JobPageLayout>
  );
}
