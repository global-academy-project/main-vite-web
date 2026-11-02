import { useEffect, useRef, useState } from 'react';
import { acknowledgeWarning, getWork, getWorkWarnings } from '../api/incidents';
import { requireWork } from '../api/jobs';
import '../style/job/job-incidents.css';

export default function WorkIncidentWarnings({ siteId, initialWorkId, disabled = false }) {
  const [workId, setWorkId] = useState('');
  const [warnings, setWarnings] = useState(null);
  const [notes, setNotes] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(initialWorkId != null && initialWorkId !== '');
  const [writeUncertain, setWriteUncertain] = useState(false);
  const pending = useRef(false);
  const mounted = useRef(false);
  const revision = useRef(0);
  const selectedWorkId = initialWorkId ?? workId;
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    if (initialWorkId == null || initialWorkId === '') return undefined;
    let active = true;
    const version = ++revision.current;
    (async () => {
      try {
        const work = requireWork(await getWork(initialWorkId), siteId);
        const result = await getWorkWarnings(work.workId);
        if (active && version === revision.current) setWarnings(result);
      } catch (requestError) {
        if (active && version === revision.current) setError(requestError.message);
      } finally {
        if (active && version === revision.current) setBusy(false);
      }
    })();
    return () => { active = false; };
  }, [initialWorkId, siteId]);

  const run = async (action) => {
    if (pending.current) return;
    pending.current = true;
    const version = revision.current;
    setBusy(true);
    setError('');
    try {
      const result = await action();
      if (mounted.current && version === revision.current) {
        setWarnings(result);
        setWriteUncertain(false);
      }
    } catch (requestError) {
      if (mounted.current && version === revision.current) {
        setError(requestError.message);
        if (requestError.code === 'WRITE_OUTCOME_UNKNOWN') setWriteUncertain(true);
      }
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
  };
  const load = () => run(async () => {
    const work = requireWork(await getWork(selectedWorkId), siteId);
    return getWorkWarnings(work.workId);
  });
  return (
    <section className="panel job-example" aria-label="작업별 아차사고 경고">
      <h2>작업별 아차사고 경고</h2>
      <p className="job-help">아차사고 보고 또는 작업 등록 시 서버가 자동으로 생성한 경고를 조회합니다. 경고 확인은 안전 승인이나 작업 허가가 아닙니다.</p>
      <fieldset disabled={disabled || busy || writeUncertain}>
        {initialWorkId != null ? <p>작업 ID: #{initialWorkId}</p> : <label className="incident-cas-input">작업 ID
          <input value={workId} inputMode="numeric" onChange={(event) => {
            revision.current += 1;
            setWorkId(event.target.value);
            setWarnings(null);
            setError('');
          }} />
        </label>}
        <button type="button" className="job-history-refresh" disabled={!selectedWorkId} onClick={() => load()}>경고 다시 조회</button>
        {warnings?.length === 0 && <p>연결된 경고가 없습니다.</p>}
        {warnings?.map((warning) => (
          <article className={`incident-evidence${warning.severity === 'CRITICAL' ? ' incident-warning-critical' : ''}`} key={warning.warningId}>
            <strong>{warning.severity} · {warning.message}</strong>
            {warning.nearMissId && <p><a href={`/job/incidents?incidentId=${warning.nearMissId}`}>원본 아차사고 #{warning.nearMissId}</a></p>}
            {warning.acknowledgedAt ? (
              <p>확인자 {warning.acknowledgedByName || `#${warning.acknowledgedBy}`} · {warning.acknowledgedAt} · {warning.ackNote}</p>
            ) : (
              <>
                <label className="incident-cas-input">확인 및 조치 내용{warning.severity === 'CRITICAL' ? ' (필수)' : ' (선택)'}
                  <input maxLength={300} value={notes[warning.warningId] ?? ''}
                    onChange={(event) => setNotes((current) => ({ ...current, [warning.warningId]: event.target.value }))} />
                </label>
                <button type="button" className="job-history-refresh"
                  disabled={warning.severity === 'CRITICAL' && !notes[warning.warningId]?.trim()}
                  onClick={() => run(async () => {
                    await acknowledgeWarning(warning.warningId, notes[warning.warningId]?.trim() || undefined);
                    setNotes((current) => ({ ...current, [warning.warningId]: '' }));
                    return getWorkWarnings(selectedWorkId);
                  })}>경고 확인</button>
              </>
            )}
          </article>
        ))}
      </fieldset>
      {writeUncertain && <p role="alert" className="job-demo-notice">
        확인 결과가 불확실합니다. 중복 확인을 막았습니다. 최신 경고를 다시 조회해 반영 여부를 확인하세요.
        <button type="button" disabled={busy || disabled} onClick={() => load()}>최신 경고 재조회</button>
      </p>}
      {busy && <p role="status">경고 정보를 처리하는 중입니다...</p>}
      {error && <p role="alert" className="dashboard-error">{error}</p>}
    </section>
  );
}
