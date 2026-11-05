import { useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { reloadJobConflict } from '../../api/jobs';
import {
  createRiskAssessment, getRiskAssessment, getWorkRiskAssessment, submitRiskAssessment,
  updateRiskAssessment, reviseRiskAssessment,
} from '../../api/risk-assessments';
import { useWorkSite } from '../../api/workers';
import { riskAssessmentBody, riskLevelNotice } from '../../utils/job-forms';
import { TAG_LABELS } from '../../utils/agentic-rag-tags';
import JobPageLayout, { JobPageHeading } from '../../components/job-page-layout';

const blankItem = (seq) => ({
  seq, workStep: '', hazard: '', accidentType: '', frequency: '', severity: '',
  riskLevel: 'MEDIUM', controls: '', residualFrequency: '', residualSeverity: '',
});

function itemForForm(item, index) {
  return {
    seq: index + 1,
    workStep: item.workStep ?? '',
    hazard: item.hazard ?? '',
    accidentType: item.accidentType ?? '',
    frequency: String(item.frequency ?? ''),
    severity: String(item.severity ?? ''),
    riskLevel: item.riskLevel ?? 'MEDIUM',
    computedLevel: item.computedLevel,
    controls: item.controls ?? '',
    residualFrequency: item.residualFrequency == null ? '' : String(item.residualFrequency),
    residualSeverity: item.residualSeverity == null ? '' : String(item.residualSeverity),
  };
}

function RiskWorkspace({ site, disabled, initialRiskId, initialWorkId }) {
  const [risk, setRisk] = useState(null);
  const [riskId, setRiskId] = useState(initialRiskId ?? '');
  const [workId, setWorkId] = useState(initialWorkId ?? '');
  const [assessDate, setAssessDate] = useState('');
  const [items, setItems] = useState([blankItem(1)]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [dirty, setDirty] = useState(false);
  const [needsReload, setNeedsReload] = useState(false);
  const pending = useRef(false);
  const locked = Boolean(risk && (risk.status !== 'DRAFT' || risk.approvalStatus === 'PENDING'));

  const applyRisk = (saved) => {
    setRisk(saved);
    setRiskId(String(saved.riskAssessmentId));
    setWorkId(String(saved.workId));
    setAssessDate(saved.assessDate);
    setItems(saved.items.length ? saved.items.map(itemForForm) : [blankItem(1)]);
    setDirty(false); setNeedsReload(false);
  };
  const run = async (action, success) => {
    if (pending.current || disabled) return;
    pending.current = true;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const saved = await action();
      if (saved) applyRisk(saved);
      setMessage(typeof success === 'function' ? success(saved) : success);
    } catch (requestError) {
      if (requestError.status === 409 || requestError.code === 'WRITE_OUTCOME_UNKNOWN') {
        setNeedsReload(true);
      }
      setError(requestError.message || '위험성평가 요청에 실패했습니다.');
      if (requestError.code === 'CONFLICT_MODIFIED' && risk) {
        try {
          const latest = await reloadJobConflict(requestError, () => getRiskAssessment(risk.riskAssessmentId, site.siteId));
          applyRisk(latest);
          setMessage('다른 변경과 충돌하여 최신 기록으로 입력을 교체했습니다. 내용을 확인하고 다시 수정하세요. 자동 재저장하지 않았습니다.');
        } catch (reloadError) { setError(reloadError.message); }
      }
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };

  const load = (event) => {
    event.preventDefault();
    void run(async () => {
      const saved = riskId.trim()
        ? await getRiskAssessment(riskId, site.siteId)
        : await getWorkRiskAssessment(workId, site.siteId);
      return saved;
    }, '위험성평가를 불러왔습니다.');
  };

  const save = (event) => {
    event.preventDefault();
    if (needsReload || locked) return;
    let payload;
    void run(() => {
      payload = riskAssessmentBody({ risk, siteId: site.siteId, workId, assessDate, items });
      return risk
        ? updateRiskAssessment(risk.riskAssessmentId, payload, site.siteId)
        : createRiskAssessment(payload, site.siteId);
    }, (saved) => `${risk ? '위험성평가 변경 사항을 저장했습니다.' : '위험성평가 초안을 저장했습니다.'} ${riskLevelNotice(payload, saved)}`);
  };

  const updateItem = (seq, field, value) => {
    setItems((current) => current.map((item) => item.seq === seq ? { ...item, [field]: value } : item));
    setDirty(true);
  };

  return (
    <>
      <p className="job-demo-notice">위험성평가 작성·수정은 추가 API가 배포된 서버에서 사용할 수 있습니다. 작업에 기존 평가나 에이전트 초안이 있으면 먼저 조회한 뒤 수정하세요.</p>
      {needsReload && <p className="job-demo-notice" role="alert">저장 결과 또는 최신 버전 확인이 필요합니다. 기존 평가 ID나 작업 ID로 조회한 뒤 계속하세요. 작업 ID로 조회하려면 평가 ID를 비워 두세요.</p>}
      {error && <p className="dashboard-error" role="alert">{error}</p>}
      {message && <p className="job-review-notice" role="status">{message}</p>}
      <form className="panel job-form job-lookup" onSubmit={load}>
        <span className="job-eyebrow">FIND RISK ASSESSMENT</span>
        <h2>기존 평가 불러오기</h2>
        <fieldset disabled={disabled || busy}>
          <div className="job-fields">
            <label>위험성평가 ID (입력 시 우선 조회)
              <input value={riskId} inputMode="numeric" onChange={(event) => setRiskId(event.target.value)} />
            </label>
            <label>작업 ID
              <input value={workId} inputMode="numeric" onChange={(event) => setWorkId(event.target.value)} />
            </label>
          </div>
          <div className="job-form-actions">
            <button type="submit">{busy ? '조회 중...' : '조회'}</button>
            <button className="job-secondary-button" type="button" onClick={() => {
              if (needsReload && !window.confirm('서버 반영 여부를 확인했습니까? 확인 없이 새 평가를 만들면 중복 요청이 될 수 있습니다.')) return;
              setRisk(null); setRiskId(''); setItems([blankItem(1)]); setAssessDate('');
              setDirty(false); setNeedsReload(false); setMessage(''); setError('');
            }}>새 평가 작성</button>
          </div>
        </fieldset>
      </form>

      <form className="panel job-form" onSubmit={save} onChange={() => setDirty(true)}>
        <div className="job-section-heading">
          <div><span className="job-eyebrow">{risk ? `RISK #${risk.riskAssessmentId}` : 'NEW RISK ASSESSMENT'}</span>
            <h2>{risk ? '위험성평가 수정' : '위험성평가 작성'}</h2></div>
          {risk && <span className="job-status-badge">{risk.status}</span>}
        </div>
        {risk?.approvalStatus && <p>결재 상태: {risk.approvalStatus}
          {risk.approvalId && <> · <Link to={`/approvals/${risk.approvalId}`}>결재 #{risk.approvalId} 조회</Link></>}</p>}
        <fieldset disabled={disabled || busy || locked || needsReload}>
          <div className="job-fields">
            <label>작업 ID<input required inputMode="numeric" value={workId} disabled={Boolean(risk)} onChange={(event) => setWorkId(event.target.value)} /></label>
            <label>평가일<input required type="date" max="9999-12-31" value={assessDate} onChange={(event) => setAssessDate(event.target.value)} /></label>
          </div>
          <p className="job-help">빈도×강도가 12 이상이면 HIGH, 6 이상이면 MEDIUM, 그 아래는 LOW입니다. 선택 등급이 계산 등급보다 낮으면 서버가 올려 저장합니다. 계산 등급보다 높은 선택은 유지하며, 등급은 승인이나 작업 시작 허가가 아닙니다.</p>
          {risk?.formData && <details><summary>기존 초안 근거·검토 정보 (수정 시 보존)</summary><pre className="table-scroll">{typeof risk.formData === 'string' ? risk.formData : JSON.stringify(risk.formData, null, 2)}</pre></details>}
          <h2>위험요인 및 감소대책</h2>
          <div className="job-risk-list">
            {items.map((item, index) => (
              <fieldset key={item.seq}>
                <legend>위험요인 {index + 1}</legend>
                <div className="job-fields">
                  <label>작업 단계<input required value={item.workStep} onChange={(event) => updateItem(item.seq, 'workStep', event.target.value)} /></label>
                  <label>위험요인<input required value={item.hazard} onChange={(event) => updateItem(item.seq, 'hazard', event.target.value)} /></label>
                  <label>사고 유형<select value={item.accidentType} onChange={(event) => updateItem(item.seq, 'accidentType', event.target.value)}>
                    <option value="">미지정</option>
                    {Object.entries(TAG_LABELS.ACCIDENT_TYPE).map(([code, label]) => <option key={code} value={code}>{label} ({code})</option>)}
                    {item.accidentType && !Object.hasOwn(TAG_LABELS.ACCIDENT_TYPE, item.accidentType)
                      && <option value={item.accidentType}>{item.accidentType}</option>}
                  </select></label>
                  <label>위험 등급<select value={item.riskLevel} onChange={(event) => updateItem(item.seq, 'riskLevel', event.target.value)}><option value="HIGH">높음</option><option value="MEDIUM">보통</option><option value="LOW">낮음</option></select></label>
                  <label>빈도 (1~5)<input required type="number" min="1" max="5" step="1" value={item.frequency} onChange={(event) => updateItem(item.seq, 'frequency', event.target.value)} /></label>
                  <label>강도 (1~5)<input required type="number" min="1" max="5" step="1" value={item.severity} onChange={(event) => updateItem(item.seq, 'severity', event.target.value)} /></label>
                  <label className="job-field-wide">감소대책<textarea required value={item.controls} onChange={(event) => updateItem(item.seq, 'controls', event.target.value)} /></label>
                  <label>개선 후 빈도<input type="number" min="1" max="5" step="1" value={item.residualFrequency} onChange={(event) => updateItem(item.seq, 'residualFrequency', event.target.value)} /></label>
                  <label>개선 후 강도<input type="number" min="1" max="5" step="1" value={item.residualSeverity} onChange={(event) => updateItem(item.seq, 'residualSeverity', event.target.value)} /></label>
                </div>
                <p className="job-help">참고 점수: {item.frequency && item.severity ? Number(item.frequency) * Number(item.severity) : '미입력'}</p>
                {!dirty && item.computedLevel && <p className="job-help">서버 계산 등급: {item.computedLevel} · 저장 등급: {item.riskLevel}{item.computedLevel !== item.riskLevel ? ' (작성자 상향 판단)' : ''}</p>}
                {items.length > 1 && <button className="job-secondary-button" type="button" onClick={() => {
                  setItems((current) => current.filter(({ seq }) => seq !== item.seq).map((entry, index) => ({ ...entry, seq: index + 1 })));
                  setDirty(true);
                }}>삭제</button>}
              </fieldset>
            ))}
          </div>
          <button className="job-secondary-button" type="button" onClick={() => {
            setItems((current) => [...current, blankItem(current.length + 1)]); setDirty(true);
          }}>위험요인 추가</button>
          <div className="job-form-actions">
            <span>{locked ? '작성 중인 평가만 수정할 수 있습니다.' : dirty ? '변경 내용을 저장한 뒤 승인 요청하세요.' : '수정 시 기존 초안 근거를 보존합니다.'}</span>
            <button type="submit" disabled={locked}>{busy ? '저장 중...' : '초안 저장'}</button>
            {risk?.canSubmit && <button type="button" disabled={busy || dirty} onClick={() => {
              void run(() => submitRiskAssessment(risk.riskAssessmentId, site.siteId), '승인 요청을 제출했습니다.');
            }}>승인 요청</button>}
          </div>
        </fieldset>
        {risk?.status === 'REJECTED' && <button type="button" disabled={disabled || busy || needsReload} onClick={() => {
          void run(() => reviseRiskAssessment(risk.riskAssessmentId, site.siteId), '반려된 평가를 복사해 새 작성 판을 만들었습니다.');
        }}>반려 평가 새 판 작성</button>}
      </form>
    </>
  );
}

export default function JobRiskAssessment() {
  const context = useWorkSite();
  const [params] = useSearchParams();
  return (
    <JobPageLayout title="작업 위험성평가" user={context.account?.user} contentClassName="job-management">
      <JobPageHeading title="작업 위험성평가" description="작업 단계별 위험요인과 감소대책을 작성하고 승인 요청합니다." context={context} />
      {context.currentSite && <RiskWorkspace key={`${context.currentSite.siteId}:${params}`}
        site={context.currentSite} disabled={context.selecting || context.loading}
        initialRiskId={params.get('riskId')} initialWorkId={params.get('workId')} />}
    </JobPageLayout>
  );
}
