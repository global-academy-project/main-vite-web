import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getWorkTbm } from '../../api/jobs';
import JobDraftForm from './job-work-form';

function TbmLookup({ context, initialWorkId }) {
  const [workId, setWorkId] = useState(initialWorkId ?? '');
  const [request, setRequest] = useState(initialWorkId ?? '');
  const [lookupVersion, setLookupVersion] = useState(0);
  const [result, setResult] = useState(null);
  const siteId = context.currentSite?.siteId;
  const requestKey = `${siteId}:${request}:${lookupVersion}`;
  const loaded = result?.key === requestKey;
  const tbm = loaded ? result.tbm : null;
  const loading = Boolean(request && siteId && !loaded);
  const error = loaded ? result.error : '';

  useEffect(() => {
    if (!request || !siteId) return undefined;
    let cancelled = false;
    getWorkTbm(request).then((saved) => {
      if (saved.siteId !== siteId) {
        throw new Error('선택한 현장의 TBM이 아닙니다.');
      }
      if (!cancelled) setResult({ key: requestKey, tbm: saved, error: '' });
    }).catch((requestError) => {
      if (!cancelled) setResult({
        key: requestKey, tbm: null, error: requestError.message || 'TBM을 불러오지 못했습니다.',
      });
    });
    return () => { cancelled = true; };
  }, [request, lookupVersion, siteId, requestKey]);

  const lookup = () => {
    setRequest(workId.trim());
    setLookupVersion((value) => value + 1);
  };
  return (
    <section className="panel job-example" aria-label="저장된 TBM 조회">
      <h2>작업별 TBM 조회</h2>
      <p className="job-help">작업 목록의 TBM 버튼을 누르거나 작업 ID를 입력해 연결된 최신 TBM을 조회합니다.</p>
      <div className="job-lookup-wide">
        <fieldset>
          <label>작업 ID<input inputMode="numeric" value={workId}
            onChange={(event) => setWorkId(event.target.value)} /></label>
          <button type="button" disabled={!context.currentSite || !workId.trim()}
            onClick={lookup}>TBM 조회</button>
        </fieldset>
      </div>
      {loading && <p role="status">TBM을 불러오는 중입니다...</p>}
      {error && <p className="dashboard-error" role="alert">{error}</p>}
      {tbm && <>
        <div className="job-section-heading">
          <strong>TBM #{tbm.tbmId} · {tbm.tbmDate}</strong>
          <span className="job-status-badge">{tbm.status}</span>
        </div>
        <p>실시 일시: {tbm.heldAt || '미기록'} · 진행자: {tbm.leaderName || '미기록'} · 참석 인원: {tbm.attendeeCount ?? '미기록'}</p>
        <h3>교육 요점</h3>
        {tbm.points.length
          ? <ul>{tbm.points.map((point, index) => <li key={`${index}-${point}`}>{point}</li>)}</ul>
          : <p className="job-help">등록된 교육 요점이 없습니다.</p>}
        <p><strong>건강 확인:</strong> {tbm.healthCheck ?? '미기록'}</p>
        <h3>연결 작업</h3>
        <ul>{tbm.works.map((work) => <li key={work.workId}>#{work.workId} · {work.title}</li>)}</ul>
        <h3>참석자</h3>
        {tbm.attendees?.length
          ? <ul>{tbm.attendees.map((attendee) => <li key={attendee.workerId}>
            {attendee.name} · 건강 확인 {attendee.healthOk == null ? '미기록' : attendee.healthOk ? '완료' : '확인 필요'}
          </li>)}</ul>
          : <p className="job-help">등록된 참석자 정보가 없습니다.</p>}
      </>}
    </section>
  );
}

function TbmFields() {
  const [attendees, setAttendees] = useState('');
  const [photoName, setPhotoName] = useState('');
  const attendeeCount = attendees.split('\n').filter((name) => name.trim()).length;

  return (
    <>
      <div className="job-fields">
        <label>회의명<input required /></label>
        <label>실시 일시<input required type="datetime-local" /></label>
        <label>장소<input required /></label>
        <label>진행자<input required /></label>
        <label className="job-field-wide">교육 내용<textarea required rows={4} /></label>
        <label className="job-field-wide">참석자 메모 (한 줄에 한 명, 작업자 배치 아님)<textarea required rows={4} value={attendees} onChange={(event) => setAttendees(event.target.value)} /></label>
        <label className="job-field-wide">사진 선택 (업로드되지 않음)<input type="file" accept="image/*" onChange={(event) => setPhotoName(event.target.files?.[0]?.name ?? '')} /></label>
      </div>
      <p className="job-help">입력한 참석자: {attendeeCount}명{photoName ? ` · 선택한 사진: ${photoName}` : ''}</p>
      <p className="job-help">사진의 날짜·현장·인원 AI 검증과 서명 수집은 아직 연결되지 않았습니다.</p>
      <p className="job-help">정식 TBM 기록은 작업 ID·참석 작업자 ID와 연결되어야 합니다. 현재 이름 메모는 tbm_attendees에 저장되지 않습니다.</p>
    </>
  );
}

export default function JobTbm() {
  const [params] = useSearchParams();
  return <JobDraftForm title="TBM" description="작업 전 안전회의의 교육 내용과 참석자를 기록합니다.">
    {(context) => <>
      <TbmLookup key={`${context.currentSite?.siteId ?? ''}:${params.get('workId') ?? ''}`}
        context={context} initialWorkId={params.get('workId')} />
      <TbmFields />
    </>}
  </JobDraftForm>;
}
