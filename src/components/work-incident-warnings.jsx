import { useEffect, useRef, useState } from 'react';
import { acknowledgeWarning, getWork, getWorkWarnings, syncWorkWarnings } from '../api/incidents';
import '../style/job/job-incidents.css';

export default function WorkIncidentWarnings({ siteId, disabled = false }) {
  const [workId, setWorkId] = useState('');
  const [warnings, setWarnings] = useState(null);
  const [notes, setNotes] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const mounted = useRef(false);
  const revision = useRef(0);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const run = async (action) => {
    if (pending.current) return;
    pending.current = true;
    const version = revision.current;
    setBusy(true);
    setError('');
    try {
      const result = await action();
      if (mounted.current && version === revision.current) setWarnings(result);
    } catch (requestError) {
      if (mounted.current && version === revision.current) setError(requestError.message);
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
  };
  const load = (sync) => run(async () => {
    if (!/^[1-9]\d*$/.test(workId) || !Number.isSafeInteger(Number(workId))) throw new Error('유효한 작업 ID를 입력하세요.');
    const work = await getWork(workId);
    if (String(work.siteId) !== String(siteId)) throw new Error('선택한 현장의 작업 ID를 입력하세요.');
    return sync ? syncWorkWarnings(workId) : getWorkWarnings(workId);
  });
  return (
    <section className="panel job-example" aria-label="작업별 아차사고 경고">
      <h2>작업별 아차사고 경고</h2>
      <p className="job-help">구역이 연결된 작업 ID로 같은 구역의 보고를 경고에 연결합니다. 확인은 안전 승인이나 작업 허가가 아닙니다.</p>
      <fieldset disabled={disabled || busy}>
        <label className="incident-cas-input">작업 ID
          <input value={workId} inputMode="numeric" onChange={(event) => {
            revision.current += 1;
            setWorkId(event.target.value);
            setWarnings(null);
            setError('');
          }} />
        </label>
        <button type="button" className="job-history-refresh" onClick={() => load(false)}>경고 조회</button>
        <button type="button" className="job-history-refresh" onClick={() => load(true)}>같은 구역 보고를 경고로 연결</button>
        {warnings?.length === 0 && <p>연결된 경고가 없습니다.</p>}
        {warnings?.map((warning) => (
          <article className="incident-evidence" key={warning.warningId}>
            <strong>{warning.severity} · {warning.message}</strong>
            {warning.nearMissId && <p><a href={`/job/incidents?incidentId=${warning.nearMissId}`}>원본 아차사고 #{warning.nearMissId}</a></p>}
            {warning.acknowledgedAt ? (
              <p>확인자 #{warning.acknowledgedBy} · {warning.acknowledgedAt} · {warning.ackNote}</p>
            ) : (
              <>
                <label className="incident-cas-input">확인 및 조치 내용
                  <input maxLength={300} value={notes[warning.warningId] ?? ''}
                    onChange={(event) => setNotes({ ...notes, [warning.warningId]: event.target.value })} />
                </label>
                <button type="button" className="job-history-refresh"
                  disabled={!notes[warning.warningId]?.trim()}
                  onClick={() => run(async () => {
                    await acknowledgeWarning(warning.warningId, notes[warning.warningId].trim());
                    return getWorkWarnings(workId);
                  })}>조치 내용과 함께 확인</button>
              </>
            )}
          </article>
        ))}
      </fieldset>
      {busy && <p role="status">경고 정보를 처리하는 중입니다...</p>}
      {error && <p role="alert" className="dashboard-error">{error}</p>}
    </section>
  );
}
