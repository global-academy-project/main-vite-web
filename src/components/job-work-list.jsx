import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getSiteWorks } from '../api/jobs';
import { workTypes } from '../api/workers';
import { localDate } from '../utils/job-forms';

export default function JobWorkList({ siteId, disabled, revision = 0 }) {
  const [from, setFrom] = useState(localDate);
  const [to, setTo] = useState(localDate);
  const [range, setRange] = useState(() => ({ from: localDate(), to: localDate() }));
  const [refresh, setRefresh] = useState(0);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const key = `${siteId}:${range.from}:${range.to}:${refresh}:${revision}`;

  useEffect(() => {
    let active = true;
    getSiteWorks(siteId, range.from, range.to).then((works) => {
      if (active) setResult({ key, works });
    }).catch((requestError) => {
      if (active) setResult({ key, error: requestError.message || '작업 목록을 불러오지 못했습니다.' });
    });
    return () => { active = false; };
  }, [siteId, range, key]);

  const loaded = result?.key === key;
  return (
    <section className="panel job-form" aria-label="현장 작업 목록">
      <h2>현장 작업 목록</h2>
      <form onSubmit={(event) => {
        event.preventDefault();
        if (!from || !to || from > to) {
          setError('시작일과 종료일을 확인하세요. 종료일은 시작일 이후여야 합니다.');
          return;
        }
        setError(''); setRange({ from, to }); setRefresh((value) => value + 1);
      }}>
        <fieldset disabled={disabled}>
          <div className="job-fields">
            <label>시작일<input required type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label>
            <label>종료일<input required type="date" value={to} onChange={(event) => setTo(event.target.value)} /></label>
          </div>
          <button type="submit">작업 목록 조회 / 새로고침</button>
        </fieldset>
      </form>
      {error && <p className="dashboard-error" role="alert">{error}</p>}
      {!loaded ? <p role="status">작업 목록을 불러오는 중입니다...</p>
        : result.error ? <p className="dashboard-error" role="alert">{result.error}</p>
          : result.works.length ? <div className="table-scroll"><table>
            <thead><tr><th>작업</th><th>작업일 / 유형</th><th>인원 / 상태</th><th>허가서</th><th>위험성평가</th><th>TBM</th></tr></thead>
            <tbody>{result.works.map((work) => <tr key={work.workId}>
              <td><Link to={`/job/workspace?workId=${work.workId}`}>#{work.workId} {work.title}</Link></td>
              <td>{work.workDate} · {workTypes[work.workType] ?? work.workType}<p>구역: {work.zoneId == null ? '미지정' : `#${work.zoneId}`}</p></td>
              <td>{work.workerCount ?? '미지정'} · {work.status}</td>
              <td>{work.permits.length ? work.permits.map((permit) => <p key={permit.permitId}>
                <Link to={`/job/permits?permitId=${permit.permitId}&workId=${work.workId}`}>{permit.permitNo} · {permit.status}</Link>
              </p>) : <Link to={`/job/permits?workId=${work.workId}`}>허가서 작성</Link>}</td>
              <td><Link to={`/job/risk-assessment?workId=${work.workId}${work.riskAssessment ? `&riskId=${work.riskAssessment.riskAssessmentId}` : ''}`}>
                {work.riskAssessment ? `#${work.riskAssessment.riskAssessmentId} · ${work.riskAssessment.status}` : '평가 작성'}
              </Link></td>
              <td>{work.tbm ? <Link to={`/job/tbm?tbmId=${work.tbm.tbmId}&date=${encodeURIComponent(work.tbm.tbmDate)}`}>
                #{work.tbm.tbmId} · {work.tbm.status}
              </Link> : <Link to={`/job/tbm?date=${encodeURIComponent(work.workDate)}`}>TBM 작성</Link>}</td>
            </tr>)}</tbody>
          </table></div> : <p className="job-help">해당 기간의 작업이 없습니다.</p>}
      <p className="job-help">문서 링크로 이동한 뒤 조회 버튼을 눌러 최신 내용을 확인하세요.</p>
    </section>
  );
}
