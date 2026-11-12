import '../../styles/safety-inspection-log-form.css';
import TbmPhotoPrint from './tbm-photo-print.jsx';

const valueOf = (log, key) => (typeof log?.[key] === 'string' ? log[key] : '');
const displayValue = (log, key) => valueOf(log, key).trim() || '해당 내용 없음';

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

export default function SafetyInspectionLogForm({ log, preview = false, tbmPhotos = [] }) {
  if (!log) return null;
  const workerFields = [
    ['성명', 'workerName'], ['생년월일', 'birthDate'], ['직위', 'position'], ['소속', 'company'],
  ];
  const workFields = [
    ['현장', 'siteName'], ['작업내용', 'workContent'], ['안전수칙', 'safetyRules'],
    ['위험요인', 'riskFactors'], ['AI 안전요약', 'aiSummary'],
  ];

  return (
    <article className={`safety-inspection-log${preview ? ' safety-inspection-log--preview' : ''}`} aria-label="공사안전 점검일지 인쇄 양식">
      <h1>공사안전 점검일지</h1>

      <section className="safety-inspection-log__section" aria-labelledby="inspection-worker-title">
          <h2 id="inspection-worker-title">■ 작업자 정보</h2>
          <table>
            <tbody>
              {Array.from({ length: Math.ceil(workerFields.length / 2) }, (_, index) => (
                <tr key={index}>
                  {workerFields.slice(index * 2, index * 2 + 2).map(([label, key]) => (
                    <InfoCell key={key} label={label} value={displayValue(log, key)} />
                  ))}
                </tr>
              ))}
              <tr><th scope="row">작업유형</th><td colSpan="3">{displayValue(log, 'workType')}</td></tr>
            </tbody>
          </table>
      </section>

      <section className="safety-inspection-log__section" aria-labelledby="inspection-health-title">
          <h2 id="inspection-health-title">■ 안전 및 건강 상태</h2>
          <table>
            <thead><tr>
              <th scope="col">건강상태</th>
              <th scope="col">특이사항</th>
            </tr></thead>
            <tbody><tr>
              <td>{displayValue(log, 'healthStatus')}</td>
              <td>{displayValue(log, 'specialNotes')}</td>
            </tr></tbody>
          </table>
      </section>

      <section className="safety-inspection-log__section" aria-labelledby="inspection-work-title">
          <h2 id="inspection-work-title">■ 작업 주요 사항</h2>
          <div className="safety-inspection-log__narrative">
            {workFields.map(([label, key]) => <MultilineCell key={key} label={label} value={displayValue(log, key)} />)}
            <div className="safety-inspection-log__narrative-row">
              <div className="safety-inspection-log__label">TBM 사진 기록</div>
              <div className="safety-inspection-log__value"><TbmPhotoPrint photos={tbmPhotos} /></div>
            </div>
          </div>
      </section>
    </article>
  );
}
