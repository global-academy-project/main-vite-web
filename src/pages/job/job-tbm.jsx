import { useEffect, useState } from 'react';
import { completeTbm, getSiteTbms, getSiteWorkers, saveTbmAttendees } from '../../api/tbm';
import { useWorkSite } from '../../api/workers';
import JobPageLayout, { JobPageHeading } from '../../components/job-page-layout';
import { JobSiteSelector } from './job-work-form';

function currentLocalDateTime() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function TbmWorkspace({ site, disabled }) {
  const [date, setDate] = useState(() => new Date().toLocaleDateString('en-CA'));
  const [records, setRecords] = useState([]);
  const [tbmId, setTbmId] = useState('');
  const [workers, setWorkers] = useState([]);
  const [attendees, setAttendees] = useState([]);
  const [attendeesSaved, setAttendeesSaved] = useState(false);
  const [attendeeCount, setAttendeeCount] = useState('0');
  const [heldAt, setHeldAt] = useState(currentLocalDateTime);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const selectedTbm = records.find((record) => String(record.tbmId) === tbmId) ?? null;
  const editable = selectedTbm?.status === 'DRAFT';

  const selectTbm = (record) => {
    setTbmId(record ? String(record.tbmId) : '');
    setAttendees(record ? record.attendees.map((person) => ({
      workerId: person.workerId, healthOk: person.healthOk,
    })) : []);
    setAttendeeCount(String(record?.attendeeCount ?? record?.attendees.length ?? 0));
    setAttendeesSaved(Boolean(record));
  };

  useEffect(() => {
    let active = true;
    getSiteWorkers(site.siteId).then((list) => {
      if (active) setWorkers(list);
    }).catch((requestError) => {
      if (active) setError(requestError.message || '현장 작업자를 불러오지 못했습니다.');
    });
    return () => { active = false; };
  }, [site.siteId]);

  const loadRecords = async (event) => {
    event?.preventDefault();
    if (busy || disabled) return;
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const list = await getSiteTbms(site.siteId, date);
      setRecords(list);
      const current = list.find((record) => String(record.tbmId) === tbmId);
      selectTbm(current ?? list[0] ?? null);
      setMessage(`${list.length}건의 TBM을 불러왔습니다.`);
    } catch (requestError) {
      setError(requestError.message || 'TBM 목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const updateRecord = (saved) => {
    setRecords((current) => current.map((record) => record.tbmId === saved.tbmId ? saved : record));
  };

  const saveAttendees = async () => {
    if (!selectedTbm || busy || disabled) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const saved = await saveTbmAttendees(selectedTbm.tbmId, {
        lockVersion: selectedTbm.lockVersion,
        attendees,
      }, site.siteId);
      updateRecord(saved);
      setAttendeesSaved(true);
      setMessage('TBM 참석자 목록을 저장했습니다.');
    } catch (requestError) {
      setError(requestError.message || 'TBM 참석자를 저장하지 못했습니다.');
    } finally {
      setBusy(false);
    }
  };

  const finishTbm = async () => {
    if (!selectedTbm || busy || disabled) return;
    if (!attendeesSaved) {
      setError('실시 완료 전에 참석자 목록을 먼저 저장하세요.');
      return;
    }
    const count = Number(attendeeCount);
    if (!heldAt || !Number.isSafeInteger(count) || count < 0) {
      setError('실시 일시와 0 이상의 정수 인원을 입력하세요.');
      return;
    }
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const saved = await completeTbm(selectedTbm.tbmId, {
        lockVersion: selectedTbm.lockVersion, heldAt, attendeeCount: count,
      }, site.siteId);
      updateRecord(saved);
      setMessage('TBM 실시를 완료했습니다. 승인 상태는 별도 절차입니다.');
    } catch (requestError) {
      setError(requestError.message || 'TBM 실시 완료 요청에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  };

  const setWorkerSelected = (workerId, checked) => {
    setAttendees((current) => {
      if (checked) return [...current, { workerId, healthOk: null }];
      return current.filter((person) => person.workerId !== workerId);
    });
    setAttendeesSaved(false);
  };

  const setHealth = (workerId, value) => {
    setAttendees((current) => current.map((person) => person.workerId === workerId
      ? { ...person, healthOk: value === '' ? null : value === 'true' } : person));
    setAttendeesSaved(false);
  };

  return (
    <>
      <p className="job-demo-notice">TBM 참석자·실시 완료와 현장 작업자 목록 API를 호출하도록 준비했습니다. 서버에 해당 경로가 배포되기 전에는 조회·저장 요청이 실패합니다.</p>
      {error && <p className="dashboard-error" role="alert">{error}</p>}
      {message && <p className="job-review-notice" role="status">{message}</p>}

      <form className="panel job-form job-lookup" onSubmit={loadRecords}>
        <span className="job-eyebrow">FIND TBM</span>
        <h2>현장 TBM 조회</h2>
        <fieldset disabled={disabled || loading || busy}>
          <div className="job-fields">
            <label>실시 날짜<input required type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>
            <label>TBM 기록<select value={tbmId} onChange={(event) => {
              const record = records.find((item) => String(item.tbmId) === event.target.value);
              selectTbm(record ?? null);
            }} required>
              <option value="" disabled>날짜를 조회해 TBM을 선택하세요</option>
              {records.map((record) => <option key={record.tbmId} value={record.tbmId}>TBM #{record.tbmId} · {record.status} · {record.leaderName || '진행자 미입력'}</option>)}
            </select></label>
          </div>
          <div className="job-form-actions"><button type="submit">{loading ? '조회 중...' : '날짜별 조회'}</button></div>
        </fieldset>
      </form>

      {selectedTbm && (
        <section className="panel job-form" aria-label="TBM 참석자 및 실시 상태">
          <div className="job-section-heading">
            <div><span className="job-eyebrow">TBM #{selectedTbm.tbmId}</span><h2>참석자 및 실시 완료</h2></div>
            <span className="job-status-badge">{selectedTbm.status}</span>
          </div>
          <p className="job-help">{selectedTbm.tbmDate} · 진행자 {selectedTbm.leaderName || '미입력'} · 연결 작업 {selectedTbm.works.map((work) => work.title).join(', ') || '없음'}</p>
          <fieldset disabled={disabled || busy || !editable}>
            <legend>현장 작업자 참석 확인</legend>
            {workers.length ? (
              <div className="job-risk-list">
                {workers.map((worker) => {
                  const attendee = attendees.find((person) => person.workerId === worker.workerId);
                  return (
                    <fieldset key={worker.workerId}>
                      <label className="job-safety-check">
                        <input type="checkbox" checked={Boolean(attendee)} onChange={(event) => setWorkerSelected(worker.workerId, event.target.checked)} />
                        {worker.name} (작업자 #{worker.workerId})
                      </label>
                      {attendee && <label>건강 상태
                        <select value={attendee.healthOk == null ? '' : String(attendee.healthOk)} onChange={(event) => setHealth(worker.workerId, event.target.value)}>
                          <option value="">확인 안 함</option><option value="true">이상 없음</option><option value="false">이상 있음</option>
                        </select>
                      </label>}
                    </fieldset>
                  );
                })}
              </div>
            ) : <p className="job-help">현장 작업자 목록을 불러오지 못했거나 등록된 작업자가 없습니다.</p>}
            <div className="job-form-actions">
              <span>{attendees.length}명 선택{attendeesSaved ? ' · 서버 저장됨' : ' · 저장되지 않음'}</span>
              <button type="button" disabled={busy || attendeesSaved} onClick={saveAttendees}>{busy ? '저장 중...' : '참석자 저장'}</button>
            </div>
          </fieldset>
          {editable && <fieldset disabled={disabled || busy}>
            <legend>실시 완료</legend>
            <div className="job-fields">
              <label>실시 일시<input required type="datetime-local" value={heldAt} onChange={(event) => setHeldAt(event.target.value)} /></label>
              <label>실제 참석 인원<input required type="number" min="0" step="1" value={attendeeCount} onChange={(event) => setAttendeeCount(event.target.value)} /></label>
            </div>
            <p className="job-help">실시 완료는 TBM을 DONE 상태로 바꾸는 동작입니다. 승인·서명 처리는 포함하지 않습니다.</p>
            <div className="job-form-actions"><button type="button" disabled={busy || !attendeesSaved} onClick={finishTbm}>{busy ? '처리 중...' : '실시 완료'}</button></div>
          </fieldset>}
          {!editable && <p className="job-help">완료 또는 승인된 TBM의 참석자와 실시 정보는 이 화면에서 수정할 수 없습니다.</p>}
        </section>
      )}
    </>
  );
}

export default function JobTbm() {
  const context = useWorkSite();
  return (
    <JobPageLayout title="TBM" user={context.account?.user} contentClassName="job-management">
      <JobPageHeading title="TBM" description="현장 TBM 기록을 조회하고 참석자와 실시 완료를 관리합니다." />
      <JobSiteSelector context={context} />
      {context.currentSite && <TbmWorkspace key={context.currentSite.siteId} site={context.currentSite} disabled={context.selecting || context.loading} />}
    </JobPageLayout>
  );
}
