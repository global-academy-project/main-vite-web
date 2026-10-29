import { useState } from 'react';
import JobDraftForm from './job-work-form';

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
      <p className="job-help">risk_assessments · risk_assessment_items 입력 연습입니다. 작업 ID·구역 ID 연결 및 저장 API는 미지원입니다. 빈도×강도 계산은 승인 또는 안전 판정이 아닙니다.</p>
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
  return <JobDraftForm title="작업 위험성평가" description="작업 단계별 위험요인과 감소대책을 작성합니다."><RiskFields /></JobDraftForm>;
}
