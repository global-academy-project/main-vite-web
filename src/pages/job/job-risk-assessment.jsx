import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../../api/client';
import { getWorkRiskAssessment, jobWrite } from '../../api/jobs';
import JobDraftForm from './job-work-form';

function RiskAssessmentLookup({ context, initialWorkId }) {
  const [workId, setWorkId] = useState(initialWorkId ?? '');
  const [request, setRequest] = useState(initialWorkId ?? '');
  const [lookupVersion, setLookupVersion] = useState(0);
  const [result, setResult] = useState(null);
  const [submitBusy, setSubmitBusy] = useState(false);
  const [submitUncertain, setSubmitUncertain] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitMessage, setSubmitMessage] = useState('');
  const siteId = context.currentSite?.siteId;
  const requestKey = `${siteId}:${request}:${lookupVersion}`;
  const loaded = result?.key === requestKey;
  const assessment = loaded ? result.assessment : null;
  const loading = Boolean(request && siteId && !loaded);
  const error = loaded ? result.error : '';

  useEffect(() => {
    if (!request || !siteId) return undefined;
    let cancelled = false;
    getWorkRiskAssessment(request).then((saved) => {
      if (saved.siteId !== siteId) {
        throw new Error('선택한 현장의 위험성평가가 아닙니다.');
      }
      if (!cancelled) setResult({ key: requestKey, assessment: saved, error: '' });
    }).catch((requestError) => {
      if (!cancelled) setResult({
        key: requestKey, assessment: null,
        error: requestError.message || '위험성평가를 불러오지 못했습니다.',
      });
    });
    return () => { cancelled = true; };
  }, [request, lookupVersion, siteId, requestKey]);

  const lookup = () => {
    setRequest(workId.trim());
    setLookupVersion((value) => value + 1);
    setSubmitUncertain(false);
    setSubmitError('');
    setSubmitMessage('');
  };

  const refreshAssessment = async () => {
    const refreshed = await getWorkRiskAssessment(request);
    if (refreshed.siteId !== siteId) throw new Error('선택한 현장의 위험성평가가 아닙니다.');
    setResult({ key: requestKey, assessment: refreshed, error: '' });
    return refreshed;
  };

  const submit = async () => {
    if (!assessment || submitBusy || submitUncertain) return;
    setSubmitBusy(true);
    setSubmitError('');
    setSubmitMessage('');
    try {
      await jobWrite(() => api(`/api/v1/risk-assessments/${assessment.riskAssessmentId}/submit`, {
        method: 'POST',
      }));
    } catch (requestError) {
      if (requestError.code === 'WRITE_OUTCOME_UNKNOWN') setSubmitUncertain(true);
      setSubmitError(requestError.message || '위험성평가 승인 요청에 실패했습니다.');
      setSubmitBusy(false);
      return;
    }

    setSubmitMessage('위험성평가 승인 요청을 접수했습니다. 최신 상태를 확인하는 중입니다.');
    try {
      const refreshed = await refreshAssessment();
      setSubmitMessage(`승인 요청 완료 · 현재 상태: ${refreshed.status}`);
    } catch (requestError) {
      setSubmitError(`승인 요청은 완료됐지만 최신 상태를 다시 불러오지 못했습니다: ${requestError.message || '조회 오류'}`);
    } finally {
      setSubmitBusy(false);
    }
  };

  const recheckSubmission = async () => {
    setSubmitBusy(true);
    setSubmitError('');
    try {
      const refreshed = await refreshAssessment();
      setSubmitUncertain(false);
      setSubmitMessage(`최신 위험성평가 상태를 확인했습니다: ${refreshed.status}`);
    } catch (requestError) {
      setSubmitError(requestError.message || '최신 위험성평가를 불러오지 못했습니다.');
    } finally {
      setSubmitBusy(false);
    }
  };
  return (
    <section className="panel job-example" aria-label="저장된 위험성평가 조회">
      <h2>작업별 위험성평가 조회</h2>
      <p className="job-help">작업 목록의 평가 버튼을 누르거나 작업 ID를 입력해 최신 판을 조회합니다.</p>
      <div className="job-lookup-wide">
        <fieldset>
          <label>작업 ID<input inputMode="numeric" value={workId}
            onChange={(event) => setWorkId(event.target.value)} /></label>
          <button type="button" disabled={!context.currentSite || !workId.trim()}
            onClick={lookup}>최신 평가 조회</button>
        </fieldset>
      </div>
      {loading && <p role="status">위험성평가를 불러오는 중입니다...</p>}
      {error && <p className="dashboard-error" role="alert">{error}</p>}
      {submitError && <p className="dashboard-error" role="alert">{submitError}</p>}
      {submitMessage && <p className="job-review-notice" role="status">{submitMessage}</p>}
      {submitUncertain && <button type="button" className="job-history-refresh" disabled={submitBusy}
        onClick={recheckSubmission}>요청 결과 확인</button>}
      {assessment && <>
        <div className="job-section-heading">
          <strong>평가 #{assessment.riskAssessmentId} · 작업 #{assessment.workId}</strong>
          <span className="job-status-badge">{assessment.status}</span>
        </div>
        <p>{assessment.assessDate} · {assessment.assessmentType} · revision {assessment.revision}</p>
        <p className="job-help">승인 요청 가능: {assessment.canSubmit ? '가능' : '불가'}</p>
        {assessment.status === 'DRAFT' && <button type="button" disabled={submitBusy || submitUncertain
          || !assessment.canSubmit || assessment.items.length === 0} onClick={submit}>
          {submitBusy ? '승인 요청 중...' : '위험성평가 승인 요청'}
        </button>}
        {assessment.status === 'PENDING' && <p className="job-help">승인 대기 중입니다. 이 화면에서는 평가 내용을 수정할 수 없습니다.</p>}
        {assessment.items.length ? <div className="job-risk-list">
          {assessment.items.map((item) => (
            <article className="panel" key={item.seq}>
              <h3>{item.seq}. {item.workStep || '작업 단계 미지정'}</h3>
              <p><strong>위험요인:</strong> {item.hazard}</p>
              <p><strong>발생형태:</strong> {item.accidentType || '미지정'}</p>
              <p><strong>초기 위험도:</strong> {item.frequency ?? '-'} × {item.severity ?? '-'} = {item.riskScore ?? '-'} ({item.riskLevel ?? '미지정'})</p>
              <p><strong>감소대책:</strong></p>
              {String(item.controls ?? '').split(/\r?\n/).filter(Boolean).map((control, index) => <p key={index}>{control}</p>)}
              <p><strong>잔여 위험도:</strong> {item.residualFrequency ?? '-'} × {item.residualSeverity ?? '-'} = {item.residualScore ?? '-'}</p>
            </article>
          ))}
        </div> : <p className="job-help">등록된 위험요인이 없습니다.</p>}
      </>}
    </section>
  );
}

const initialRisks = [
  { id: 1, step: '', hazard: '', action: '', frequency: '', severity: '' },
];

function RiskFields() {
  const [risks, setRisks] = useState(initialRisks);
  const updateRisk = (id, field, value) => {
    setRisks((current) => current.map((risk) => risk.id === id ? { ...risk, [field]: value } : risk));
  };

  return (
    <>
      <div className="job-fields">
        <label>평가명<input required /></label>
        <label>평가 구분<select defaultValue="DAILY"><option value="DAILY">일일</option><option value="INITIAL">최초</option><option value="REGULAR">정기</option><option value="ADHOC">수시</option></select></label>
        <label>작업 장소 메모<input required /></label>
        <label>평가일<input type="date" required /></label>
      </div>
      <h2>위험요인 및 감소대책</h2>
      {/* <p className="job-help">risk_assessments · risk_assessment_items 입력 연습입니다. 작업 ID·구역 ID 연결 및 저장 API는 미지원입니다. 빈도×강도 계산은 승인 또는 안전 판정이 아닙니다.</p> */}
      <div className="job-risk-list">
        {risks.map((risk, index) => (
          <fieldset key={risk.id}>
            <legend>작업 단계 {index + 1}</legend>
            <div className="job-fields">
              <label>작업 단계<input required value={risk.step} onChange={(event) => updateRisk(risk.id, 'step', event.target.value)} /></label>
              <label>위험요인<input required value={risk.hazard} onChange={(event) => updateRisk(risk.id, 'hazard', event.target.value)} /></label>
              <label className="job-field-wide">감소대책<textarea required value={risk.action} onChange={(event) => updateRisk(risk.id, 'action', event.target.value)} /></label>
              <label>빈도 (1~5)<input type="number" min="1" max="5" step="1" required value={risk.frequency} onChange={(event) => updateRisk(risk.id, 'frequency', event.target.value)} /></label>
              <label>강도 (1~5)<input type="number" min="1" max="5" step="1" required value={risk.severity} onChange={(event) => updateRisk(risk.id, 'severity', event.target.value)} /></label>
            </div>
            <p className="job-help">계산 점수: <output>{risk.frequency && risk.severity ? Number(risk.frequency) * Number(risk.severity) : '미입력'}</output></p>
            {risks.length > 1 && <button className="job-secondary-button" type="button" onClick={() => setRisks((current) => current.filter(({ id }) => id !== risk.id))}>단계 삭제</button>}
          </fieldset>
        ))}
      </div>
      <button className="job-secondary-button" type="button" onClick={() => setRisks((current) => [...current, { id: Math.max(...current.map(({ id }) => id)) + 1, step: '', hazard: '', action: '', frequency: '', severity: '' }])}>작업 단계 추가</button>
    </>
  );
}

export default function JobRiskAssessment() {
  const [params] = useSearchParams();
  return <JobDraftForm title="작업 위험성평가" description="작업 단계별 위험요인과 감소대책을 작성합니다.">
    {(context) => <>
      <RiskAssessmentLookup key={`${context.currentSite?.siteId ?? ''}:${params.get('workId') ?? ''}`}
        context={context} initialWorkId={params.get('workId')} />
      <RiskFields />
    </>}
  </JobDraftForm>;
}
