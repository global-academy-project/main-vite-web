import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getWorkRiskAssessment } from '../api/risk-assessments';
import { Badge } from './home/panel.jsx';
import Icon from './ui/icon.jsx';
import { Skeleton } from './ui/status-view.jsx';
import { RISK_STATUS_LABELS, toneOf } from '../utils/home-model.js';
import { RISK_LEVEL_TEXT, RISK_LEVEL_TONES } from '../utils/risk-model.js';

/** TBM 연결 작업의 최신 위험성평가 (읽기만, TBM 에 복사해 저장하지 않는다). 조회 규칙은 기존과 같다 */
export default function JobTbmRisks({ tbm, siteId }) {
  const [results, setResults] = useState(null);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    Promise.all(tbm.works.map(async (work) => {
      try {
        return { work, risk: await getWorkRiskAssessment(work.workId, siteId) };
      } catch (error) {
        return { work, error: error.message || '위험성평가를 불러오지 못했습니다.' };
      }
    })).then((entries) => { if (active) setResults(entries); });
    return () => { active = false; };
  }, [tbm, siteId, revision]);

  return (
    <section className="home-panel tbm-card tbm-risks" aria-label="TBM 연결 작업 위험성평가">
      <header className="tbm-card__head">
        <div>
          <h2>연결 작업 위험요인</h2>
          <p className="rec-help">작업의 최신 위험성평가를 그대로 보여 줍니다. TBM에 복사해 저장하지 않으며, 승인이나 작업 시작 허가가 아닙니다.</p>
        </div>
        <div className="tbm-card__actions">
          <button type="button" className="ui-btn ui-btn--ghost" onClick={() => { setResults(null); setRevision((value) => value + 1); }}><Icon name="refresh" size={16} />새로고침</button>
        </div>
      </header>
      <div className="tbm-risks__body">
        {!results ? <Skeleton lines={3} /> : !results.length ? <p className="rec-help">연결된 작업이 없습니다.</p>
          : results.map(({ work, risk, error }) => (
            <div key={work.workId} className="tbm-risks__work">
              <div className="tbm-risks__title">
                <strong>{work.title}</strong><span className="work-table__id">#{work.workId}</span>
                {risk && <Link className="permit-chip" to={`/job/risk-assessment?riskId=${risk.riskAssessmentId}&workId=${work.workId}`}>위험성평가 #{risk.riskAssessmentId}<Badge tone={toneOf(risk.status)}>{RISK_STATUS_LABELS[risk.status] ?? risk.status}</Badge></Link>}
              </div>
              {error ? <p className="work-form__error" role="alert"><Icon name="alert" size={16} />{error}</p>
                : risk.items.length ? (
                  <table className="home-table tbm-risks__table">
                    <thead><tr><th scope="col">작업 단계</th><th scope="col">위험요인</th><th scope="col">빈도×강도</th><th scope="col">등급</th><th scope="col">감소대책</th><th scope="col">개선 후</th></tr></thead>
                    <tbody>{risk.items.map((item, index) => (
                      <tr key={item.seq ?? index}>
                        <td data-label="작업 단계">{item.workStep}</td>
                        <td data-label="위험요인">{item.hazard}</td>
                        <td data-label="빈도×강도">{item.frequency}×{item.severity} = <strong>{item.riskScore ?? item.frequency * item.severity}</strong></td>
                        <td data-label="등급"><Badge tone={RISK_LEVEL_TONES[item.riskLevel] ?? 'neutral'}>{RISK_LEVEL_TEXT[item.riskLevel] ?? item.riskLevel}</Badge>{item.computedLevel && item.computedLevel !== item.riskLevel && <span className="rec-help"> 계산 {RISK_LEVEL_TEXT[item.computedLevel] ?? item.computedLevel}</span>}</td>
                        <td data-label="감소대책" className="tbm-risks__controls">{item.controls}</td>
                        <td data-label="개선 후">{item.residualFrequency != null ? `${item.residualFrequency}×${item.residualSeverity}` : '미입력'}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                ) : <p className="rec-help">등록된 위험요인이 없습니다.</p>}
            </div>
          ))}
      </div>
    </section>
  );
}
