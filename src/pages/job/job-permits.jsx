import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useWorkSite } from '../../api/workers';
import {
  checkPermit, createPermit, getPermit, getWork, measurementFields, measurementItems,
  requireWork, saveMeasurements, submitPermit, updatePermit, validatePeriod,
} from '../../api/jobs';
import JobPageLayout, { JobPageHeading } from '../../components/job-page-layout';
import { JobSiteSelector } from './job-work-form';

const hotChecks = {
  extinguisher_ready: '소화기 비치',
  spark_prevention: '불티 비산 방지',
  flammable_vapor_removed: '인화성 증기 제거',
};
const emptyForm = { validFrom: '', validTo: '', watcherName: '', supervisorName: '', form: {} };
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

function PermitWorkspace({ siteId, disabled, initialWorkId }) {
  const [workId, setWorkId] = useState(initialWorkId ?? '');
  const [permitId, setPermitId] = useState('');
  const [verifiedWork, setVerifiedWork] = useState(null);
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
  const mounted = useRef(false);
  const pending = useRef(false);
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
  const confirmReplacement = () => !(dirty || Object.values(values).some((value) => String(value).trim()))
    || window.confirm('저장하지 않은 내용과 측정값을 버리고 계속하시겠습니까?');
  const load = (id) => {
    if (!confirmReplacement()) return;
    return run(async () => {
      let saved;
      try {
        saved = await getPermit(id, siteId);
      } catch (requestError) {
        if (requestError.code === 'PERMIT_NOT_FOUND') {
          throw new Error(`${requestError.message} 입력한 번호는 허가서 ID입니다. 작업 ID를 받은 경우 아래 작성 영역에서 작업 저장 여부를 확인한 후 새 허가서를 저장하세요. 작업과 허가서는 별도 번호입니다.`, { cause: requestError });
        }
        throw requestError;
      }
      if (mounted.current) { apply(saved); setMessage('서버의 허가서를 조회했습니다.'); }
    });
  };
  const save = (event) => {
    event.preventDefault();
    if (conflict || creationUncertain) return;
    void run(async () => {
      validatePeriod(form.validFrom, form.validTo);
      const body = {
        ...form, watcherName: form.watcherName.trim() || null,
        supervisorName: form.supervisorName.trim() || null,
      };
      let saved;
      if (permit) saved = await updatePermit(permit.permitId, { ...body, lockVersion: permit.lockVersion }, siteId);
      else {
        const work = requireWork(await getWork(workId), siteId);
        saved = await createPermit({ ...body, workId: work.workId, permitType: type }, siteId);
      }
      if (mounted.current) {
        apply(saved);
        setValues(values);
        setMessage(`작업 #${saved.workId}의 허가서 #${saved.permitId}를 서버에 저장했습니다. 이후 허가서 조회에는 ${saved.permitId}번을 사용하세요. 측정값 저장 후 판정하세요.`);
      }
    });
  };
  const update = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setDirty(true);
    setEvaluation(null);
    setMessage('');
  };
  const editable = !permit || ['DRAFT', 'CHECKING', 'BLOCKED'].includes(permit.status);
  const locked = busy || disabled;
  const measurementDirty = Object.values(values).some((value) => String(value).trim());
  const currentEvaluation = evaluation ?? permit?.lastEvaluation;
  const visibleChecks = !dirty && !measurementDirty && !conflict ? evaluation?.checks : undefined;
  const noApplicableRules = evaluation?.rulesApplied === 0;
  const serverDisallowsSubmit = permit?.status === 'DRAFT' && permit.lastEvaluation
    && !permit.canSubmit && !noApplicableRules;
  return (
    <>
      <ol className="job-workflow" aria-label="허가서 진행 단계">
        <li aria-current={!permit ? 'step' : undefined}><span>1</span>허가서 작성</li>
        <li aria-current={permit && !permit.lastEvaluation ? 'step' : undefined}><span>2</span>측정값 저장</li>
        <li aria-current={permit?.lastEvaluation && permit.status !== 'PENDING' ? 'step' : undefined}><span>3</span>규칙 판정</li>
        <li aria-current={permit?.status === 'PENDING' ? 'step' : undefined}><span>4</span>승인 요청</li>
      </ol>
      <p className="job-demo-notice" role="status">작업 ID와 허가서 ID는 별도 번호입니다. 작업 등록만으로 허가서가 생성되지는 않습니다. 작업 ID만 있다면 아래 ‘작업허가서 작성’에서 작업을 확인하고 허가서를 저장하세요. ‘기존 허가서 조회’에는 허가서 저장 후 발급된 ID를 입력합니다.</p>
      {error && <p className="dashboard-error" role="alert">{error}</p>}
      {conflict && <p className="job-demo-notice" role="status">최신 버전 확인이 필요합니다. 허가서 ID로 다시 조회한 뒤 수정·판정·승인 요청하세요.</p>}
      {message && <p className="job-review-notice" role="status">{message}</p>}
      {creationUncertain && <section className="job-demo-notice" role="alert">
        <p>허가서 생성 여부가 불확실하여 재등록을 중지했습니다. 허가서 ID로 조회하거나 관리자에게 저장 여부를 확인하세요. 기존 허가서가 있으면 새로 만들지 말고 조회하세요.</p>
        <button type="button" disabled={busy || disabled} onClick={() => {
          if (window.confirm('허가서 저장 여부를 확인했으며 새 등록을 진행하시겠습니까?')) {
            setCreationUncertain(false); setError('');
          }
        }}>반영 여부 확인 후 등록 잠금 해제</button>
      </section>}
      <form className="panel job-form job-lookup job-lookup-wide" onSubmit={(event) => { event.preventDefault(); void load(permitId); }}>
        <div><span className="job-eyebrow">FIND PERMIT</span><h2>기존 허가서 조회</h2><p className="job-help">이미 저장한 허가서 ID로 조회합니다. 작업 현황에서 발급된 작업 ID를 입력하는 곳이 아닙니다.</p></div>
        <fieldset disabled={locked}>
          <label>허가서 ID<input required inputMode="numeric" placeholder="허가서 ID 입력" value={permitId} onChange={(event) => setPermitId(event.target.value)} /></label>
          <button type="submit">허가서 조회 (입력 내용 교체)</button>
          {permit && <button type="button" className="job-secondary-button" onClick={() => {
            if (!confirmReplacement()) return;
            setPermit(null); setPermitId(''); setVerifiedWork(null); setForm(emptyForm); setValues({}); setDirty(false);
            setConflict(false); setCreationUncertain(false); setEvaluation(null); setError(''); setMessage('');
          }}>새 허가서 작성</button>}
        </fieldset>
      </form>
      <form className="panel job-form" onSubmit={save}>
        <div className="job-section-heading"><div><span className="job-eyebrow">PERMIT DETAILS</span><h2>{permit ? permit.permitNo : '작업허가서 작성'}</h2><p className="job-help">작업과 유효기간을 확인하고 유형별 안전 확인사항을 입력하세요.</p></div><span className="job-status-badge">{permit ? permit.status : '새 허가서'}</span></div>
        <fieldset disabled={locked || !editable || conflict || creationUncertain}>
          <legend>허가서 내용</legend>
          <div className="job-fields">
            <div>
              <label>작업 ID<input required inputMode="numeric" disabled={!!permit} value={workId} onChange={(event) => {
                setWorkId(event.target.value); setVerifiedWork(null); setDirty(true);
              }} /></label>
              {!permit && <button type="button" className="job-secondary-button" onClick={() => run(async () => {
                const work = requireWork(await getWork(workId), siteId);
                if (mounted.current) {
                  setVerifiedWork(work);
                  setMessage(`작업 #${work.workId}의 서버 저장을 확인했습니다. 허가서는 아직 생성하지 않았습니다. 유효기간과 안전 확인사항을 입력하고 허가서를 저장하세요.`);
                }
              })}>작업 저장 여부 확인</button>}
              {!permit && verifiedWork && <p className="job-help" role="status">서버 확인 완료: 작업 #{verifiedWork.workId} · {verifiedWork.title}</p>}
            </div>
            <label>허가 유형<select disabled={!!permit} value={type} onChange={(event) => {
              if (!confirmReplacement()) return;
              setType(event.target.value); update('form', {}); setValues({});
            }}>{Object.entries({ HOT: '화기', CONFINED: '밀폐공간', HEIGHT: '고소' }).map(([code, label]) => <option key={code} value={code}>{label}</option>)}</select></label>
            <label>유효 시작<input type="datetime-local" step="any" required value={form.validFrom} onChange={(event) => update('validFrom', event.target.value)} /></label>
            <label>유효 종료<input type="datetime-local" step="any" required value={form.validTo} onChange={(event) => update('validTo', event.target.value)} /></label>
            <div><label>감시자<input maxLength={50} value={form.watcherName} onChange={(event) => update('watcherName', event.target.value)} /></label>
              {visibleChecks && <FieldRuleChecks checks={visibleChecks} target="form.watcher_name" />}
            </div>
            <label>작업책임자<input maxLength={50} value={form.supervisorName} onChange={(event) => update('supervisorName', event.target.value)} /></label>
            {type === 'HOT' && Object.entries(hotChecks).map(([code, label]) => (
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
          <div className="job-form-actions"><span>내용 변경 후에는 다시 판정해야 합니다.</span><button type="submit">{permit ? '내용 변경 저장 (판정 무효화)' : '허가서 저장'}</button></div>
        </fieldset>
        <p className="job-help">감시자 이름은 작업자 배치가 아닙니다. 기존 양식의 추가 필드는 수정 저장 시 보존합니다. 구역·작업자 배치 API는 미지원입니다.</p>
        {type === 'HOT' && <p className="job-help">체크하면 조치 확인(true), 체크를 해제하거나 미조치로 기록하면 false입니다. 미확인으로 초기화한 항목은 키를 보내지 않습니다. 미확인은 MISSING, 미조치는 FAIL로 차단됩니다.</p>}
        <p className="job-help">화기는 측정값·화재감시자·안전 확인 3항목을 판정합니다. 현재 등록된 판정 규칙이 없는 유형은 고소입니다.</p>
      </form>
      {permit && <>
        <section className="panel job-form">
          <div className="job-section-heading"><div><span className="job-eyebrow">PRE-WORK MEASUREMENTS</span><h2>작업 전 측정값</h2></div><span className="job-status-badge job-status-muted">저장된 측정 {permit.measurements.length}건</span></div>
          <fieldset disabled={locked || !editable || conflict || dirty}>
            <div className="job-fields">
              {measurementFields[type].map(({ code, label }) => <div key={code}>
                <label>{label}<input type="number" min="0" max={['O2', 'CO2', 'LEL'].includes(code) ? 100 : undefined} step="any" value={values[code] ?? ''}
                  onChange={(event) => { setValues((current) => ({ ...current, [code]: event.target.value })); setMessage(''); }} /></label>
                {visibleChecks && <FieldRuleChecks checks={visibleChecks} target={`measurement.${code}`} />}
              </div>)}
            </div>
            {measurementFields[type].length > 0 && <button type="button" onClick={() => run(async () => {
              const items = measurementItems(type, values);
              const saved = await saveMeasurements(permit.permitId, items, siteId);
              if (mounted.current) { apply(saved); setMessage('측정값을 저장했습니다. 기존 측정값은 이력으로 남고 최근 판정은 무효화되었습니다.'); }
            })}>측정값 저장 / 재측정 추가</button>}
          </fieldset>
          <p className="job-help">빈 값은 전송하지 않습니다. 단위와 PRE_WORK 단계는 서버가 결정하며, 측정 시각은 서버 현재 시각입니다.</p>
          <p className="job-help">판정 후 항목별 통과·기준 미충족·입력 누락과 서버 기준을 표시합니다. 입력을 변경하면 이전 표시는 숨겨집니다. 재조회한 허가서는 전체 규칙 상세가 없으므로 다시 판정해야 표시됩니다.</p>
          {permit.measurements.length > 0 ? <div className="table-scroll"><table className="job-measurements-table"><caption className="sr-only">저장된 작업 전 측정 이력</caption><thead><tr><th>항목</th><th>측정값</th><th>측정 일시</th><th>구분</th></tr></thead><tbody>{permit.measurements.map((item) => <tr key={item.id}><td>{item.item}</td><td><strong>{item.value}</strong> {item.unit}</td><td>{item.measuredAt}</td><td>{item.remeasure ? '재측정' : '최초 측정'}</td></tr>)}</tbody></table></div> : <p className="job-empty-state job-help">{measurementFields[type].length ? '저장된 측정값이 없습니다. 실제 측정한 항목을 입력해 주세요.' : '이 허가 유형에는 현재 입력할 측정 항목이 없습니다.'}</p>}
        </section>
        <section className="panel job-example">
          <span className="job-eyebrow">REVIEW & SUBMIT</span><h2>규칙 판정 및 승인 요청</h2>
          <p>허가서 #{permit.permitId} · 작업 #{permit.workId} · 상태 {permit.status} · 버전 {permit.lockVersion}</p>
          {(dirty || measurementDirty) && <p className="job-demo-notice" role="status">미저장 입력이 있습니다. 내용과 측정값을 저장한 뒤 판정·승인 요청하세요.</p>}
          <div className="job-action-row">
          <button type="button" disabled={locked || !editable || conflict || dirty || measurementDirty} onClick={() => run(async () => {
            // A check can persist even if its response is lost or invalid.
            if (mounted.current) { setConflict(true); setEvaluation(null); }
            const checked = await checkPermit(permit.permitId);
            const checkedEvaluation = checked.evaluation;
            const saved = await getPermit(permit.permitId, siteId);
            if (mounted.current) {
              apply(saved); setEvaluation(checkedEvaluation);
              setMessage('판정 기록을 서버에 저장했습니다. 판정은 최종 안전 승인이 아닙니다.');
            }
          })}>규칙 판정 저장</button>
          <button type="button" disabled={locked || conflict || dirty || measurementDirty || noApplicableRules || !permit.canSubmit} onClick={() => run(async () => {
            if (noApplicableRules) throw new Error('등록된 판정 규칙이 없는 허가서는 승인 요청할 수 없습니다.');
            const saved = await submitPermit(permit.permitId, siteId);
            if (mounted.current) { apply(saved); setMessage('승인 요청을 저장했습니다 (PENDING). 승인 완료나 작업 시작 허가가 아닙니다.'); }
          })}>승인 요청</button>
          </div>
          {!dirty && !measurementDirty && !conflict && currentEvaluation && <div className={`job-evaluation job-evaluation-${currentEvaluation.result.toLowerCase()}`} role="status">
            <h3>최근 판정: {currentEvaluation.result}</h3>
            {evaluation ? <RuleChecks evaluation={evaluation} /> : <>
            <p className="job-help">저장된 판정은 위반 내역만 제공합니다. 전체 규칙의 통과·입력 누락 상세는 규칙 판정 직후에 표시되며, 서버에 저장되지 않습니다.</p>
            {currentEvaluation.violations.map((item, index) => <div key={`${item.ruleCode}-${index}`}>
              <strong>{item.severity} · {item.message}</strong>
              <p>{item.ruleCode} · 측정: {item.actual ?? '미입력'} · 기준: {item.expected}</p>
              {item.action && <p>조치: {item.action}</p>}
              <p>근거: {item.legalBasis}</p>
            </div>)}
            </>}
            {evaluation?.unusedFields.length > 0 && <p>미사용 입력: {evaluation.unusedFields.join(', ')}</p>}
          </div>}
          {!dirty && !measurementDirty && !conflict && noApplicableRules && <p className="job-demo-notice" role="status">등록된 판정 규칙이 없는 허가서는 승인 요청할 수 없습니다.</p>}
          {!dirty && !measurementDirty && !conflict && serverDisallowsSubmit && <p className="job-demo-notice" role="status">서버에서 승인 요청 불가로 응답했습니다. PASS여도 적용 규칙이 0건이면 요청할 수 없습니다. 규칙 판정을 다시 실행해 상세 결과를 확인하세요.</p>}
          <p className="job-help">PASS는 등록된 규칙 내 위반이 없다는 뜻입니다. 적용 규칙 0건은 승인 요청할 수 없으며, 그 외에도 서버의 canSubmit이 true여야 합니다. 승인 요청 후 내용과 측정값을 변경할 수 없습니다.</p>
        </section>
      </>}
    </>
  );
}

export default function JobPermits() {
  const context = useWorkSite();
  const [params] = useSearchParams();
  return (
    <JobPageLayout title="작업허가" user={context.account?.user} contentClassName="job-management">
      <JobPageHeading title="작업허가" description="작업 전 안전 정보를 확인하고 허가서 작성부터 승인 요청까지 진행합니다." />
      <JobSiteSelector context={context} />
      {context.currentSite && <PermitWorkspace key={context.currentSite.siteId} siteId={context.currentSite.siteId}
        disabled={context.selecting} initialWorkId={params.get('workId')} />}
    </JobPageLayout>
  );
}
