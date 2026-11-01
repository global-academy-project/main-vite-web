import { useState } from 'react';
import {
  createRiskAssessment, getRiskAssessment, getWorkRiskAssessment, submitRiskAssessment,
  updateRiskAssessment,
} from '../../api/risk-assessments';
import { jobId } from '../../api/jobs';
import { useWorkSite } from '../../api/workers';
import JobPageLayout, { JobPageHeading } from '../../components/job-page-layout';
import { JobSiteSelector } from './job-work-form';

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
    controls: item.controls ?? '',
    residualFrequency: item.residualFrequency == null ? '' : String(item.residualFrequency),
    residualSeverity: item.residualSeverity == null ? '' : String(item.residualSeverity),
  };
}

function savedItems(items) {
  if (!items.length) throw new Error('위험요인을 하나 이상 입력하세요.');
  return items.map((item, index) => {
    const frequency = Number(item.frequency);
    const severity = Number(item.severity);
    const residualFrequency = item.residualFrequency === '' ? null : Number(item.residualFrequency);
    const residualSeverity = item.residualSeverity === '' ? null : Number(item.residualSeverity);
    if (!item.workStep.trim() || !item.hazard.trim() || !item.controls.trim()) {
      throw new Error(`${index + 1}번 위험요인의 작업 단계·위험요인·감소대책을 입력하세요.`);
    }
    if (![frequency, severity].every((value) => Number.isInteger(value) && value >= 1 && value <= 5)) {
      throw new Error(`${index + 1}번 위험요인의 빈도와 강도는 1~5 정수여야 합니다.`);
    }
    if ((residualFrequency == null) !== (residualSeverity == null)
      || (residualFrequency != null
        && ![residualFrequency, residualSeverity].every((value) => Number.isInteger(value) && value >= 1 && value <= 5))) {
      throw new Error(`${index + 1}번 개선 후 빈도와 강도는 둘 다 1~5로 입력하거나 둘 다 비워 두세요.`);
    }
    return {
      seq: index + 1,
      workStep: item.workStep.trim(),
      hazard: item.hazard.trim(),
      accidentType: item.accidentType || null,
      frequency,
      severity,
      riskLevel: item.riskLevel,
      controls: item.controls.trim(),
      residualFrequency,
      residualSeverity,
    };
  });
}

function RiskWorkspace({ site, disabled }) {
  const [risk, setRisk] = useState(null);
  const [riskId, setRiskId] = useState('');
  const [workId, setWorkId] = useState('');
  const [assessDate, setAssessDate] = useState('');
  const [items, setItems] = useState([blankItem(1)]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const locked = Boolean(risk && risk.status !== 'DRAFT');

  const run = async (action, success) => {
    if (busy || disabled) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const saved = await action();
      if (saved) {
        setRisk(saved);
        setRiskId(String(saved.riskAssessmentId));
        setWorkId(String(saved.workId));
        setAssessDate(saved.assessDate);
        setItems(saved.items.length ? saved.items.map(itemForForm) : [blankItem(1)]);
      }
      setMessage(success);
    } catch (requestError) {
      setError(requestError.message || '위험성평가 요청에 실패했습니다.');
    } finally {
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
    void run(() => {
      if (!assessDate) throw new Error('평가일을 입력하세요.');
      const payload = {
        assessDate,
        formData: JSON.stringify({ source: 'WEB' }),
        items: savedItems(items),
      };
      return risk
        ? updateRiskAssessment(risk.riskAssessmentId, { ...payload, lockVersion: risk.lockVersion }, site.siteId)
        : createRiskAssessment({
          ...payload, siteId: site.siteId, workId: jobId(workId), assessmentType: 'DAILY',
        }, site.siteId);
    }, risk ? '위험성평가 변경 사항을 저장했습니다.' : '위험성평가 초안을 저장했습니다.');
  };

  const updateItem = (seq, field, value) => {
    setItems((current) => current.map((item) => item.seq === seq ? { ...item, [field]: value } : item));
  };

  return (
    <>
      <p className="job-demo-notice">이 화면은 위험성평가 작성·수정 API를 호출하도록 준비했습니다. 서버에 해당 경로가 배포되기 전에는 저장 요청이 실패합니다.</p>
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
              setRisk(null); setRiskId(''); setItems([blankItem(1)]); setMessage(''); setError('');
            }}>새 평가 작성</button>
          </div>
        </fieldset>
      </form>

      <form className="panel job-form" onSubmit={save}>
        <div className="job-section-heading">
          <div><span className="job-eyebrow">{risk ? `RISK #${risk.riskAssessmentId}` : 'NEW RISK ASSESSMENT'}</span>
            <h2>{risk ? '위험성평가 수정' : '위험성평가 작성'}</h2></div>
          {risk && <span className="job-status-badge">{risk.status}</span>}
        </div>
        <fieldset disabled={disabled || busy || locked}>
          <div className="job-fields">
            <label>작업 ID<input required inputMode="numeric" value={workId} disabled={Boolean(risk)} onChange={(event) => setWorkId(event.target.value)} /></label>
            <label>평가일<input required type="date" value={assessDate} onChange={(event) => setAssessDate(event.target.value)} /></label>
          </div>
          <p className="job-help">작업 단위 일일 위험성평가로 저장합니다. 위험 등급은 작성자가 선택하며 빈도×강도 계산은 승인이나 안전 판정이 아닙니다.</p>
          <h2>위험요인 및 감소대책</h2>
          <div className="job-risk-list">
            {items.map((item, index) => (
              <fieldset key={item.seq}>
                <legend>위험요인 {index + 1}</legend>
                <div className="job-fields">
                  <label>작업 단계<input required value={item.workStep} onChange={(event) => updateItem(item.seq, 'workStep', event.target.value)} /></label>
                  <label>위험요인<input required value={item.hazard} onChange={(event) => updateItem(item.seq, 'hazard', event.target.value)} /></label>
                  <label>사고 유형 코드<input value={item.accidentType} onChange={(event) => updateItem(item.seq, 'accidentType', event.target.value)} placeholder="예: FIRE" /></label>
                  <label>위험 등급<select value={item.riskLevel} onChange={(event) => updateItem(item.seq, 'riskLevel', event.target.value)}><option value="HIGH">높음</option><option value="MEDIUM">보통</option><option value="LOW">낮음</option></select></label>
                  <label>빈도 (1~5)<input required type="number" min="1" max="5" step="1" value={item.frequency} onChange={(event) => updateItem(item.seq, 'frequency', event.target.value)} /></label>
                  <label>강도 (1~5)<input required type="number" min="1" max="5" step="1" value={item.severity} onChange={(event) => updateItem(item.seq, 'severity', event.target.value)} /></label>
                  <label className="job-field-wide">감소대책<textarea required value={item.controls} onChange={(event) => updateItem(item.seq, 'controls', event.target.value)} /></label>
                  <label>개선 후 빈도<input type="number" min="1" max="5" step="1" value={item.residualFrequency} onChange={(event) => updateItem(item.seq, 'residualFrequency', event.target.value)} /></label>
                  <label>개선 후 강도<input type="number" min="1" max="5" step="1" value={item.residualSeverity} onChange={(event) => updateItem(item.seq, 'residualSeverity', event.target.value)} /></label>
                </div>
                <p className="job-help">참고 점수: {item.frequency && item.severity ? Number(item.frequency) * Number(item.severity) : '미입력'}</p>
                {items.length > 1 && <button className="job-secondary-button" type="button" onClick={() => setItems((current) => current.filter(({ seq }) => seq !== item.seq).map((entry, index) => ({ ...entry, seq: index + 1 })))}>삭제</button>}
              </fieldset>
            ))}
          </div>
          <button className="job-secondary-button" type="button" onClick={() => setItems((current) => [...current, blankItem(current.length + 1)])}>위험요인 추가</button>
          <div className="job-form-actions">
            <span>{locked ? '제출된 평가는 수정할 수 없습니다.' : '서버 API 미배포 시 저장할 수 없습니다.'}</span>
            <button type="submit" disabled={locked}>{busy ? '저장 중...' : '초안 저장'}</button>
            {risk?.canSubmit && <button type="button" disabled={busy} onClick={() => {
              void run(() => submitRiskAssessment(risk.riskAssessmentId, site.siteId), '승인 요청을 제출했습니다.');
            }}>승인 요청</button>}
          </div>
        </fieldset>
      </form>
    </>
  );
}

export default function JobRiskAssessment() {
  const context = useWorkSite();
  return (
    <JobPageLayout title="작업 위험성평가" user={context.account?.user} contentClassName="job-management">
      <JobPageHeading title="작업 위험성평가" description="작업 단계별 위험요인과 감소대책을 작성하고 승인 요청합니다." />
      <JobSiteSelector context={context} />
      {context.currentSite && <RiskWorkspace key={context.currentSite.siteId} site={context.currentSite} disabled={context.selecting || context.loading} />}
    </JobPageLayout>
  );
}
