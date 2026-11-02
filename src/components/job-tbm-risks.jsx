import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getWorkRiskAssessment } from '../api/risk-assessments';

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
  return <section aria-label="TBM 연결 작업 위험성평가">
    <h3>연결 작업의 위험요인·빈도·강도</h3>
    <p className="job-help">작업의 최신 위험성평가를 조회합니다. TBM 자체에 복사 저장하지 않으며, 승인이나 작업 시작 허가를 뜻하지 않습니다.</p>
    <button type="button" onClick={() => { setResults(null); setRevision((value) => value + 1); }}>위험성평가 새로고침</button>
    {!results ? <p role="status">위험성평가 조회 중...</p> : !results.length ? <p>연결된 작업이 없습니다.</p>
      : results.map(({ work, risk, error }) => <section key={work.workId}>
        <h4>{work.title} · 작업 #{work.workId}</h4>
        {error ? <p className="dashboard-error" role="alert">{error}</p> : <>
          <Link to={`/job/risk-assessment?riskId=${risk.riskAssessmentId}&workId=${work.workId}`}>위험성평가 #{risk.riskAssessmentId} · {risk.status}</Link>
          {risk.items.length ? <div className="table-scroll"><table>
            <thead><tr><th>작업 단계</th><th>위험요인</th><th>빈도</th><th>강도</th><th>점수</th><th>위험 등급 / 계산 등급</th><th>감소대책</th><th>개선 후 빈도 / 강도</th></tr></thead>
            <tbody>{risk.items.map((item, index) => <tr key={item.seq ?? index}>
              <td>{item.workStep}</td><td>{item.hazard}</td><td>{item.frequency}</td><td>{item.severity}</td>
              <td>{item.riskScore ?? item.frequency * item.severity}</td>
              <td>{item.riskLevel} / {item.computedLevel ?? '미제공'}</td><td>{item.controls}</td>
              <td>{item.residualFrequency ?? '미입력'} / {item.residualSeverity ?? '미입력'}</td>
            </tr>)}</tbody>
          </table></div> : <p>등록된 위험요인이 없습니다.</p>}
        </>}
      </section>)}
  </section>;
}
