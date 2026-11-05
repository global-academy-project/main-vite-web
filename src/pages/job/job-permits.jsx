import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useWorkSite } from '../../api/workers';
import {
  checkPermit, createPermit, editablePermitStatuses, getPermit, getWork, hasMeasurementItems, measurementFields,
  measurementItems, permitFormFieldsOf, requireWork, saveMeasurements, setPermitChoice, stepForPermit, stepForTarget,
  submitPermit, updatePermit, validatePeriod,
} from '../../api/jobs';
import JobPageLayout, { JobPageHeading } from '../../components/job-page-layout';
import WorkIncidentWarnings from '../../components/work-incident-warnings';
import '../../style/job/job-permit-steps.css';

const permitTypeLabels = { HOT: '화기', CONFINED: '밀폐공간', HEIGHT: '고소' };
const permitRuleSummary = {
  HOT: '화기는 가연성가스 측정값, 화재감시자, 안전 확인 3항목(소화기·불티 비산 방지·인화성 증기 제거)을 판정합니다.',
  CONFINED: '밀폐공간은 측정값 5종(산소·탄산가스·일산화탄소·황화수소·가연성가스), 감시인, 환기, 대피·구출 기구 비치를 판정합니다. 암모니아·염소는 기록만 하고 판정하지 않습니다.',
  HEIGHT: '고소는 측정값 없이 추락 방지 조치(하나 선택), 안전모·안전대 착용을 판정합니다. 감시자는 판정 대상이 아닙니다.',
};
const steps = [
  { no: 1, label: '허가서 작성' },
  { no: 2, label: '측정값' },
  { no: 3, label: '규칙 판정' },
  { no: 4, label: '승인 요청' },
];
const emptyForm = { validFrom: '', validTo: '', watcherName: '', supervisorName: '', form: {} };
// TODO: BACKEND CONTRACT REQUIRED: POST /api/v1/permits/{permitId}/signatures
// EVENT: SUPERVISOR 서명은 approval.steps에 추가하지 않고 별도 이벤트로 저장한다.
const ruleCheckLabels = { PASS: '통과', FAIL: '기준 미충족', MISSING: '입력 누락' };


function RuleChecks({ evaluation }) {
  return (
    <>
      <h4>전체 적용 규칙</h4>
      <p>적용 규칙 {evaluation.rulesApplied}건 · 통과 {evaluation.checks.filter((item) => item.status === 'PASS').length}건 · 기준 미충족 {evaluation.checks.filter((item) => item.status === 'FAIL').length}건 · 입력 누락 {evaluation.checks.filter((item) => item.status === 'MISSING').length}건</p>
      {evaluation.rulesApplied === 0 ? <p className="job-demo-notice">판정 불가: 등록된 규칙이 없습니다. PASS로 응답되어도 해당 작업의 안전성이 검증된 것은 아닙니다.</p> : (
        <div className="table-scroll">
          <table>
            <caption className="sr-only">전체 적용 규칙의 통과·기준 미충족·입력 누락 상세 결과</caption>
            <thead><tr><th>규칙 / 대상</th><th>판정</th><th>입력값</th><th>기준</th><th>위반 시 심각도</th><th>안내 및 근거</th></tr></thead>
            <tbody>{evaluation.checks.map((item) => <tr key={item.ruleCode}>
              <td><strong>{item.ruleCode}</strong><p>{item.target}</p></td>
              <td>{ruleCheckLabels[item.status]} ({item.status})</td>
              <td>{item.actual ?? '미입력'}</td>
              <td>{item.expected}</td>
              <td>{item.severity}</td>
              <td>
                {item.message && <p>{item.message}</p>}
                {item.action && <p>조치: {item.action}</p>}
                <p>근거: {item.legalBasis || '제공되지 않음'}</p>
                {/^https?:\/\//i.test(item.sourceUrl ?? '') && <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer">근거 원문</a>}
              </td>
            </tr>)}</tbody>
          </table>
        </div>
      )}
    </>
  );
}

function FieldRuleChecks({ checks, target }) {
  const results = checks.filter((item) => item.target === target);
  return results.length ? results.map((item) => (
    <p className="job-help" key={item.ruleCode}>
      <strong>{ruleCheckLabels[item.status]} ({item.status})</strong>
      {' · 판정값: '}{item.actual ?? '미입력'} · 기준: {item.expected}
      {item.message && <> · {item.message}</>}
    </p>
  )) : <p className="job-help">이 항목에 적용된 판정 규칙이 없습니다. 안전성이 검증된 것은 아닙니다.</p>;
}

// 단계 안 결과·오류 문구 (버튼 바로 위)
function StepNotices({ error, message, conflict }) {
  return (
    <>
      {error && <p className="dashboard-error" role="alert">{error}</p>}
      {conflict && <p className="job-demo-notice" role="status">최신 버전 확인이 필요합니다. 위의 허가서 조회로 다시 불러온 뒤 수정·판정·승인 요청하세요.</p>}
      {message && <p className="job-review-notice" role="status">{message}</p>}
    </>
  );
}

function PermitWorkspace({ siteId, disabled, initialWorkId, initialPermitId }) {
  const [workId, setWorkId] = useState(initialWorkId ?? '');
  const [permitId, setPermitId] = useState(initialPermitId ?? '');
  const [type, setType] = useState('HOT');
  const [form, setForm] = useState(emptyForm);
  const [permit, setPermit] = useState(null);
  const [values, setValues] = useState({});
  const [dirty, setDirty] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [evaluation, setEvaluation] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [creationUncertain, setCreationUncertain] = useState(false);
  const [step, setStep] = useState(1);
  const mounted = useRef(false);
  const pending = useRef(false);
  const applyRef = useRef(null);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const apply = (saved) => {
    setPermit(saved);
    setPermitId(String(saved.permitId));
    setWorkId(String(saved.workId));
    setType(saved.permitType);
    setForm({
      validFrom: saved.validFrom, validTo: saved.validTo,
      watcherName: saved.watcherName ?? '', supervisorName: saved.supervisorName ?? '',
      form: saved.form ?? {},
    });
    setDirty(false);
    setConflict(false);
    setValues({});
    setEvaluation(null);
    setCreationUncertain(false);
  };

  useEffect(() => { applyRef.current = apply; });
  // 주소에 permitId 가 있으면(작업 목록의 허가서 링크) 바로 불러와 이어서 할 단계로 간다
  useEffect(() => {
    if (initialPermitId == null || initialPermitId === '') return undefined;
    let active = true;
    (async () => {
      try {
        const saved = await getPermit(initialPermitId, siteId);
        if (active) { applyRef.current?.(saved); setStep(stepForPermit(saved)); }
      } catch (requestError) {
        if (active) setError(requestError.message || '허가서를 불러오지 못했습니다.');
      }
    })();
    return () => { active = false; };
  }, [initialPermitId, siteId]);

  const run = async (action) => {
    if (pending.current || disabled) return;
    pending.current = true;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await action();
    } catch (requestError) {
      if (mounted.current) {
        const mustReload = ['CONFLICT_MODIFIED', 'INVALID_STATE', 'WRITE_OUTCOME_UNKNOWN'].includes(requestError.code);
        if (mustReload && permit) { setConflict(true); setEvaluation(null); }
        if (requestError.code === 'WRITE_OUTCOME_UNKNOWN' && !permit) setCreationUncertain(true);
        setError(`${requestError.message || '허가서 요청에 실패했습니다.'}${mustReload && permit ? ' 최신 허가서를 다시 조회한 뒤 수정하세요.' : ''}`);
      }
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
  };
  const measurementDirty = Object.values(values).some((value) => String(value).trim());
  const confirmReplacement = () => !(dirty || measurementDirty)
    || window.confirm('저장하지 않은 내용과 측정값을 버리고 계속하시겠습니까?');
  const load = (id) => {
    if (!confirmReplacement()) return;
    return run(async () => {
      const saved = await getPermit(id, siteId);
      if (mounted.current) {
        apply(saved); setStep(stepForPermit(saved));
        setMessage('서버의 허가서를 조회했습니다. 이어서 할 단계로 이동했습니다.');
      }
    });
  };
  const goTo = (next) => { setError(''); setMessage(''); setStep(next); };
  const update = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setDirty(true);
    setEvaluation(null);
    setMessage('');
  };

  const formFields = permitFormFieldsOf(type);
  const hasMeasurements = hasMeasurementItems(type);
  const editable = !permit || editablePermitStatuses.includes(permit.status);
  const locked = busy || disabled;
  const currentEvaluation = evaluation ?? permit?.lastEvaluation;
  const visibleChecks = !dirty && !measurementDirty && !conflict ? evaluation?.checks : undefined;
  const noApplicableRules = evaluation?.rulesApplied === 0;
  const serverDisallowsSubmit = permit?.status === 'DRAFT' && permit.lastEvaluation
    && !permit.canSubmit && !noApplicableRules;
  const submitted = permit && !editable;
  // 단계별로 갈 수 있는지 (저장된 허가서 기준)
  const saved = permit && !dirty && !conflict;
  const reachable = {
    1: true,
    2: Boolean(saved && hasMeasurements),
    3: Boolean(saved && !measurementDirty && (!hasMeasurements || permit.measurements.length > 0 || submitted)),
    4: Boolean(saved && !measurementDirty && (submitted || (permit.canSubmit && !noApplicableRules))),
  };
  // 판정에서 막힌 항목 (고칠 단계로 안내)
  const blocked = evaluation
    ? evaluation.checks.filter((item) => item.status !== 'PASS')
    : (permit?.lastEvaluation?.violations ?? []);

  const save = (event) => {
    event.preventDefault();
    if (conflict || creationUncertain) return;
    if (permit && !dirty) { goTo(hasMeasurements ? 2 : 3); return; }
    void run(async () => {
      validatePeriod(form.validFrom, form.validTo);
      const body = {
        ...form, watcherName: form.watcherName.trim() || null,
        supervisorName: form.supervisorName.trim() || null,
      };
      let result;
      if (permit) result = await updatePermit(permit.permitId, { ...body, lockVersion: permit.lockVersion }, siteId);
      else {
        const work = requireWork(await getWork(workId), siteId);
        result = await createPermit({ ...body, workId: work.workId, permitType: type }, siteId);
      }
      if (mounted.current) {
        apply(result);
        setStep(hasMeasurementItems(result.permitType) ? 2 : 3);
        setMessage(hasMeasurementItems(result.permitType)
          ? '허가서를 저장했습니다. 작업 전 측정값을 입력하세요.'
          : '허가서를 저장했습니다. 이 유형은 측정 항목이 없어 바로 규칙 판정 단계로 왔습니다.');
      }
    });
  };
  const saveMeasurementsAndNext = () => {
    if (!measurementDirty) {
      if (permit.measurements.length === 0) { setMessage(''); setError('측정값을 하나 이상 입력해 주세요.'); return; }
      goTo(3);
      return;
    }
    void run(async () => {
      const items = measurementItems(type, values);
      const result = await saveMeasurements(permit.permitId, items, siteId);
      if (mounted.current) {
        apply(result); setStep(3);
        setMessage('측정값을 저장했습니다. 기존 측정값은 이력으로 남고 최근 판정은 무효화되었습니다. 규칙 판정을 실행하세요.');
      }
    });
  };
  const runCheck = () => run(async () => {
    // A check can persist even if its response is lost or invalid.
    if (mounted.current) { setConflict(true); setEvaluation(null); }
    const checked = await checkPermit(permit.permitId);
    const checkedEvaluation = checked.evaluation;
    const result = await getPermit(permit.permitId, siteId);
    if (mounted.current) {
      apply(result); setEvaluation(checkedEvaluation);
      setMessage(result.canSubmit
        ? '판정을 저장했습니다. 통과했으니 다음 단계에서 승인 요청하세요. 판정은 최종 안전 승인이 아닙니다.'
        : '판정을 저장했습니다. 막힌 항목을 고친 뒤 다시 판정하세요.');
    }
  });
  const submit = () => run(async () => {
    if (noApplicableRules) throw new Error('등록된 판정 규칙이 없는 허가서는 승인 요청할 수 없습니다.');
    const result = await submitPermit(permit.permitId, siteId);
    if (mounted.current) { apply(result); setMessage('승인 요청을 저장했습니다 (PENDING). 승인 완료나 작업 시작 허가가 아닙니다.'); }
  });
  const startNew = () => {
    if (!confirmReplacement()) return;
    setPermit(null); setPermitId(''); setForm(emptyForm); setValues({}); setDirty(false);
    setConflict(false); setCreationUncertain(false); setEvaluation(null); setError(''); setMessage('');
    setStep(1);
  };

  const notices = <StepNotices error={error} message={message} conflict={conflict} />;
  return (
    <>
      <form className="panel job-form job-lookup job-lookup-wide" onSubmit={(event) => { event.preventDefault(); void load(permitId); }}>
        <div><span className="job-eyebrow">FIND PERMIT</span><h2>기존 허가서 조회</h2><p className="job-help">이어서 작성할 허가서의 ID를 입력하면 이어서 할 단계로 이동합니다.</p></div>
        <fieldset disabled={locked}>
          <label>허가서 ID<input required inputMode="numeric" placeholder="허가서 ID 입력" value={permitId} onChange={(event) => setPermitId(event.target.value)} /></label>
          <button type="submit">허가서 조회 (입력 내용 교체)</button>
          {permit && <button type="button" className="job-secondary-button" onClick={startNew}>새 허가서 작성</button>}
        </fieldset>
      </form>

      <ol className="job-workflow job-permit-steps" aria-label="허가서 진행 단계">
        {steps.map(({ no, label }) => {
          const skipped = no === 2 && !hasMeasurements;
          return (
            <li key={no} aria-current={step === no ? 'step' : undefined} className={reachable[no] ? 'is-reachable' : undefined}>
              <button type="button" disabled={locked || step === no || !reachable[no]} onClick={() => goTo(no)}>
                <span>{no}</span>{skipped ? `${label} (해당 없음)` : label}
              </button>
            </li>
          );
        })}
      </ol>
      {permit && <p className="job-help job-permit-summary">
        {permit.permitNo} · {permitTypeLabels[permit.permitType]} · 작업 #{permit.workId} · 상태 {permit.status} · 버전 {permit.lockVersion}
        {submitted && ' · 승인 요청 후에는 내용을 바꿀 수 없어 읽기만 합니다.'}
      </p>}

      {creationUncertain && <section className="job-demo-notice" role="alert">
        <p>허가서 생성 여부가 불확실하여 재등록을 중지했습니다. 허가서 ID로 조회하거나 관리자에게 저장 여부를 확인하세요. 기존 허가서가 있으면 새로 만들지 말고 조회하세요.</p>
        <button type="button" disabled={busy || disabled} onClick={() => {
          if (window.confirm('허가서 저장 여부를 확인했으며 새 등록을 진행하시겠습니까?')) {
            setCreationUncertain(false); setError('');
          }
        }}>반영 여부 확인 후 등록 잠금 해제</button>
      </section>}

      {step === 1 && <form className="panel job-form" onSubmit={save}>
        <div className="job-section-heading"><div><span className="job-eyebrow">STEP 1 · PERMIT DETAILS</span><h2>{permit ? permit.permitNo : '작업허가서 작성'}</h2><p className="job-help">작업과 유효기간을 확인하고 유형별 안전 확인사항을 입력하세요.</p></div><span className="job-status-badge">{permit ? permit.status : '새 허가서'}</span></div>
        <fieldset disabled={locked || !editable || conflict || creationUncertain}>
          <legend>허가서 내용</legend>
          <div className="job-fields">
            <label>작업 ID<input required inputMode="numeric" disabled={!!permit} value={workId} onChange={(event) => { setWorkId(event.target.value); setDirty(true); }} /></label>
            <label>허가 유형<select disabled={!!permit} value={type} onChange={(event) => {
              if (!confirmReplacement()) return;
              setType(event.target.value); update('form', {}); setValues({});
            }}>{Object.entries(permitTypeLabels).map(([code, label]) => <option key={code} value={code}>{label}</option>)}</select></label>
            <label>유효 시작<input type="datetime-local" step="any" required value={form.validFrom} onChange={(event) => update('validFrom', event.target.value)} /></label>
            <label>유효 종료<input type="datetime-local" step="any" required value={form.validTo} onChange={(event) => update('validTo', event.target.value)} /></label>
            <div><label>{formFields.watcherLabel}<input maxLength={50} value={form.watcherName} onChange={(event) => update('watcherName', event.target.value)} /></label>
              {visibleChecks && <FieldRuleChecks checks={visibleChecks} target="form.watcher_name" />}
            </div>
            <label>작업책임자<input maxLength={50} value={form.supervisorName} onChange={(event) => update('supervisorName', event.target.value)} /></label>
            {formFields.choices.map(({ code, label, help, options }) => (
              <div key={code}>
                <label>{label}<select value={form.form[code] ?? ''} aria-describedby={`${code}-help`}
                  onChange={(event) => update('form', setPermitChoice(form.form, code, event.target.value))}>
                  <option value="">선택 안 함 (미확인)</option>
                  {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select></label>
                <p className="job-help" id={`${code}-help`}>{help}</p>
                {visibleChecks && <FieldRuleChecks checks={visibleChecks} target={`form.${code}`} />}
              </div>
            ))}
            {formFields.checks.map(({ code, label }) => (
              <div key={code}>
                <label className="job-safety-check"><input type="checkbox" checked={form.form[code] === true}
                  aria-describedby={`${code}-state`} onChange={(event) => {
                    update('form', { ...form.form, [code]: event.target.checked });
                  }} />{label}</label>
                <p className="job-help" id={`${code}-state`}>현재: {form.form[code] === undefined ? '미확인' : form.form[code] ? '조치 확인' : '미조치'}</p>
                <div className="job-action-row">
                  <button type="button" className="job-secondary-button" onClick={() => update('form', { ...form.form, [code]: false })}>미조치로 기록 · {label}</button>
                  <button type="button" className="job-secondary-button" disabled={form.form[code] === undefined} onClick={() => {
                    const next = { ...form.form };
                    delete next[code];
                    update('form', next);
                  }}>미확인으로 초기화 · {label}</button>
                </div>
                {visibleChecks && <FieldRuleChecks checks={visibleChecks} target={`form.${code}`} />}
              </div>
            ))}
          </div>
        </fieldset>
        <p className="job-help">{permitRuleSummary[type]}</p>
        <p className="job-help">체크하면 조치 확인(true), 체크를 해제하거나 미조치로 기록하면 false입니다. 미확인으로 초기화한 항목은 키를 보내지 않습니다. 미확인은 MISSING, 미조치는 FAIL로 차단됩니다.</p>
        <p className="job-help">감시자 이름은 작업자 배치가 아닙니다. 기존 양식의 추가 필드는 수정 저장 시 보존합니다. 구역·작업자 배치 API는 미지원입니다.</p>
        {notices}
        <div className="job-step-nav">
          {permit && dirty && <span className="job-help">저장하면 최근 판정이 무효가 되어 다시 판정해야 합니다.</span>}
          {editable
            ? <button type="submit" disabled={locked || conflict || creationUncertain}>{!permit ? '저장하고 다음' : dirty ? '변경 저장하고 다음' : '다음'}</button>
            : <button type="button" disabled={locked} onClick={() => goTo(hasMeasurements ? 2 : 3)}>다음</button>}
        </div>
      </form>}

      {step === 2 && permit && <section className="panel job-form">
        <div className="job-section-heading"><div><span className="job-eyebrow">STEP 2 · PRE-WORK MEASUREMENTS</span><h2>작업 전 측정값</h2><p className="job-help">{editable ? '실제로 측정한 항목만 입력하세요. 빈 칸은 보내지 않습니다.' : '승인 요청 후라 측정값을 추가할 수 없습니다. 저장된 측정 이력만 보여 줍니다.'}</p></div><span className="job-status-badge job-status-muted">저장된 측정 {permit.measurements.length}건</span></div>
        {editable && <fieldset disabled={locked || conflict}>
          <div className="job-fields">
            {measurementFields[type].map(({ code, label }) => <div key={code}>
              <label>{label}<input type="number" min="0" max={['O2', 'CO2', 'LEL'].includes(code) ? 100 : undefined} step="any" value={values[code] ?? ''}
                onChange={(event) => { setValues((current) => ({ ...current, [code]: event.target.value })); setMessage(''); setError(''); }} /></label>
              {visibleChecks && <FieldRuleChecks checks={visibleChecks} target={`measurement.${code}`} />}
            </div>)}
          </div>
        </fieldset>}
        <p className="job-help">단위와 PRE_WORK 단계는 서버가 정하고, 측정 시각은 서버 현재 시각입니다. 다시 측정해 저장하면 재측정으로 쌓이고 최근 값으로 판정합니다.</p>
        {permit.measurements.length > 0 && <div className="table-scroll"><table className="job-measurements-table"><caption className="sr-only">저장된 작업 전 측정 이력</caption><thead><tr><th>항목</th><th>측정값</th><th>측정 일시</th><th>구분</th></tr></thead><tbody>{permit.measurements.map((item) => <tr key={item.id}><td>{item.item}</td><td><strong>{item.value}</strong> {item.unit}</td><td>{item.measuredAt}</td><td>{item.remeasure ? '재측정' : '최초 측정'}</td></tr>)}</tbody></table></div>}
        {notices}
        <div className="job-step-nav">
          <button type="button" className="job-secondary-button" disabled={locked} onClick={() => {
            if (measurementDirty && !window.confirm('저장하지 않은 측정값을 버리고 이전 단계로 갈까요?')) return;
            setValues({}); goTo(1);
          }}>이전</button>
          {editable
            ? <button type="button" disabled={locked || conflict} onClick={saveMeasurementsAndNext}>{measurementDirty ? '저장하고 다음' : '다음'}</button>
            : <button type="button" disabled={locked} onClick={() => goTo(3)}>다음</button>}
        </div>
      </section>}

      {step === 3 && permit && <section className="panel job-example">
        <span className="job-eyebrow">STEP 3 · RULE CHECK</span><h2>규칙 판정</h2>
        <p className="job-help">{permitRuleSummary[type]} PASS는 등록된 규칙 안에서 위반이 없다는 뜻이고, 최종 안전 승인이 아닙니다.</p>
        {editable && <div className="job-action-row">
          <button type="button" disabled={locked || conflict} onClick={runCheck}>{currentEvaluation ? '다시 판정' : '규칙 판정 실행'}</button>
        </div>}
        {!conflict && currentEvaluation && <div className={`job-evaluation job-evaluation-${currentEvaluation.result.toLowerCase()}`} role="status">
          <h3>최근 판정: {currentEvaluation.result}</h3>
          {evaluation ? <RuleChecks evaluation={evaluation} /> : <>
            <p className="job-help">저장된 판정은 위반 내역만 있습니다. 전체 규칙의 통과·입력 누락 상세는 판정 직후에만 표시되며 서버에 저장되지 않습니다. 다시 판정하면 볼 수 있습니다.</p>
            {currentEvaluation.violations.map((item, index) => <div key={`${item.ruleCode}-${index}`}>
              <strong>{item.severity} · {item.message}</strong>
              <p>{item.ruleCode} · 측정: {item.actual ?? '미입력'} · 기준: {item.expected}</p>
              {item.action && <p>조치: {item.action}</p>}
              <p>근거: {item.legalBasis}</p>
            </div>)}
          </>}
          {evaluation?.unusedFields.length > 0 && <p>미사용 입력: {evaluation.unusedFields.join(', ')}</p>}
        </div>}
        {editable && !conflict && blocked.length > 0 && <div className="job-step-fixes">
          <h3>고칠 항목</h3>
          <ul>{blocked.map((item, index) => {
            const target = stepForTarget(item.target);
            return <li key={`${item.ruleCode}-${index}`}>
              <span>{item.message || item.ruleCode} ({ruleCheckLabels[item.status] ?? item.severity})</span>
              <button type="button" className="job-secondary-button" disabled={locked || (target === 2 && !hasMeasurements)}
                onClick={() => goTo(target)}>{target === 2 ? '2단계 측정값에서 고치기' : '1단계 허가서에서 고치기'}</button>
            </li>;
          })}</ul>
        </div>}
        {!conflict && noApplicableRules && <p className="job-demo-notice" role="status">등록된 판정 규칙이 없는 허가서는 승인 요청할 수 없습니다.</p>}
        {!conflict && serverDisallowsSubmit && blocked.length === 0 && <p className="job-demo-notice" role="status">서버에서 승인 요청 불가로 응답했습니다. 규칙 판정을 다시 실행해 상세 결과를 확인하세요.</p>}
        {notices}
        <div className="job-step-nav">
          <button type="button" className="job-secondary-button" disabled={locked} onClick={() => goTo(hasMeasurements ? 2 : 1)}>이전</button>
          <button type="button" disabled={locked || !reachable[4]} onClick={() => goTo(4)}>다음</button>
        </div>
      </section>}

      {step === 4 && permit && <section className="panel job-example">
        <span className="job-eyebrow">STEP 4 · SUBMIT</span><h2>승인 요청</h2>
        <p className="job-help">같은 구역의 최근 아차사고 경고를 확인해야 승인 요청할 수 있습니다. 승인 요청 후에는 내용과 측정값을 바꿀 수 없습니다.</p>
        <WorkIncidentWarnings key={`work-warnings-${permit.workId}`} siteId={siteId}
          initialWorkId={permit.workId} disabled={disabled || busy} />
        <dl className="job-permit-review">
          <div><dt>허가서</dt><dd>{permit.permitNo} ({permitTypeLabels[permit.permitType]})</dd></div>
          <div><dt>유효기간</dt><dd>{permit.validFrom} ~ {permit.validTo}</dd></div>
          <div><dt>{permitFormFieldsOf(permit.permitType).watcherLabel}</dt><dd>{permit.watcherName || '미입력'}</dd></div>
          <div><dt>측정값</dt><dd>{permit.measurements.length ? `${permit.measurements.length}건` : '없음'}</dd></div>
          <div><dt>최근 판정</dt><dd>{currentEvaluation ? currentEvaluation.result : '없음'}</dd></div>
          <div><dt>상태</dt><dd>{permit.status}</dd></div>
        </dl>
        {notices}
        <div className="job-step-nav">
          <button type="button" className="job-secondary-button" disabled={locked} onClick={() => goTo(3)}>이전</button>
          {editable && <button type="button" disabled={locked || conflict || noApplicableRules || !permit.canSubmit} onClick={submit}>승인 요청</button>}
        </div>
      </section>}
    </>
  );
}

export default function JobPermits() {
  const context = useWorkSite();
  const [params] = useSearchParams();
  return (
    <JobPageLayout title="작업허가" user={context.account?.user} contentClassName="job-management">
      <JobPageHeading title="작업허가" description="허가서 작성 → 측정값 → 규칙 판정 → 승인 요청을 한 단계씩 진행합니다." context={context} />
      {context.currentSite && <PermitWorkspace key={`${context.currentSite.siteId}:${params}`} siteId={context.currentSite.siteId}
        disabled={context.selecting} initialWorkId={params.get('workId')} initialPermitId={params.get('permitId')} />}
    </JobPageLayout>
  );
}
