import './safety-inspection-log-form.css';

const valueOf = (log, key) => (typeof log?.[key] === 'string' ? log[key] : '');

function InfoCell({ label, value }) {
  return (
    <>
      <th scope="row">{label}</th>
      <td>{value}</td>
    </>
  );
}

function MultilineCell({ label, value }) {
  return (
    <div className="safety-inspection-log__narrative-row">
      <div className="safety-inspection-log__label">{label}</div>
      <div className="safety-inspection-log__value">{value}</div>
    </div>
  );
}

export default function SafetyInspectionLogForm({ log, preview = false }) {
  if (!log) return null;

  return (
    <article className={`safety-inspection-log${preview ? ' safety-inspection-log--preview' : ''}`} aria-label="공사안전 점검일지 인쇄 양식">
      <h1>공사안전 점검일지</h1>

      <section className="safety-inspection-log__section" aria-labelledby="inspection-worker-title">
        <h2 id="inspection-worker-title">■ 작업자 정보</h2>
        <table>
          <tbody>
            <tr>
              <InfoCell label="성명" value={valueOf(log, 'workerName')} />
              <InfoCell label="생년월일" value={valueOf(log, 'birthDate')} />
            </tr>
            <tr>
              <InfoCell label="직위" value={valueOf(log, 'position')} />
              <InfoCell label="소속" value={valueOf(log, 'company')} />
            </tr>
            <tr>
              <th scope="row">작업유형</th>
              <td colSpan="3">{valueOf(log, 'workType')}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="safety-inspection-log__section" aria-labelledby="inspection-health-title">
        <h2 id="inspection-health-title">■ 안전 및 건강 상태</h2>
        <table>
          <thead>
            <tr>
              <th scope="col">건강상태</th>
              <th scope="col">특이사항</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>{valueOf(log, 'healthStatus')}</td>
              <td>{valueOf(log, 'specialNotes')}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="safety-inspection-log__section" aria-labelledby="inspection-work-title">
        <h2 id="inspection-work-title">■ 작업 주요 사항</h2>
        <div className="safety-inspection-log__narrative">
          <MultilineCell label="현장" value={valueOf(log, 'siteName')} />
          <MultilineCell label="작업내용" value={valueOf(log, 'workContent')} />
          <MultilineCell label="안전수칙" value={valueOf(log, 'safetyRules')} />
          <MultilineCell label="위험요인" value={valueOf(log, 'riskFactors')} />
          <MultilineCell label="AI 안전요약" value={valueOf(log, 'aiSummary')} />
        </div>
      </section>
    </article>
  );
}
