import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { completeTbm, createTbm, getTbm, getSiteTbms, getSiteWorkers, saveTbmAttendees, updateTbm, reopenTbm, submitTbm } from '../../api/tbm';
import { reloadJobConflict } from '../../api/jobs';
import { useWorkSite } from '../../api/workers';
import { completeTbmBody, localDate, tbmHeldAt, tbmContentBody, tbmPermissions } from '../../utils/job-forms';
import JobPageLayout, { JobPageHeading } from '../../components/job-page-layout';
import JobReferenceSelectors from '../../components/job-reference-selectors';
import JobTbmRisks from '../../components/job-tbm-risks';

function TbmWorkspace({ site, disabled, initialTbmId, initialDate }) {
  const [date, setDate] = useState(initialDate || localDate);
  const [records, setRecords] = useState([]);
  const [tbmId, setTbmId] = useState(initialTbmId ?? '');
  const [workers, setWorkers] = useState([]);
  const [attendees, setAttendees] = useState([]);
  const [attendeesSaved, setAttendeesSaved] = useState(false);
  const [attendeeCount, setAttendeeCount] = useState('');
  const [heldAt, setHeldAt] = useState('');
  const [leaderName, setLeaderName] = useState('');
  const [workIds, setWorkIds] = useState('');
  const [points, setPoints] = useState('');
  const [healthCheck, setHealthCheck] = useState('');
  const [teamId, setTeamId] = useState('');
  const [zoneId, setZoneId] = useState('');
  const [editing, setEditing] = useState(false);
  const [contentDirty, setContentDirty] = useState(false);
  const [needsReload, setNeedsReload] = useState(false);
  const [workerRevision, setWorkerRevision] = useState(0);
  const [workerError, setWorkerError] = useState('');
  const [workersLoaded, setWorkersLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const pending = useRef(false);

  const selectedTbm = records.find((record) => String(record.tbmId) === tbmId) ?? null;
  const { editable, pending: approvalPending, canRequest } = tbmPermissions(selectedTbm);

  const selectTbm = (record) => {
    setTbmId(record ? String(record.tbmId) : '');
    setAttendees(record ? record.attendees.map((person) => ({
      workerId: person.workerId, healthOk: person.healthOk,
    })) : []);
    setAttendeeCount(record?.attendeeCount == null ? '' : String(record.attendeeCount));
    setHeldAt(record ? tbmHeldAt(record) : '');
    setAttendeesSaved(Boolean(record));
    setEditing(false); setContentDirty(false);
    setLeaderName(''); setWorkIds(''); setPoints(''); setHealthCheck(''); setTeamId(''); setZoneId('');
  };

  useEffect(() => {
    let active = true;
    getSiteWorkers(site.siteId).then((list) => {
      if (active) { setWorkers(list); setWorkerError(''); setWorkersLoaded(true); }
    }).catch((requestError) => {
      if (active) setWorkerError(requestError.message || '현장 작업자를 불러오지 못했습니다.');
    });
    return () => { active = false; };
  }, [site.siteId, workerRevision]);

  const loadRecords = async (event) => {
    event?.preventDefault();
    if (pending.current || disabled) return;
    pending.current = true;
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const list = await getSiteTbms(site.siteId, date);
      setRecords(list);
      const current = list.find((record) => String(record.tbmId) === tbmId);
      selectTbm(current ?? list[0] ?? null);
      setNeedsReload(false);
      setMessage(`${list.length}건의 TBM을 불러왔습니다.`);
    } catch (requestError) {
      setError(requestError.message || 'TBM 목록을 불러오지 못했습니다.');
    } finally {
      pending.current = false;
      setLoading(false);
    }
  };

  const updateRecord = (saved) => {
    setRecords((current) => current.map((record) => record.tbmId === saved.tbmId ? saved : record));
  };

  const showWriteError = async (requestError, fallback) => {
    if (requestError.status === 409 || requestError.code === 'WRITE_OUTCOME_UNKNOWN') setNeedsReload(true);
    setError(requestError.message || fallback);
    if (requestError.code === 'CONFLICT_MODIFIED' && selectedTbm) {
      try {
        const latest = await reloadJobConflict(requestError, () => getTbm(selectedTbm.tbmId, site.siteId));
        updateRecord(latest); selectTbm(latest); setDate(latest.tbmDate); setNeedsReload(false);
        setMessage('다른 변경과 충돌하여 최신 TBM으로 입력을 교체했습니다. 다시 내용 수정 버튼을 눌러 편집하세요. 자동 재저장하지 않았습니다.');
      } catch (reloadError) { setError(reloadError.message); }
    }
  };

  const registerTbm = async (event) => {
    event.preventDefault();
    if (pending.current || disabled || needsReload) return;
    pending.current = true;
    setBusy(true); setError(''); setMessage('');
    try {
      const saved = await createTbm(site.siteId,
        tbmContentBody({ date, leaderName, workIds, points, healthCheck, teamId, zoneId, attendees: [] }));
      setRecords((current) => [saved, ...current.filter((record) => record.tbmId !== saved.tbmId)]);
      selectTbm(saved);
      setLeaderName(''); setWorkIds(''); setPoints(''); setHealthCheck(''); setTeamId(''); setZoneId('');
      setMessage('TBM 초안을 작성했습니다. 참석자를 저장한 뒤 실시 완료하세요.');
    } catch (requestError) {
      await showWriteError(requestError, 'TBM을 작성하지 못했습니다.');
    } finally {
      pending.current = false; setBusy(false);
    }
  };

  const editContent = () => {
    if (!selectedTbm || !editable) return;
    setDate(selectedTbm.tbmDate);
    setLeaderName(selectedTbm.leaderName ?? '');
    setWorkIds(selectedTbm.works.map((work) => work.workId).join(', '));
    setPoints((selectedTbm.points ?? []).join('\n'));
    setHealthCheck(selectedTbm.healthCheck ?? '');
    setTeamId(selectedTbm.teamId == null ? '' : String(selectedTbm.teamId));
    setZoneId(selectedTbm.zoneId == null ? '' : String(selectedTbm.zoneId));
    setEditing(true); setContentDirty(false);
  };

  const saveContent = async (event) => {
    event.preventDefault();
    if (!selectedTbm || pending.current || disabled || needsReload || !editable) return;
    pending.current = true; setBusy(true); setError(''); setMessage('');
    try {
      const saved = await updateTbm(selectedTbm.tbmId,
        tbmContentBody({ date, leaderName, workIds, points, healthCheck, teamId, zoneId, attendees }, selectedTbm),
        site.siteId);
      updateRecord(saved); selectTbm(saved); setMessage('TBM 내용·연결 작업·참석자를 저장했습니다.');
    } catch (requestError) {
      await showWriteError(requestError, 'TBM 내용을 저장하지 못했습니다.');
    } finally { pending.current = false; setBusy(false); }
  };

  const changeStatus = async (action, success) => {
    if (!selectedTbm || pending.current || disabled || needsReload || !canRequest) return;
    if (!attendeesSaved || (editing && contentDirty)) { setError('미저장 내용·참석자를 먼저 저장하세요.'); return; }
    pending.current = true; setBusy(true); setError(''); setMessage('');
    try {
      const saved = await action(selectedTbm.tbmId, site.siteId);
      updateRecord(saved); selectTbm(saved); setMessage(success);
    } catch (requestError) {
      await showWriteError(requestError, 'TBM 상태 변경에 실패했습니다.');
    } finally { pending.current = false; setBusy(false); }
  };

  const saveAttendees = async () => {
    if (!selectedTbm || pending.current || disabled || needsReload || !editable || (editing && contentDirty)) return;
    pending.current = true;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const saved = await saveTbmAttendees(selectedTbm.tbmId, {
        lockVersion: selectedTbm.lockVersion,
        attendees,
      }, site.siteId);
      updateRecord(saved);
      setAttendees(saved.attendees.map(({ workerId, healthOk }) => ({ workerId, healthOk })));
      setAttendeesSaved(true);
      setMessage('TBM 참석자 목록을 저장했습니다.');
    } catch (requestError) {
      await showWriteError(requestError, 'TBM 참석자를 저장하지 못했습니다.');
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };

  const finishTbm = async () => {
    if (!selectedTbm || pending.current || disabled || needsReload || !editable || (editing && contentDirty)) return;
    if (!attendeesSaved) {
      setError('실시 완료 전에 참석자 목록을 먼저 저장하세요.');
      return;
    }
    pending.current = true;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const saved = await completeTbm(selectedTbm.tbmId,
        completeTbmBody(selectedTbm, heldAt, attendeeCount), site.siteId);
      updateRecord(saved);
      selectTbm(saved);
      setMessage('TBM 실시를 완료했습니다. 승인 상태는 별도 절차입니다.');
    } catch (requestError) {
      await showWriteError(requestError, 'TBM 실시 완료 요청에 실패했습니다.');
    } finally {
      pending.current = false;
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
      <p className="job-demo-notice">TBM 작성·참석자 저장·실시 완료는 추가 API가 배포된 서버에서 사용할 수 있습니다. 연결 작업은 같은 현장·같은 날짜여야 하며 다른 TBM과 중복 연결할 수 없습니다.</p>
      {needsReload && <p className="job-demo-notice" role="alert">저장 결과 또는 최신 버전 확인이 필요합니다. 날짜별 조회로 서버 반영 여부를 확인한 뒤 계속하세요.</p>}
      {workerError && <p className="dashboard-error" role="alert">{workerError} <button type="button" onClick={() => {
        setWorkersLoaded(false); setWorkerRevision((value) => value + 1);
      }}>작업자 다시 조회</button></p>}
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
            }}>
              <option value="" disabled>날짜를 조회해 TBM을 선택하세요</option>
              {records.map((record) => <option key={record.tbmId} value={record.tbmId}>TBM #{record.tbmId} · {record.approvalStatus === 'PENDING' ? '확인 요청 중' : record.status} · {record.leaderName || '진행자 미입력'}</option>)}
            </select></label>
          </div>
          <div className="job-form-actions"><button type="submit">{loading ? '조회 중...' : '날짜별 조회'}</button></div>
        </fieldset>
      </form>

      <form className="panel job-form" onSubmit={editing ? saveContent : registerTbm} onChange={() => setContentDirty(true)}>
        <h2>{editing ? `TBM #${selectedTbm?.tbmId} 내용 수정` : 'TBM 작성'}</h2>
        <fieldset disabled={disabled || loading || busy || needsReload || (editing && !editable)}>
          <div className="job-fields">
            <label>TBM 날짜<input required type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>
            <label>진행자<input maxLength={50} value={leaderName} onChange={(event) => setLeaderName(event.target.value)} /></label>
            <JobReferenceSelectors key={site.siteId} siteId={site.siteId} teamId={teamId} zoneId={zoneId}
              onChange={(field, value) => { if (field === 'teamId') setTeamId(value); else setZoneId(value); setContentDirty(true); }}
              disabled={disabled || busy} />
            <label>연결 작업 ID (쉼표 구분)<input value={workIds} placeholder="예: 31, 32" onChange={(event) => setWorkIds(event.target.value)} /></label>
            <label className="job-field-wide">교육 요점 (한 줄에 하나)<textarea value={points} onChange={(event) => setPoints(event.target.value)} /></label>
            <label className="job-field-wide">건강 확인 내용<textarea maxLength={500} value={healthCheck} onChange={(event) => setHealthCheck(event.target.value)} /></label>
          </div>
          <button type="submit">{editing ? 'TBM 내용·작업·참석자 저장' : 'TBM 초안 작성'}</button>
          {editing && <button type="button" onClick={() => {
            setEditing(false); setContentDirty(false); setLeaderName(''); setWorkIds('');
            setPoints(''); setHealthCheck(''); setTeamId(''); setZoneId('');
          }}>수정 취소 / 새 TBM 작성</button>}
          {editing && <p className="job-help">수정은 내용·작업·참석자를 통째로 바꿉니다. 팀·구역은 조회한 값으로 채워집니다.</p>}
        </fieldset>
      </form>

      {selectedTbm && (
        <section className="panel job-form" aria-label="TBM 참석자 및 실시 상태">
          <div className="job-section-heading">
            <div><span className="job-eyebrow">TBM #{selectedTbm.tbmId}</span><h2>참석자 및 실시 완료</h2></div>
            <span className="job-status-badge">{approvalPending ? '확인 요청 중' : selectedTbm.status}</span>
          </div>
          <p className="job-help">{selectedTbm.tbmDate} · 진행자 {selectedTbm.leaderName || '미입력'} · 연결 작업 {selectedTbm.works.map((work) => work.title).join(', ') || '없음'}</p>
          <p>팀: {selectedTbm.teamName ?? (selectedTbm.teamId == null ? '미지정' : `#${selectedTbm.teamId}`)}
            {' · '}구역: {selectedTbm.zoneName ?? (selectedTbm.zoneId == null ? '미지정' : `#${selectedTbm.zoneId}`)}</p>
          {selectedTbm.approvalStatus && <p>결재 상태: {selectedTbm.approvalStatus}
            {selectedTbm.approvalId && <> · <Link to={`/approvals/${selectedTbm.approvalId}`}>결재 #{selectedTbm.approvalId} 조회</Link></>}</p>}
          {approvalPending && <p role="status">확인 요청 중입니다. 수정·참석자 저장·실시 완료·되돌리기를 할 수 없습니다.</p>}
          {selectedTbm.points?.length > 0 && <section><h3>교육 요점</h3><ul>{selectedTbm.points.map((point, index) => <li key={index}>{point}</li>)}</ul></section>}
          {selectedTbm.healthCheck && <p>건강 확인: {selectedTbm.healthCheck}</p>}
          <JobTbmRisks key={`${selectedTbm.tbmId}:${selectedTbm.lockVersion}`} tbm={selectedTbm} siteId={site.siteId} />
          {editable && <button type="button" disabled={disabled || busy || needsReload} onClick={editContent}>TBM 내용 수정</button>}
          <fieldset disabled={disabled || loading || busy || !editable || needsReload || !workersLoaded || Boolean(workerError)}>
            <legend>현장 작업자 참석 확인</legend>
            {!workersLoaded && !workerError ? <p role="status">현장 작업자를 불러오는 중입니다...</p> : workers.length ? (
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
            ) : <p className="job-help">현장 작업자가 없습니다. 작업자 등록·배치 상태를 확인하세요.</p>}
            {attendees.filter((person) => !workers.some((worker) => worker.workerId === person.workerId)).map((person) => (
              <p key={person.workerId}>기존 참석자 #{person.workerId} · 현재 배치 목록에 없음
                <button type="button" onClick={() => setWorkerSelected(person.workerId, false)}>참석자에서 제외</button>
              </p>
            ))}
            <div className="job-form-actions">
              <span>{attendees.length}명 선택{attendeesSaved ? ' · 서버 저장됨' : ' · 저장되지 않음'}</span>
              <button type="button" disabled={busy || attendeesSaved || (editing && contentDirty)} onClick={saveAttendees}>{busy ? '저장 중...' : '참석자 저장'}</button>
            </div>
          </fieldset>
          {editable && <fieldset disabled={disabled || loading || busy || needsReload}>
            <legend>실시 완료</legend>
            <div className="job-fields">
              <label>실시 일시<input required type="datetime-local" step="any" min={`${selectedTbm.tbmDate}T00:00`} max={`${selectedTbm.tbmDate}T23:59:59`} value={heldAt} onChange={(event) => setHeldAt(event.target.value)} /></label>
              <label>실제 참석 인원<input type="number" min="0" step="1" placeholder={`미입력 시 등록 참석자 ${attendees.length}명`} value={attendeeCount} onChange={(event) => setAttendeeCount(event.target.value)} /></label>
            </div>
            <p className="job-help">실시 일시는 TBM 날짜와 같아야 합니다. 실제 참석 인원은 등록 참석자 수와 달라도 되며, 비우면 서버가 등록 참석자 수를 사용합니다. 실시 완료는 DONE 상태이며 승인·서명은 별도입니다.</p>
            <div className="job-form-actions"><button type="button" disabled={busy || !attendeesSaved || (editing && contentDirty)} onClick={finishTbm}>{busy ? '처리 중...' : '실시 완료'}</button></div>
          </fieldset>}
          {!editable && <p className="job-help">완료 또는 승인된 TBM의 참석자와 실시 정보는 이 화면에서 수정할 수 없습니다.</p>}
          {selectedTbm.status === 'DONE' && <div className="job-form-actions">
            <button type="button" disabled={disabled || busy || loading || needsReload || !canRequest} onClick={() => {
              void changeStatus(submitTbm, 'TBM 확인 요청을 제출했습니다. 승인함에서 확인하며, 승인 완료를 뜻하지 않습니다.');
            }}>TBM 확인 요청</button>
            <button type="button" disabled={disabled || busy || loading || needsReload || !canRequest} onClick={() => {
              void changeStatus(reopenTbm, 'TBM을 작성 중으로 되돌렸습니다.');
            }}>실시 완료 되돌리기</button>
            <p className="job-help">확인 요청 중인 TBM은 서버가 재개·수정을 거부합니다. 반려되면 작성 중으로 돌아갑니다.</p>
          </div>}
        </section>
      )}
    </>
  );
}

export default function JobTbm() {
  const context = useWorkSite();
  const [params] = useSearchParams();
  return (
    <JobPageLayout title="TBM" user={context.account?.user} contentClassName="job-management">
      <JobPageHeading title="TBM" description="현장 TBM 기록을 조회하고 참석자와 실시 완료를 관리합니다." context={context} />
      {context.currentSite && <TbmWorkspace key={`${context.currentSite.siteId}:${params}`} site={context.currentSite}
        disabled={context.selecting || context.loading} initialTbmId={params.get('tbmId')} initialDate={params.get('date')} />}
    </JobPageLayout>
  );
}
