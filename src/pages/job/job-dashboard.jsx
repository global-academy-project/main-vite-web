import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useWorkSite, workTypes } from '../../api/workers';
import { createWork, getSiteWorks, getWork, requireWork, validatePeriod } from '../../api/jobs';
import JobPageLayout, { JobPageHeading } from '../../components/job-page-layout';
import { JobSiteSelector } from './job-work-form';
import JobWorkAgent from './job-work-agent';

function koreaToday() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function WorkList({ siteId, disabled }) {
  const [from, setFrom] = useState(koreaToday);
  const [to, setTo] = useState(koreaToday);
  const [refreshKey, setRefreshKey] = useState(0);
  const [result, setResult] = useState(null);
  const requestKey = `${siteId}:${from}:${to}:${refreshKey}`;
  const loaded = result?.key === requestKey;
  const loading = !loaded;
  const error = loaded ? result.error : '';
  const works = loaded ? result.works : [];

  useEffect(() => {
    let cancelled = false;
    getSiteWorks(siteId, { from, to }).then((works) => {
      if (!cancelled) {
        setResult({ key: requestKey, works, error: '' });
      }
    }).catch((requestError) => {
      if (!cancelled) {
        setResult({ key: requestKey, works: [], error: requestError.message || '작업 목록을 불러오지 못했습니다.' });
      }
    });
    return () => { cancelled = true; };
  }, [siteId, from, to, refreshKey, requestKey]);

  return (
    <section className="panel" aria-labelledby="site-work-list-title">
      <div className="job-section-heading">
        <div><h2 id="site-work-list-title">현장 작업 목록</h2><p className="job-help">선택한 기간의 작업과 연결된 문서 상태입니다.</p></div>
        <button type="button" className="job-history-refresh" disabled={loading || disabled}
          onClick={() => setRefreshKey((value) => value + 1)}>새로고침</button>
      </div>
      <div className="job-fields">
        <label>시작일<input type="date" value={from} disabled={disabled}
          onChange={(event) => setFrom(event.target.value)} /></label>
        <label>종료일<input type="date" value={to} disabled={disabled}
          onChange={(event) => setTo(event.target.value)} /></label>
      </div>
      {error && <p className="dashboard-error" role="alert">{error}</p>}
      {loading ? <p role="status">작업 목록을 불러오는 중입니다...</p> : error ? (
        <button type="button" className="job-history-refresh" onClick={() => setRefreshKey((value) => value + 1)}>다시 시도</button>
      ) : works.length ? (
        <>
          <div className="table-scroll">
            <table>
              <thead><tr><th>작업일</th><th>작업</th><th>유형</th><th>인원</th><th>상태</th><th>허가서</th><th>위험성평가</th><th>TBM</th><th>이동</th></tr></thead>
              <tbody>{works.map((work) => (
                <tr key={work.workId}>
                  <td>{work.workDate}</td>
                  <td>{work.title}<small>#{work.workId}</small></td>
                  <td>{workTypes[work.workType] ?? work.workType}</td>
                  <td>{work.workerCount ?? '미지정'}</td>
                  <td>{work.status}</td>
                  <td>{work.permits.length
                    ? work.permits.map((permit) => `${permit.permitType} · ${permit.status}`).join(', ')
                    : '없음'}</td>
                  <td>{work.riskAssessment?.status ?? '없음'}</td>
                  <td>{work.tbm?.status ?? '없음'}</td>
                  <td className="job-work-links">
                    <Link to={`/job/permits?workId=${work.workId}`}>허가서</Link>
                    <Link to={`/job/risk-assessment?workId=${work.workId}`}>평가</Link>
                    <Link to={`/job/tbm?workId=${work.workId}`}>TBM</Link>
                  </td>
                </tr>
              ))}</tbody>
            </table>
          </div>
          {works.length === 200 && <p className="job-demo-notice" role="status">
            최대 200건을 표시했습니다. 전체 목록이 필요하면 조회 기간을 좁혀 주세요.
          </p>}
        </>
      ) : <p className="job-help">선택한 기간에 조회된 작업이 없습니다.</p>}
    </section>
  );
}

function WorkWorkspace({ site, disabled }) {
  const [work, setWork] = useState(null);
  const [lookupId, setLookupId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [creationUncertain, setCreationUncertain] = useState(false);
  const pending = useRef(false);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const run = async (action, success, creating = false) => {
    if (pending.current || disabled) return;
    pending.current = true;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const saved = await action();
      if (mounted.current) {
        setWork(saved);
        setLookupId(String(saved.workId));
        setMessage(creating
          ? `서버 저장 완료 · 발급된 작업 ID: ${saved.workId} · 작업명: ${saved.title}. 오른쪽 조회에는 ${saved.workId}번을 사용하세요. 작업 승인은 별도 절차입니다.`
          : success);
        if (creating) setCreationUncertain(false);
      }
    } catch (requestError) {
      if (mounted.current) {
        if (creating && requestError.code === 'WRITE_OUTCOME_UNKNOWN') setCreationUncertain(true);
        setError(`${creating ? '작업 저장 실패' : `작업 ID ${lookupId} 조회 실패`}: ${requestError.message || '작업 요청에 실패했습니다.'}${!creating && requestError.code === 'WORK_NOT_FOUND' ? ' 작업명에 입력한 숫자가 아니라 저장 성공 후 발급된 작업 ID를 사용하세요.' : ''}`);
      }
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
  };
  const create = (event) => {
    event.preventDefault();
    if (creationUncertain) return;
    const fields = Object.fromEntries(new FormData(event.currentTarget));
    void run(() => {
      if (fields.startAt && fields.endAt) validatePeriod(fields.startAt, fields.endAt);
      const workerCount = fields.workerCount ? Number(fields.workerCount) : null;
      if (workerCount !== null && (!Number.isSafeInteger(workerCount) || workerCount < 1)) {
        throw new Error('작업 인원은 1 이상의 정수로 입력하세요.');
      }
      if (!fields.title.trim()) throw new Error('작업명을 입력하세요.');
      return createWork({
        siteId: site.siteId, workDate: fields.workDate, title: fields.title.trim(),
        description: fields.description.trim() || null, workType: fields.workType,
        startAt: fields.startAt || null, endAt: fields.endAt || null, workerCount,
      });
    }, '작업을 서버에 저장했습니다. 작업 승인은 별도 절차입니다.', true);
  };
  return (
    <>
      {error && <p className="dashboard-error" role="alert">{error}</p>}
      {message && <p className="job-review-notice" role="status">{message}</p>}
      {creationUncertain && <section className="job-demo-notice" role="alert">
        <p>작업 생성 결과가 불확실하여 추가 등록을 중지했습니다. 작업 목록에서 작업명과 기간을 확인하거나 작업 ID로 다시 조회하세요.</p>
        <button type="button" disabled={busy || disabled} onClick={() => {
          if (window.confirm('관리자 또는 작업 ID 조회로 저장 여부를 확인했으며, 새 작업 등록을 진행하시겠습니까? 중복 작업이 생길 수 있습니다.')) {
            setCreationUncertain(false); setError('');
          }
        }}>반영 여부 확인 후 등록 잠금 해제</button>
      </section>}
      <div className="job-work-grid">
      <form className="panel job-form" onSubmit={create}>
        <div className="job-section-heading"><div><span className="job-eyebrow">NEW WORK</span><h2>작업 등록</h2><p className="job-help">작업 기본 정보를 저장하고 허가서 작성으로 이어갑니다.</p></div><span className="job-status-badge">서버 연결</span></div>
        <fieldset disabled={disabled || busy || creationUncertain}>
          <legend>{site.name}</legend>
          <div className="job-fields">
            <div><label>작업명<input name="title" required maxLength={200} placeholder="예: 저장탱크 주변 용접 작업" /></label>
              <p className="job-help">작업 이름입니다. 숫자를 입력해도 작업 ID가 되지 않습니다. ID는 저장 성공 후 서버가 발급합니다.</p>
            </div>
            <label>작업일<input name="workDate" type="date" required /></label>
            <label>작업 유형<select name="workType">{Object.entries(workTypes).map(([code, label]) => <option key={code} value={code}>{label}</option>)}</select></label>
            <label>작업 인원<input name="workerCount" type="number" min="1" step="1" /></label>
            <label>시작 일시<input name="startAt" type="datetime-local" /></label>
            <label>종료 일시<input name="endAt" type="datetime-local" /></label>
            <label className="job-field-wide">작업 내용<textarea name="description" placeholder="작업 범위와 확인할 사항을 입력해 주세요." /></label>
          </div>
          <div className="job-form-actions"><span>저장 후 작업 ID가 발급됩니다.</span><button type="submit">{busy ? '처리 중...' : '작업 저장'}</button></div>
        </fieldset>
      </form>
      <div className="job-work-aside">
      <form className="panel job-form job-lookup" onSubmit={(event) => {
        event.preventDefault();
        void run(async () => requireWork(await getWork(lookupId), site.siteId), '서버의 작업을 조회했습니다.');
      }}>
        <span className="job-eyebrow">FIND WORK</span>
        <h2>작업 조회</h2>
        <fieldset disabled={disabled || busy}>
          <label>작업 ID<input value={lookupId} placeholder="저장한 작업 ID 입력" onChange={(event) => { setLookupId(event.target.value); setWork(null); setMessage(''); }} required inputMode="numeric" /></label>
          <button type="submit">조회</button>
        </fieldset>
        <p className="job-help">작업 ID를 모르면 위 현장 작업 목록에서 작업을 확인하세요.</p>
      </form>
      {work && <section className="panel job-example" aria-label="저장된 작업">
        <div className="job-section-heading"><strong>서버 발급 작업 ID: {work.workId}</strong><span className="job-status-badge">{work.status}</span></div>
        <h2>{work.title}</h2>
        <p>{work.workDate} · {workTypes[work.workType]}</p>
        <p>{work.description || '작업 내용 없음'}</p>
        <p>{work.startAt || '시작 미지정'} ~ {work.endAt || '종료 미지정'} · 인원 {work.workerCount ?? '미지정'}</p>
        <p className="job-help">#{work.workId}는 작업 ID입니다. 작업허가서는 별도로 저장해야 하며, 저장 후 별도의 허가서 ID가 발급됩니다.</p>
        <Link className="job-link-button" to={`/job/permits?workId=${work.workId}`}>이 작업의 허가서 작성 <span aria-hidden="true">→</span></Link>
      </section>}
      {!work && <section className="job-empty-state" aria-label="작업 조회 안내"><span className="job-eyebrow">WORK DETAILS</span><h3>작업 정보를 이곳에서 확인하세요</h3><p className="job-help">새 작업을 저장하거나 기존 작업 ID를 조회하면 상세 정보와 허가서 작성 링크가 표시됩니다.</p></section>}
      </div>
      </div>
    </>
  );
}

export default function JobDashboard() {
  const context = useWorkSite();
  return (
    <JobPageLayout title="작업 현황" user={context.account?.user} contentClassName="job-management job-overview">
      <JobPageHeading title="안전 작업 현황" description={`${new Date().toLocaleDateString('ko-KR')} · ${context.currentSite?.name ?? '현장 미선택'}`} />
      <JobSiteSelector context={context} />
      <p className="scenario-notice">선택 현장과 권한은 실제 사용자 API 정보입니다. 업무 조회 API가 없는 항목은 0건이나 가상 작업으로 대체하지 않습니다.</p>
      <section className="stat-grid" aria-label="안전관리 요약">
        <div className="stat-card"><span>접근 가능 현장</span><strong>{context.account ? context.account.sites.length : '미조회'}<small>곳</small></strong></div>
        <div className="stat-card"><span>오늘 작업 인원</span><strong>미연결</strong></div>
        <div className="stat-card"><span>작업 승인 상태</span><strong>미연결</strong></div>
        <div className="stat-card"><span>작업 전 필수 확인</span><strong>미연결</strong></div>
      </section>
      {context.currentSite && <WorkList key={context.currentSite.siteId}
        siteId={context.currentSite.siteId} disabled={context.selecting} />}
      <section className="dashboard-panels" aria-label="현장 안전 현황">
        <div className="panel"><h2>현장 취급 물질</h2><p className="job-help">site_chemicals · work_materials 조회 API가 필요합니다. 물질·수량·단위는 선택 현장 및 작업 ID와 함께 조회해야 합니다.</p></div>
        <div className="panel"><h2>아차사고·작업 경고</h2><p className="job-help">near_misses · record_tags · work_warnings 조회 API가 필요합니다. 등록된 실제 사고가 있는지는 아직 확인할 수 없습니다.</p></div>
        <div className="panel"><h2>허가·필수 조치</h2><p className="job-help">현장별 허가·필수 조치 요약 API는 없습니다. 개별 작업 조회 후 허가서 작성 화면에서 허가서 조회·판정·승인 요청을 진행할 수 있습니다.</p></div>
      </section>
      {context.currentSite && <section className="job-overview-workspace" aria-labelledby="job-workspace-title">
        <JobWorkAgent key={`agent-${context.currentSite.siteId}`} siteId={context.currentSite.siteId} disabled={context.selecting} />
        <div className="job-section-heading">
          <div><span className="job-eyebrow">WORK MANAGEMENT</span><h2 id="job-workspace-title">작업 등록·조회</h2><p className="job-help">위 현황과 별개로, 선택 현장의 개별 작업은 실제 서버에 저장하고 조회할 수 있습니다.</p></div>
        </div>
        <WorkWorkspace key={context.currentSite.siteId} site={context.currentSite} disabled={context.selecting} />
      </section>}
    </JobPageLayout>
  );
}
