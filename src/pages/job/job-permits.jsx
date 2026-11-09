import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { getSiteWorks, getWork, measurementFields, permitFormFieldsOf, setPermitChoice, stepForTarget } from '../../api/jobs';
import { useWorkSite } from '../../api/workers';
import JobPageLayout from '../../components/job-page-layout';
import PageHeader from '../../components/ui/page-header.jsx';
import WorkIncidentWarnings from '../../components/work-incident-warnings';
import { Badge } from '../../components/home/panel.jsx';
import Icon from '../../components/ui/icon.jsx';
import StatusView, { Skeleton } from '../../components/ui/status-view.jsx';
import StepIndicator from '../../components/ui/step-indicator.jsx';
import { usePermitWorkspace } from '../../hooks/use-permit-workspace.js';
import { PERMIT_STATUS_LABELS, toneOf, WORK_TYPE_LABELS } from '../../utils/home-model.js';
import { EVALUATION_LABELS, EVALUATION_TONES, PERMIT_RULE_SUMMARY, PERMIT_TYPE_LABELS, permitSteps, RULE_CHECK_LABELS } from '../../utils/permit-model.js';
import { backToHubPath } from '../../utils/work-list-model.js';
import '../../styles/home.css';
import '../../styles/work.css';
import '../../styles/records.css';
import '../../styles/risk.css';
import '../../styles/permit.css';
import { usePeriod } from '../../hooks/use-period.js';
import PeriodBar from '../../components/period-bar.jsx';
import SpeakFill from '../../components/permit/speak-fill.jsx';
import { fieldHint } from '../../utils/extract-model.js';

// TODO: BACKEND CONTRACT REQUIRED: POST /api/v1/permits/{permitId}/signatures
// EVENT: SUPERVISOR 서명은 approval.steps에 추가하지 않고 별도 이벤트로 저장한다.

/**
 * 작업허가. 주소에 permitId 가 있으면 그 허가서를 이어서 할 단계로 열고, workId 만 있으면 그 작업의 새 허가서,
 * 둘 다 없으면 작업을 고르는 화면. 4단계 규칙은 기존과 같다(use-permit-workspace).
 */
// 기간으로 보면 여러 날 작업이 섞이므로 최근 날짜부터
const sortByDate = (works) => [...works].sort((a, b) => String(b.workDate).localeCompare(String(a.workDate)) || b.workId - a.workId);
const shortDay = (date) => (date ? date.slice(5).replace('-', '/') : '-');

export default function JobPermits() {
  const context = useWorkSite();
  const [params] = useSearchParams();
  const site = context.currentSite;
  const permitId = /^\d+$/.test(params.get('permitId') ?? '') ? params.get('permitId') : null;
  const workId = /^\d+$/.test(params.get('workId') ?? '') ? params.get('workId') : null;
  return (
    <JobPageLayout title="작업허가" user={context.account?.user} contentClassName="work-page">
      {!site ? <PageHeader title="작업허가" context={context} />
        : permitId || workId
          ? <PermitEditor key={`${site.siteId}:${permitId}:${workId}`} siteId={site.siteId} context={context} initialPermitId={permitId} initialWorkId={workId} back={backToHubPath(params.get('back'))} />
          : <PermitFinder key={site.siteId} site={site} context={context} />}
    </JobPageLayout>
  );
}

/** 허가서 찾기: 날짜별 작업과 그 작업의 허가서 (+ 허가서 번호로 열기) */
function PermitFinder({ site, context }) {
  const navigate = useNavigate();
  // 기간(오늘·7일·30일)은 다른 메뉴에 다녀와도 남는다
  const period = usePeriod(`permits:${site.siteId}`);
  const { from, to } = period;
  const [state, setState] = useState({ key: null, works: [], error: '' });
  const [lookup, setLookup] = useState('');
  const key = `${site.siteId}:${from}:${to}`;
  useEffect(() => {
    let active = true;
    getSiteWorks(site.siteId, from, to).then((works) => { if (active) setState({ key, works: sortByDate(works), error: '' }); })
      .catch((requestError) => { if (active) setState({ key, works: [], error: requestError.message || '작업 목록을 불러오지 못했습니다.' }); });
    return () => { active = false; };
  }, [site.siteId, from, to, key]);
  const loading = state.key !== key;

  return (
    <div className="work-list rec-page">
      <PageHeader title="작업허가" description="허가서 작성 → 측정값 → 규칙 판정 → 승인 요청. 작업을 고르면 그 작업의 허가서를 열거나 새로 만듭니다." context={context} />
      <section className="work-filters rec-datebar" aria-label="작업일">
        <PeriodBar period={period} label="작업일" />
        <form className="risk-lookup" onSubmit={(event) => { event.preventDefault(); if (/^\d+$/.test(lookup.trim())) navigate(`/job/permits?permitId=${lookup.trim()}`); }}>
          <label><span className="sr-only">허가서 번호</span><input value={lookup} inputMode="numeric" placeholder="허가서 ID로 열기" onChange={(event) => setLookup(event.target.value)} /></label>
          <button type="submit" className="ui-btn ui-btn--ghost" disabled={!/^\d+$/.test(lookup.trim())}>열기</button>
        </form>
        {period.error && <p className="work-filters__help" role="alert">{period.error}</p>}
      </section>
      <section className="home-panel work-table-panel" aria-label="작업 목록">
        {loading && <div className="home-panel__pad"><Skeleton lines={5} /></div>}
        {!loading && state.error && <StatusView kind="error" message={state.error} />}
        {!loading && !state.error && !state.works.length && <StatusView kind="empty" title={from === to ? '이 날짜에 등록된 작업이 없습니다' : '이 기간에 등록된 작업이 없습니다'} action={{ label: '작업 목록으로', onClick: () => navigate('/job/workspace') }} />}
        {!loading && state.works.length > 0 && (
          <table className="home-table">
            <thead><tr><th scope="col" className="work-table__date">작업일</th><th scope="col">작업</th><th scope="col">종류</th><th scope="col">허가서</th><th scope="col"><span className="sr-only">열기</span></th></tr></thead>
            <tbody>
              {state.works.map((work) => {
                const permits = (work.permits ?? []).filter((permit) => permit.status !== 'SUPERSEDED');
                return (
                  <tr key={work.workId}>
                    <td data-label="작업일" className="work-table__date">{shortDay(work.workDate)}</td>
                    <td data-label="작업"><span className="home-table__name"><span className="home-table__title">{work.title}</span><span className="work-table__id">#{work.workId}</span></span></td>
                    <td data-label="종류"><Badge tone={work.highRisk ? 'warn' : 'neutral'}>{WORK_TYPE_LABELS[work.workType] ?? work.workType}</Badge></td>
                    <td data-label="허가서">
                      {permits.length ? <span className="work-badges">{permits.map((permit) => <Link key={permit.permitId} className="permit-chip" to={`/job/permits?permitId=${permit.permitId}`}>{permit.permitNo ?? `#${permit.permitId}`}<Badge tone={toneOf(permit.status)}>{PERMIT_STATUS_LABELS[permit.status] ?? permit.status}</Badge></Link>)}</span>
                        : <span className="work-none">{work.workType === 'GENERAL' ? '해당 없음' : '작성 전'}</span>}
                    </td>
                    <td data-label="열기">{work.workType !== 'GENERAL' && !permits.length
                      ? <Link className="ui-btn ui-btn--secondary appr-open" to={`/job/permits?workId=${work.workId}`}>작성하기</Link>
                      : permits.length ? <span className="permit-row-actions"><Link className="ui-btn ui-btn--secondary appr-open" to={`/job/permits?permitId=${permits[0].permitId}`}>열기</Link><Link className="home-panel__link" to={`/job/permits?workId=${work.workId}`}>새 허가서</Link></span> : null}</td>
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

function PermitEditor({ siteId, context, initialPermitId, initialWorkId, back }) {
  const navigate = useNavigate();
  const [work, setWork] = useState(null);
  // 새 허가서: 작업 종류(화기·밀폐공간·고소)를 기본 허가 유형으로
  const workType = Object.hasOwn(PERMIT_TYPE_LABELS, work?.workType ?? '') ? work.workType : null;
  const data = usePermitWorkspace({ siteId, disabled: context.selecting, initialWorkId, initialPermitId, initialType: workType });
  const { permit } = data;
  const targetWorkId = permit?.workId ?? (/^\d+$/.test(data.workId) ? data.workId : null);
  useEffect(() => {
    if (!targetWorkId) return undefined;
    let active = true;
    getWork(targetWorkId).then((found) => { if (active) setWork(found); }).catch(() => { if (active) setWork(null); });
    return () => { active = false; };
  }, [targetWorkId]);
  // 작업 상세에는 허가서 목록이 없어서, 새 허가서일 때만 그날 작업 목록에서 이 작업의 허가서를 찾는다
  const [workPermits, setWorkPermits] = useState(null);
  const creating = !initialPermitId && !permit;
  useEffect(() => {
    if (!creating || !work?.workDate) return undefined;
    let active = true;
    getSiteWorks(siteId, work.workDate).then((list) => { if (active) setWorkPermits(list.find((item) => String(item.workId) === String(work.workId))?.permits ?? []); })
      .catch(() => { if (active) setWorkPermits([]); });
    return () => { active = false; };
  }, [creating, siteId, work?.workDate, work?.workId]);

  const hub = back ?? (targetWorkId ? `/job/workspace?workId=${targetWorkId}` : null);
  // 새 허가서인데 이 작업에 같은 종류 허가서가 이미 있으면 (서버는 작업당 종류별 1건만 받는다) 저장 전에 그쪽으로 안내
  const existing = creating && workPermits ? workPermits.find((item) => item.permitType === data.type && item.status !== 'SUPERSEDED') : null;
  if (data.loading) return <div className="work-list"><PageHeader title="작업허가" context={context} /><div className="home-panel home-panel__pad"><Skeleton lines={8} /></div></div>;

  return (
    <div className="work-list rec-page permit-page">
      <PageHeader title={work?.title ? `${work.title} 작업허가` : '작업허가'} context={context} onBeforeSelect={() => navigate('/job/permits')}
        badges={<><Badge tone="info">{PERMIT_TYPE_LABELS[data.type]}</Badge><Badge tone={permit ? toneOf(permit.status) : 'todo'}>{permit ? (PERMIT_STATUS_LABELS[permit.status] ?? permit.status) : '새 허가서'}</Badge></>}
        description={[permit?.permitNo, targetWorkId ? `작업 #${targetWorkId}` : null, permit ? `버전 ${permit.lockVersion}` : null].filter(Boolean).join(' · ')}
        actions={<>
          {hub && <Link className="ui-btn ui-btn--ghost" to={hub}><Icon name="chevronLeft" size={16} />작업 허브로</Link>}
          {permit?.permitId && <Link className="ui-btn ui-btn--ghost" to={`/records/PERMIT/${permit.permitId}`}>문서 보기</Link>}
          <Link className="ui-btn ui-btn--ghost" to="/job/permits">다른 허가서</Link>
        </>} />

      {data.creationUncertain && (
        <div className="work-form__error" role="alert">
          <Icon name="warning" size={16} />
          <span>허가서 생성 여부가 불확실해 다시 등록하지 않게 잠갔습니다. 허가서 ID로 조회하거나 관리자에게 저장 여부를 확인하세요.</span>
          <button type="button" className="ui-btn ui-btn--ghost" disabled={data.busy} onClick={() => { if (window.confirm('허가서 저장 여부를 확인했으며 새 등록을 진행하시겠습니까?')) data.unlockCreation(); }}>확인 후 등록 잠금 해제</button>
        </div>
      )}
      {data.conflict && (
        <div className="work-form__error" role="alert">
          <Icon name="warning" size={16} />
          <span>최신 버전 확인이 필요합니다. 다시 불러온 뒤 수정·판정·승인 요청하세요.</span>
          {permit && <button type="button" className="ui-btn ui-btn--ghost" disabled={data.busy} onClick={() => data.load(permit.permitId)}>최신 허가서 다시 불러오기</button>}
        </div>
      )}

      {existing && (
        <div className="work-form__error permit-existing" role="alert">
          <Icon name="info" size={16} />
          <span>이 작업에는 {PERMIT_TYPE_LABELS[data.type]} 허가서가 이미 있습니다 ({existing.permitNo ?? `#${existing.permitId}`} · {PERMIT_STATUS_LABELS[existing.status] ?? existing.status}). 같은 종류는 하나만 만들 수 있어요.
            {['DRAFT', 'CHECKING', 'REJECTED'].includes(existing.status) ? ' 그 허가서에서 이어서 고치세요.' : ' 승인 요청 뒤에는 읽기만 할 수 있습니다.'}</span>
          <Link className="ui-btn ui-btn--primary" to={`/job/permits?permitId=${existing.permitId}`}>그 허가서로 이동</Link>
        </div>
      )}

      <section className="home-panel permit-steps" aria-label="허가서 진행 단계">
        <StepIndicator steps={permitSteps(data)} label="허가서 진행 단계" onSelect={(key) => { const no = Number(key); if (!data.locked && data.reachable[no] && data.step !== no) data.goTo(no); }} />
        {data.submitted && <p className="rec-help">승인 요청 후에는 내용을 바꿀 수 없어 읽기만 합니다.</p>}
      </section>

      {data.step === 1 && <StepDetails data={data} />}
      {data.step === 2 && permit && <StepMeasurements data={data} />}
      {data.step === 3 && permit && <StepCheck data={data} />}
      {data.step === 4 && permit && <StepSubmit data={data} siteId={siteId} />}
    </div>
  );
}

function StepError({ data }) {
  return data.error ? <p className="work-form__error" role="alert"><Icon name="alert" size={16} />{data.error}</p> : null;
}

/** 판정 직후 그 칸에 붙는 결과 */
function FieldChecks({ data, target }) {
  if (!data.visibleChecks) return null;
  const results = data.visibleChecks.filter((item) => item.target === target);
  if (!results.length) return <span className="permit-fieldcheck is-none">적용된 판정 규칙 없음 · 안전성 검증 아님</span>;
  return results.map((item) => (
    <span key={item.ruleCode} className={`permit-fieldcheck is-${item.status.toLowerCase()}`}>
      <strong>{RULE_CHECK_LABELS[item.status] ?? item.status}</strong> · 판정값 {item.actual ?? '미입력'} · 기준 {item.expected}{item.message && ` · ${item.message}`}
    </span>
  ));
}

/** 예/아니오 확인 항목: 조치 확인(true) · 미조치(false) · 미확인(키 없음) */
function CheckChoice({ code, label, value, onChange }) {
  const options = [{ key: 'yes', text: '조치 확인', next: true }, { key: 'no', text: '미조치', next: false }, { key: 'unknown', text: '미확인', next: undefined }];
  const current = value === true ? 'yes' : value === false ? 'no' : 'unknown';
  return (
    <div className="permit-check" role="group" aria-label={label}>
      <span className="permit-check__label">{label}</span>
      <div className="permit-check__options">
        {options.map((option) => (
          <button key={option.key} type="button" className={`permit-check__btn is-${option.key}`} aria-pressed={current === option.key} onClick={() => onChange(code, option.next)}>
            {option.key === 'yes' && <Icon name="check" size={14} />}{option.text}
          </button>
        ))}
      </div>
    </div>
  );
}

function StepDetails({ data }) {
  const fields = permitFormFieldsOf(data.type);
  const setCheck = (code, next) => {
    const form = { ...data.form.form };
    if (next === undefined) delete form[code]; else form[code] = next;
    data.update('form', form);
  };
  const disabled = data.locked || !data.editable || data.conflict || data.creationUncertain;
  return (
    <form className="home-panel permit-step" onSubmit={(event) => { event.preventDefault(); if (data.editable) data.save(); else data.goTo(data.hasMeasurements ? 2 : 3); }}>
      <header className="permit-step__head">
        <h2>1. 허가서 작성</h2>
        <p>작업과 유효기간을 확인하고 유형별 안전 확인사항을 입력하세요.</p>
      </header>
      <fieldset className="permit-step__body" disabled={disabled}>
        <legend className="sr-only">허가서 내용</legend>
        <div className="permit-grid">
          {!data.permit && (
            <label className="risk-field"><span className="risk-field__label">작업 ID<span className="risk-req" aria-hidden="true">*</span></span>
              <input required inputMode="numeric" value={data.workId} onChange={(event) => data.setWorkId(event.target.value)} />
            </label>
          )}
          <label className="risk-field">허가 유형
            <select disabled={Boolean(data.permit)} value={data.type} onChange={(event) => data.changeType(event.target.value)}>
              {Object.entries(PERMIT_TYPE_LABELS).map(([code, label]) => <option key={code} value={code}>{label}</option>)}
            </select>
          </label>
          <label className="risk-field"><span className="risk-field__label">유효 시작<span className="risk-req" aria-hidden="true">*</span></span>
            <input type="datetime-local" max="9999-12-31T23:59" step="any" required value={data.form.validFrom} onChange={(event) => data.update('validFrom', event.target.value)} />
          </label>
          <label className="risk-field"><span className="risk-field__label">유효 종료<span className="risk-req" aria-hidden="true">*</span></span>
            <input type="datetime-local" max="9999-12-31T23:59" step="any" required value={data.form.validTo} onChange={(event) => data.update('validTo', event.target.value)} />
          </label>
          <div className="risk-field">
            <label className="risk-field">{fields.watcherLabel}<input maxLength={50} value={data.form.watcherName} onChange={(event) => data.update('watcherName', event.target.value)} /></label>
            <FieldChecks data={data} target="form.watcher_name" />
          </div>
          <label className="risk-field">작업책임자<input maxLength={50} value={data.form.supervisorName} onChange={(event) => data.update('supervisorName', event.target.value)} /></label>
        </div>

        {(fields.choices.length > 0 || fields.checks.length > 0) && <h3 className="permit-sub">안전 확인사항</h3>}
        <div className="permit-checks">
          {fields.choices.map(({ code, label, help, options }) => (
            <div key={code} className="permit-check permit-check--choice">
              <label className="risk-field">{label}
                <select value={data.form.form[code] ?? ''} aria-describedby={`${code}-help`} onChange={(event) => data.update('form', setPermitChoice(data.form.form, code, event.target.value))}>
                  <option value="">선택 안 함 (미확인)</option>
                  {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </label>
              <p className="rec-help" id={`${code}-help`}>{help}</p>
              <FieldChecks data={data} target={`form.${code}`} />
            </div>
          ))}
          {fields.checks.map(({ code, label }) => (
            <div key={code} className="permit-check-wrap">
              <CheckChoice code={code} label={label} value={data.form.form[code]} onChange={setCheck} />
              <FieldChecks data={data} target={`form.${code}`} />
            </div>
          ))}
        </div>
      </fieldset>
      <div className="permit-step__notes">
        <p className="rec-help">{PERMIT_RULE_SUMMARY[data.type]}</p>
        <p className="rec-help">미확인은 판정에서 입력 누락(MISSING), 미조치는 기준 미충족(FAIL)으로 막힙니다. 감시자 이름은 작업자 배치가 아닙니다. 기존 양식의 추가 칸은 수정 저장 때 그대로 보존합니다.</p>
      </div>
      <StepError data={data} />
      <div className="risk-bar">
        <span className={`risk-bar__state${data.dirty ? ' is-dirty' : ''}`}>{data.permit && data.dirty ? '저장하면 최근 판정이 무효가 되어 다시 판정해야 합니다.' : data.permit ? '저장된 허가서입니다.' : '아직 저장하지 않은 새 허가서입니다.'}</span>
        {data.editable
          ? <button type="submit" className="ui-btn ui-btn--primary" disabled={data.locked || data.conflict || data.creationUncertain}>{!data.permit ? '저장하고 다음' : data.dirty ? '변경 저장하고 다음' : '다음'}</button>
          : <button type="submit" className="ui-btn ui-btn--primary" disabled={data.locked}>다음</button>}
      </div>
    </form>
  );
}

function StepMeasurements({ data }) {
  const { permit } = data;
  return (
    <section className="home-panel permit-step" aria-labelledby="permit-step2">
      <header className="permit-step__head">
        <h2 id="permit-step2">2. 작업 전 측정값</h2>
        <p>{data.editable ? '실제로 측정한 항목만 입력하세요. 빈 칸은 보내지 않습니다.' : '승인 요청 후라 측정값을 추가할 수 없습니다. 저장된 측정 이력만 보여 줍니다.'}</p>
        <Badge tone="neutral">저장된 측정 {permit.measurements.length}건</Badge>
      </header>
      {data.editable && (
        <fieldset className="permit-step__body" disabled={data.locked || data.conflict}>
          <legend className="sr-only">측정값</legend>
          <SpeakFill data={data} fields={measurementFields[data.type]} />
          <div className="permit-measures">
            {measurementFields[data.type].map(({ code, label }) => (
              <div key={code} className="permit-measure">
                <label className="risk-field">{label}
                  <input type="number" min="0" max={['O2', 'CO2', 'LEL'].includes(code) ? 100 : undefined} step="any" inputMode="decimal" value={data.values[code] ?? ''} onChange={(event) => data.setMeasurement(code, event.target.value)} />
                </label>
                <FillHint hint={fieldHint(data.fill, code, data.values[code])} />
                <FieldChecks data={data} target={`measurement.${code}`} />
              </div>
            ))}
          </div>
        </fieldset>
      )}
      <p className="rec-help permit-step__notes">단위와 PRE_WORK 단계는 서버가 정하고, 측정 시각은 서버 현재 시각입니다. 다시 측정해 저장하면 재측정으로 쌓이고 최근 값으로 판정합니다.</p>
      {permit.measurements.length > 0 && (
        <table className="home-table permit-history">
          <caption className="sr-only">저장된 작업 전 측정 이력</caption>
          <thead><tr><th scope="col">항목</th><th scope="col">측정값</th><th scope="col">측정 일시</th><th scope="col">구분</th></tr></thead>
          <tbody>{permit.measurements.map((item) => (
            <tr key={item.id}><td data-label="항목">{item.item}</td><td data-label="측정값"><strong>{item.value}</strong> {item.unit}</td><td data-label="측정 일시" className="work-table__date">{item.measuredAt?.replace('T', ' ').slice(0, 16)}</td><td data-label="구분">{item.remeasure ? <Badge tone="info">재측정</Badge> : '최초 측정'}</td></tr>
          ))}</tbody>
        </table>
      )}
      <StepError data={data} />
      <div className="risk-bar">
        <button type="button" className="ui-btn ui-btn--ghost" disabled={data.locked} onClick={() => { if (data.measurementDirty && !window.confirm('저장하지 않은 측정값을 버리고 이전 단계로 갈까요?')) return; data.discardMeasurements(); data.goTo(1); }}>이전</button>
        <span className="risk-bar__state">{data.measurementDirty ? '저장하지 않은 측정값이 있습니다.' : ''}</span>
        {data.editable
          ? <button type="button" className="ui-btn ui-btn--primary" disabled={data.locked || data.conflict} onClick={data.saveMeasurementsAndNext}>{data.measurementDirty ? '저장하고 다음' : '다음'}</button>
          : <button type="button" className="ui-btn ui-btn--primary" disabled={data.locked} onClick={() => data.goTo(3)}>다음</button>}
      </div>
    </section>
  );
}

/** 문장으로 채운 칸 표시 (서버 미리 판정 그대로): 문장에서 / 입력 필요 / 기준 밖 */
function FillHint({ hint }) {
  if (!hint) return null;
  if (hint.kind === 'filled') return <span className="fill-hint is-filled">문장에서 채움</span>;
  if (hint.kind === 'missing') return <span className="fill-hint is-missing">입력 필요</span>;
  return <span className="fill-hint is-out">기준 밖 · 기준 {hint.expected}{hint.message ? ` · ${hint.message}` : ''}</span>;
}

function StepCheck({ data }) {
  const current = data.currentEvaluation;
  const { evaluation } = data;
  const counts = evaluation ? ['PASS', 'FAIL', 'MISSING'].map((status) => [status, evaluation.checks.filter((item) => item.status === status).length]) : [];
  return (
    <section className="home-panel permit-step" aria-labelledby="permit-step3">
      <header className="permit-step__head">
        <h2 id="permit-step3">3. 규칙 판정</h2>
        <p>{PERMIT_RULE_SUMMARY[data.type]} 통과는 등록된 규칙 안에서 위반이 없다는 뜻이고, 최종 안전 승인이 아닙니다.</p>
        {data.editable && <button type="button" className="ui-btn ui-btn--primary" disabled={data.locked || data.conflict} onClick={data.runCheck}>{current ? '다시 판정' : '규칙 판정 실행'}</button>}
      </header>
      <div className="permit-step__body">
        {!data.conflict && !current && <p className="rec-help">아직 판정하지 않았습니다. "규칙 판정 실행"을 누르세요.</p>}
        {!data.conflict && current && (
          <div className={`permit-result is-${EVALUATION_TONES[current.result] ?? 'neutral'}`} role="status">
            <div className="permit-result__head">
              <Icon name={current.result === 'PASS' ? 'check' : current.result === 'BLOCK' ? 'alert' : 'warning'} size={20} />
              <strong>최근 판정: {EVALUATION_LABELS[current.result] ?? current.result}</strong>
              {evaluation && <span className="permit-result__counts">적용 규칙 {evaluation.rulesApplied}건{counts.map(([status, count]) => ` · ${RULE_CHECK_LABELS[status]} ${count}건`).join('')}</span>}
            </div>
            {evaluation?.rulesApplied === 0 && <p className="permit-result__note">판정 불가: 등록된 규칙이 없습니다. 통과로 응답되어도 이 작업의 안전성이 검증된 것은 아닙니다.</p>}
            {!evaluation && <p className="permit-result__note">저장된 판정은 위반 내역만 있습니다. 전체 규칙의 통과·입력 누락 상세는 판정 직후에만 보이고 서버에 저장되지 않습니다. 다시 판정하면 볼 수 있습니다.</p>}
            {evaluation?.unusedFields?.length > 0 && <p className="permit-result__note">미사용 입력: {evaluation.unusedFields.join(', ')}</p>}
          </div>
        )}

        {!data.conflict && evaluation && evaluation.rulesApplied > 0 && (
          <table className="home-table permit-rules">
            <caption className="sr-only">전체 적용 규칙의 통과·기준 미충족·입력 누락 상세 결과</caption>
            <thead><tr><th scope="col">규칙 / 대상</th><th scope="col">판정</th><th scope="col">입력값</th><th scope="col">기준</th><th scope="col">심각도</th><th scope="col">안내 및 근거</th></tr></thead>
            <tbody>{evaluation.checks.map((item) => (
              <tr key={item.ruleCode} className={`is-${item.status.toLowerCase()}`}>
                <td data-label="규칙"><strong>{item.ruleCode}</strong><span className="home-table__facts">{item.target}</span></td>
                <td data-label="판정"><Badge tone={item.status === 'PASS' ? 'done' : item.status === 'FAIL' ? 'block' : 'warn'}>{RULE_CHECK_LABELS[item.status] ?? item.status}</Badge></td>
                <td data-label="입력값">{item.actual ?? '미입력'}</td>
                <td data-label="기준">{item.expected}</td>
                <td data-label="심각도">{item.severity}</td>
                <td data-label="안내" className="permit-rules__note">
                  {item.message && <span>{item.message}</span>}
                  {item.action && <span>조치: {item.action}</span>}
                  <span className="home-table__facts">근거: {item.legalBasis || '제공되지 않음'}</span>
                  {/^https?:\/\//i.test(item.sourceUrl ?? '') && <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer">근거 원문</a>}
                </td>
              </tr>
            ))}</tbody>
          </table>
        )}

        {!data.conflict && !evaluation && current?.violations?.length > 0 && (
          <ul className="permit-violations">
            {current.violations.map((item, index) => (
              <li key={`${item.ruleCode}-${index}`}>
                <strong>{item.severity} · {item.message}</strong>
                <span>{item.ruleCode} · 측정 {item.actual ?? '미입력'} · 기준 {item.expected}</span>
                {item.action && <span>조치: {item.action}</span>}
                <span className="home-table__facts">근거: {item.legalBasis}</span>
              </li>
            ))}
          </ul>
        )}

        {data.editable && !data.conflict && data.blocked.length > 0 && (
          <div className="permit-fixes">
            <h3 className="permit-sub">고칠 항목</h3>
            <ul>{data.blocked.map((item, index) => {
              const target = stepForTarget(item.target);
              return (
                <li key={`${item.ruleCode}-${index}`}>
                  <span>{item.message || item.ruleCode} <small>({RULE_CHECK_LABELS[item.status] ?? item.severity})</small></span>
                  <button type="button" className="ui-btn ui-btn--secondary" disabled={data.locked || (target === 2 && !data.hasMeasurements)} onClick={() => data.goTo(target)}>{target === 2 ? '측정값에서 고치기' : '허가서에서 고치기'}</button>
                </li>
              );
            })}</ul>
          </div>
        )}
        {!data.conflict && data.noApplicableRules && <p className="rec-note rec-note--block"><Icon name="alert" size={16} />등록된 판정 규칙이 없는 허가서는 승인 요청할 수 없습니다.</p>}
        {!data.conflict && data.serverDisallowsSubmit && data.blocked.length === 0 && <p className="rec-note"><Icon name="info" size={16} />서버에서 승인 요청 불가로 응답했습니다. 규칙 판정을 다시 실행해 상세 결과를 확인하세요.</p>}
      </div>
      <StepError data={data} />
      <div className="risk-bar">
        <button type="button" className="ui-btn ui-btn--ghost" disabled={data.locked} onClick={() => data.goTo(data.hasMeasurements ? 2 : 1)}>이전</button>
        <span className="risk-bar__state" />
        <button type="button" className="ui-btn ui-btn--primary" disabled={data.locked || !data.reachable[4]} onClick={() => data.goTo(4)}>다음</button>
      </div>
    </section>
  );
}

function StepSubmit({ data, siteId }) {
  const { permit } = data;
  const current = data.currentEvaluation;
  return (
    <section className="home-panel permit-step" aria-labelledby="permit-step4">
      <header className="permit-step__head">
        <h2 id="permit-step4">4. 승인 요청</h2>
        <p>같은 구역의 최근 아차사고 경고를 확인해야 승인 요청할 수 있습니다. 승인 요청 후에는 내용과 측정값을 바꿀 수 없습니다.</p>
      </header>
      <div className="permit-step__body">
        <dl className="rec-facts">
          <div><dt>허가서</dt><dd>{permit.permitNo} ({PERMIT_TYPE_LABELS[permit.permitType]})</dd></div>
          <div><dt>유효기간</dt><dd>{permit.validFrom?.replace('T', ' ').slice(0, 16)} ~ {permit.validTo?.replace('T', ' ').slice(11, 16)}</dd></div>
          <div><dt>{permitFormFieldsOf(permit.permitType).watcherLabel}</dt><dd>{permit.watcherName || '미입력'}</dd></div>
          <div><dt>측정값</dt><dd>{permit.measurements.length ? `${permit.measurements.length}건` : '없음'}</dd></div>
          <div><dt>최근 판정</dt><dd>{current ? (EVALUATION_LABELS[current.result] ?? current.result) : '없음'}</dd></div>
          <div><dt>상태</dt><dd>{PERMIT_STATUS_LABELS[permit.status] ?? permit.status}</dd></div>
        </dl>
        <div className="work-warnings permit-warnings">
          <WorkIncidentWarnings key={`work-warnings-${permit.workId}`} siteId={siteId} initialWorkId={permit.workId} disabled={data.locked} />
        </div>
      </div>
      <StepError data={data} />
      <div className="risk-bar">
        <button type="button" className="ui-btn ui-btn--ghost" disabled={data.locked} onClick={() => data.goTo(3)}>이전</button>
        <span className="risk-bar__state">{data.submitted ? '승인 요청을 보냈습니다. 승인함 "내 요청"에서 결과를 볼 수 있습니다.' : ''}</span>
        {data.editable && <button type="button" className="ui-btn ui-btn--primary" disabled={data.locked || data.conflict || data.noApplicableRules || !permit.canSubmit} onClick={data.submit}>승인 요청</button>}
        {data.submitted && <Link className="ui-btn ui-btn--secondary" to="/approvals?tab=requested">승인함 열기</Link>}
      </div>
    </section>
  );
}
