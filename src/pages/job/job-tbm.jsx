import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { getSiteWorks } from '../../api/jobs';
import { useWorkSite } from '../../api/workers';
import JobPageLayout from '../../components/job-page-layout';
import JobReferenceSelectors from '../../components/job-reference-selectors';
import JobTbmRisks from '../../components/job-tbm-risks';
import PageHeader from '../../components/ui/page-header.jsx';
import { Badge } from '../../components/home/panel.jsx';
import Icon from '../../components/ui/icon.jsx';
import Sheet from '../../components/ui/sheet.jsx';
import StatusView, { Skeleton } from '../../components/ui/status-view.jsx';
import StepIndicator from '../../components/ui/step-indicator.jsx';
import { useTbmWorkspace } from '../../hooks/use-tbm-workspace.js';
import { WORK_TYPE_LABELS } from '../../utils/home-model.js';
import { localDate } from '../../utils/job-forms';
import { shiftDate } from '../../utils/daily-log-model.js';
import { healthCounts, parseWorkIds, tbmStatusLabel, tbmSteps, toggleWorkId } from '../../utils/tbm-model.js';
import { backToHubPath } from '../../utils/work-list-model.js';
import '../../styles/home.css';
import '../../styles/work.css';
import '../../styles/records.css';
import '../../styles/risk.css';
import '../../styles/permit.css';
import '../../styles/tbm.css';

const tone = (tbm) => (!tbm ? 'todo' : tbm.approvalStatus === 'PENDING' ? 'wait' : tbm.status === 'APPROVED' ? 'done' : tbm.status === 'DONE' ? 'info' : 'todo');

/**
 * TBM. 날짜 하나에 TBM 여러 건 — 왼쪽 목록, 오른쪽 고른 TBM(내용 · 연결 작업 위험성평가 · 참석자 · 실시 완료 · 확인 요청).
 * 주소: ?date=YYYY-MM-DD&tbmId=번호 (작업 허브에서 오면 workId 로 새 TBM 에 그 작업을 미리 골라 둔다)
 */
export default function JobTbm() {
  const context = useWorkSite();
  const [params] = useSearchParams();
  const site = context.currentSite;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(params.get('date') ?? '') ? params.get('date') : localDate();
  return (
    <JobPageLayout title="TBM" user={context.account?.user} contentClassName="work-page">
      {site
        ? <TbmPage key={`${site.siteId}:${params.get('tbmId')}:${date}`} site={site} context={context} initialDate={date}
          initialTbmId={/^\d+$/.test(params.get('tbmId') ?? '') ? params.get('tbmId') : null}
          presetWorkId={/^\d+$/.test(params.get('workId') ?? '') ? params.get('workId') : null} back={backToHubPath(params.get('back'))} />
        : <PageHeader title="TBM" context={context} />}
    </JobPageLayout>
  );
}

function TbmPage({ site, context, initialDate, initialTbmId, presetWorkId, back }) {
  const data = useTbmWorkspace({ siteId: site.siteId, disabled: context.selecting || context.loading, initialTbmId, initialDate, presetWorkId });
  const [works, setWorks] = useState({ key: null, items: [] });
  const worksKey = `${site.siteId}:${data.editing ? data.contentDate : data.date}`;
  const worksDate = data.editing ? data.contentDate : data.date;
  useEffect(() => {
    let active = true;
    getSiteWorks(site.siteId, worksDate).then((items) => { if (active) setWorks({ key: worksKey, items }); }).catch(() => { if (active) setWorks({ key: worksKey, items: [] }); });
    return () => { active = false; };
  }, [site.siteId, worksDate, worksKey]);

  const hub = back ?? (presetWorkId ? `/job/workspace?workId=${presetWorkId}` : null);
  const tbm = data.selectedTbm;

  return (
    <div className="work-list rec-page tbm-page">
      <PageHeader title="TBM" description="작업 전 안전 회의. 내용 작성 → 참석자 → 실시 완료 → 확인 요청 순서로 진행합니다." context={context}
        actions={<>
          {hub && <Link className="ui-btn ui-btn--ghost" to={hub}><Icon name="chevronLeft" size={16} />작업 허브로</Link>}
          <button type="button" className="ui-btn ui-btn--ghost" disabled={data.busy || data.loading} onClick={data.reload}><Icon name="refresh" size={16} />새로고침</button>
          <button type="button" className="ui-btn ui-btn--primary" disabled={data.locked} onClick={() => data.openNew([])}>새 TBM</button>
        </>} />

      <section className="work-filters rec-datebar" aria-label="TBM 날짜">
        <div className="rec-datebar__nav">
          <button type="button" className="ui-icon-btn" aria-label="전날" disabled={data.busy} onClick={() => data.changeDate(shiftDate(data.date, -1))}><Icon name="chevronLeft" size={18} /></button>
          <label><span className="sr-only">TBM 날짜</span><input type="date" max="9999-12-31" value={data.date} disabled={data.busy} onChange={(event) => data.changeDate(event.target.value)} /></label>
          <button type="button" className="ui-icon-btn rec-datebar__next" aria-label="다음 날" disabled={data.busy} onClick={() => data.changeDate(shiftDate(data.date, 1))}><Icon name="chevronLeft" size={18} /></button>
          {data.date !== localDate() && <button type="button" className="ui-btn ui-btn--ghost" onClick={() => data.changeDate(localDate())}>오늘</button>}
        </div>
        <span className="rec-help">연결 작업은 같은 현장·같은 날짜여야 하고, 다른 TBM과 겹쳐 연결할 수 없습니다.</span>
      </section>

      {data.needsReload && (
        <div className="work-form__error" role="alert"><Icon name="warning" size={16} /><span>저장 결과나 최신 판을 확인해야 합니다. 새로고침으로 서버 반영 여부를 확인한 뒤 계속하세요.</span>
          <button type="button" className="ui-btn ui-btn--ghost" disabled={data.busy} onClick={data.reload}>새로고침</button></div>
      )}
      {data.error && !data.editing && <p className="work-form__error" role="alert"><Icon name="alert" size={16} />{data.error}</p>}

      <div className="tbm-layout">
        <section className="home-panel tbm-list" aria-label={`${data.date} TBM 목록`}>
          <header className="home-panel__head"><h2 className="home-panel__title">이날 TBM{!data.loading && <span className="home-panel__count">{data.records.length}</span>}</h2></header>
          <div className="home-panel__body">
            {data.loading && <div className="home-panel__pad"><Skeleton lines={4} /></div>}
            {!data.loading && data.listError && <StatusView kind="error" compact message={data.listError} onRetry={data.reload} />}
            {!data.loading && !data.listError && !data.records.length && <StatusView kind="empty" compact title="이 날짜의 TBM이 없습니다" action={{ label: '새 TBM 작성', onClick: () => data.openNew([]) }} />}
            {!data.loading && data.records.length > 0 && (
              <ul className="home-list">
                {data.records.map((record) => (
                  <li key={record.tbmId}>
                    <button type="button" className={`home-list__item tbm-list__item${String(record.tbmId) === String(tbm?.tbmId) ? ' is-active' : ''}`} aria-pressed={String(record.tbmId) === String(tbm?.tbmId)} onClick={() => data.select(record)}>
                      <span className="home-list__main">
                        <span className="home-list__kind">TBM #{record.tbmId} · 진행 {record.leaderName || '미입력'}</span>
                        <span className="home-list__title">{record.works.map((work) => work.title).join(', ') || '연결 작업 없음'}</span>
                      </span>
                      <Badge tone={tone(record)}>{tbmStatusLabel(record)}</Badge>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <div className="tbm-detail">
          {!tbm && !data.loading && <section className="home-panel"><StatusView kind="empty" title="TBM을 고르거나 새로 작성하세요" message="왼쪽 목록에서 고르면 내용과 참석자, 실시 완료를 이어서 할 수 있습니다." /></section>}
          {tbm && <TbmDetail data={data} tbm={tbm} siteId={site.siteId} />}
        </div>
      </div>

      <Sheet open={Boolean(data.editing)} onClose={data.closeEditor} wide title={data.editing === 'edit' ? `TBM #${tbm?.tbmId} 내용 수정` : '새 TBM'} subtitle={site.name}
        footer={<><button type="button" className="ui-btn ui-btn--ghost" onClick={data.closeEditor}>취소</button><button type="submit" form="tbm-content-form" className="ui-btn ui-btn--primary ui-btn--lg" disabled={data.locked}>{data.editing === 'edit' ? '내용·작업·참석자 저장' : 'TBM 초안 작성'}</button></>}>
        {data.editing && <TbmForm data={data} siteId={site.siteId} works={works.key === worksKey ? works.items : []} />}
      </Sheet>
    </div>
  );
}

function TbmForm({ data, siteId, works }) {
  const selected = parseWorkIds(data.content.workIds);
  const unknown = selected.filter((id) => !works.some((work) => String(work.workId) === id));
  return (
    <form id="tbm-content-form" className="tbm-form" onSubmit={async (event) => { event.preventDefault(); await data.saveContent(); }}>
      {data.error && <p className="work-form__error" role="alert"><Icon name="alert" size={16} />{data.error}</p>}
      <fieldset className="tbm-form__fields" disabled={data.busy || data.needsReload}>
        <legend className="sr-only">TBM 내용</legend>
        <label className="risk-field"><span className="risk-field__label">TBM 날짜<span className="risk-req" aria-hidden="true">*</span></span>
          <input required type="date" max="9999-12-31" value={data.contentDate} onChange={(event) => data.setContentDate(event.target.value)} /></label>
        <label className="risk-field">진행자<input maxLength={50} value={data.content.leaderName} placeholder="예: 김안전" onChange={(event) => data.setField('leaderName', event.target.value)} /></label>
        <div className="tbm-form__refs">
          <JobReferenceSelectors siteId={siteId} teamId={data.content.teamId} zoneId={data.content.zoneId} disabled={data.busy}
            onChange={(field, value) => data.setField(field, value)} />
        </div>
        <div className="tbm-form__wide">
          <span className="risk-field tbm-form__label">연결 작업<span className="rec-help">{data.contentDate} 작업 · {selected.length}개 고름</span></span>
          {works.length ? (
            <ul className="tbm-works">
              {works.map((work) => {
                const checked = selected.includes(String(work.workId));
                return (
                  <li key={work.workId}>
                    <label className={`tbm-work${checked ? ' is-checked' : ''}`}>
                      <input type="checkbox" checked={checked} onChange={(event) => data.setField('workIds', toggleWorkId(data.content.workIds, work.workId, event.target.checked))} />
                      <span className="tbm-work__title">{work.title}<span className="work-table__id">#{work.workId}</span></span>
                      <Badge tone={work.highRisk ? 'warn' : 'neutral'}>{WORK_TYPE_LABELS[work.workType] ?? work.workType}</Badge>
                    </label>
                  </li>
                );
              })}
            </ul>
          ) : <p className="rec-help">이 날짜에 등록된 작업이 없습니다.</p>}
          {unknown.length > 0 && <p className="rec-help">목록에 없는 작업: {unknown.map((id) => `#${id}`).join(', ')} (저장 시 서버가 확인합니다)</p>}
        </div>
        <label className="risk-field tbm-form__wide"><span className="tbm-form__label">교육 요점<span className="rec-help">한 줄에 하나 · 30개까지</span></span>
          <textarea rows={5} value={data.content.points} placeholder={'예: 산소 측정 후 진입\n감시인 상주'} onChange={(event) => data.setField('points', event.target.value)} /></label>
        <label className="risk-field tbm-form__wide">건강 확인 내용<textarea rows={2} maxLength={500} value={data.content.healthCheck} onChange={(event) => data.setField('healthCheck', event.target.value)} /></label>
      </fieldset>
      {data.editing === 'edit' && <p className="rec-help">수정은 내용·작업·참석자를 통째로 바꿉니다. 팀·구역은 불러온 값으로 채워집니다.</p>}
    </form>
  );
}

function TbmDetail({ data, tbm, siteId }) {
  const counts = healthCounts(data.attendees);
  const disabled = data.locked || !data.editable || !data.workersLoaded || Boolean(data.workerError);
  return (
    <>
      <section className="home-panel tbm-card" aria-labelledby="tbm-title">
        <header className="tbm-card__head">
          <div>
            <h2 id="tbm-title">TBM #{tbm.tbmId} <Badge tone={tone(tbm)}>{tbmStatusLabel(tbm)}</Badge></h2>
            <p className="rec-help">{tbm.tbmDate} · 진행자 {tbm.leaderName || '미입력'}</p>
          </div>
          <div className="tbm-card__actions">
            {tbm.approvalId && <Link className="ui-btn ui-btn--ghost" to={`/approvals/${tbm.approvalId}`}>결재 보기</Link>}
            {data.editable && <button type="button" className="ui-btn ui-btn--secondary" disabled={data.locked} onClick={data.openEdit}>내용 수정</button>}
          </div>
        </header>
        <div className="tbm-card__steps"><StepIndicator steps={tbmSteps(tbm, { attendeesSaved: data.attendeesSaved, attendeeTotal: data.attendees.length })} label="TBM 진행 단계" /></div>
        {data.approvalPending && <p className="rec-note"><Icon name="clock" size={16} />확인 요청 중입니다. 수정·참석자 저장·실시 완료·되돌리기를 할 수 없습니다.</p>}
        <dl className="rec-facts tbm-card__facts">
          <div><dt>팀</dt><dd>{tbm.teamName ?? (tbm.teamId == null ? '미지정' : `#${tbm.teamId}`)}</dd></div>
          <div><dt>구역</dt><dd>{tbm.zoneName ?? (tbm.zoneId == null ? '미지정' : `#${tbm.zoneId}`)}</dd></div>
          <div><dt>참석</dt><dd>{tbm.attendeeCount ?? data.attendees.length}명</dd></div>
          <div><dt>실시</dt><dd>{tbm.heldAt ? tbm.heldAt.replace('T', ' ').slice(0, 16) : '아직'}</dd></div>
        </dl>
        <div className="tbm-card__works">
          <span className="rec-block__title">연결 작업</span>
          {tbm.works.length ? <span className="work-badges">{tbm.works.map((work) => <Link key={work.workId} className="permit-chip" to={`/job/workspace?workId=${work.workId}`}>{work.title}<span className="work-table__id">#{work.workId}</span></Link>)}</span> : <span className="rec-help">없음</span>}
        </div>
        {(tbm.points?.length > 0 || tbm.healthCheck) && (
          <div className="tbm-card__body">
            {tbm.points?.length > 0 && <div><span className="rec-block__title">교육 요점</span><ol className="tbm-points">{tbm.points.map((point, index) => <li key={index}>{point}</li>)}</ol></div>}
            {tbm.healthCheck && <div><span className="rec-block__title">건강 확인</span><p className="rec-text">{tbm.healthCheck}</p></div>}
          </div>
        )}
      </section>

      <JobTbmRisks key={`${tbm.tbmId}:${tbm.lockVersion}`} tbm={tbm} siteId={siteId} />

      <section className="home-panel tbm-card" aria-labelledby="tbm-attendees">
        <header className="tbm-card__head">
          <div>
            <h2 id="tbm-attendees">참석자 <span className="home-panel__count">{data.attendees.length}</span></h2>
            <p className="rec-help">이상 없음 {counts.ok} · 이상 있음 {counts.bad} · 확인 안 함 {counts.unknown}</p>
          </div>
          <div className="tbm-card__actions">
            <span className={`rec-log__state${data.attendeesSaved ? '' : ' is-dirty'}`}>{data.attendeesSaved ? '서버에 저장됨' : '저장되지 않음'}</span>
            {data.editable && <button type="button" className="ui-btn ui-btn--primary" disabled={data.busy || data.attendeesSaved || (data.editing && data.contentDirty)} onClick={data.saveAttendees}>참석자 저장</button>}
          </div>
        </header>
        {data.workerError && <p className="work-form__error" role="alert"><Icon name="alert" size={16} />{data.workerError}<button type="button" className="ui-btn ui-btn--ghost" onClick={data.reloadWorkers}>작업자 다시 조회</button></p>}
        <fieldset className="tbm-workers" disabled={disabled}>
          <legend className="sr-only">현장 작업자 참석 확인</legend>
          {!data.workersLoaded && !data.workerError ? <Skeleton lines={3} /> : data.workers.length ? (
            <ul className="tbm-workers__list">
              {data.workers.map((worker) => {
                const attendee = data.attendees.find((person) => person.workerId === worker.workerId);
                return (
                  <li key={worker.workerId} className={attendee ? 'is-in' : ''}>
                    <label className="tbm-worker">
                      <input type="checkbox" checked={Boolean(attendee)} onChange={(event) => data.toggleAttendee(worker.workerId, event.target.checked)} />
                      <span className="tbm-worker__name">{worker.name}<span className="work-table__id">#{worker.workerId}</span></span>
                      {worker.jobType && <span className="rec-help">{worker.jobType}</span>}
                    </label>
                    {attendee && (
                      <div className="permit-check__options tbm-health" role="group" aria-label={`${worker.name} 건강 상태`}>
                        {[[true, '이상 없음', 'yes'], [false, '이상 있음', 'no'], [null, '확인 안 함', 'unknown']].map(([value, text, key]) => (
                          <button key={key} type="button" className={`permit-check__btn is-${key}`} aria-pressed={attendee.healthOk === value || (value === null && attendee.healthOk == null)} onClick={() => data.setHealth(worker.workerId, value)}>{text}</button>
                        ))}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : <p className="rec-help">현장 작업자가 없습니다. 작업자 등록·배치 상태를 확인하세요.</p>}
          {data.attendees.filter((person) => !data.workers.some((worker) => worker.workerId === person.workerId)).map((person) => (
            <p key={person.workerId} className="rec-note">기존 참석자 #{person.workerId} · 지금 배치 목록에 없음
              <button type="button" className="ui-btn ui-btn--ghost" onClick={() => data.toggleAttendee(person.workerId, false)}>참석자에서 빼기</button></p>
          ))}
        </fieldset>
      </section>

      {data.editable && (
        <section className="home-panel tbm-card" aria-labelledby="tbm-finish">
          <header className="tbm-card__head"><div><h2 id="tbm-finish">실시 완료</h2><p className="rec-help">실시 일시는 TBM 날짜와 같은 날이어야 합니다. 실제 참석 인원을 비우면 등록 참석자 수를 씁니다. 실시 완료는 승인·서명이 아닙니다.</p></div></header>
          <fieldset className="tbm-finish" disabled={data.locked}>
            <legend className="sr-only">실시 완료</legend>
            <label className="risk-field"><span className="risk-field__label">실시 일시<span className="risk-req" aria-hidden="true">*</span></span>
              <input required type="datetime-local" step="any" min={`${tbm.tbmDate}T00:00`} max={`${tbm.tbmDate}T23:59:59`} value={data.heldAt} onChange={(event) => data.setHeldAt(event.target.value)} /></label>
            <label className="risk-field">실제 참석 인원<input type="number" min="0" step="1" inputMode="numeric" placeholder={`비우면 ${data.attendees.length}명`} value={data.attendeeCount} onChange={(event) => data.setAttendeeCount(event.target.value)} /></label>
            <button type="button" className="ui-btn ui-btn--primary" disabled={data.busy || !data.attendeesSaved || (data.editing && data.contentDirty)} onClick={data.finish}>실시 완료</button>
          </fieldset>
          {!data.attendeesSaved && <p className="rec-help tbm-finish__hint">참석자를 먼저 저장해야 실시 완료할 수 있습니다.</p>}
        </section>
      )}

      {tbm.status === 'DONE' && (
        <section className="home-panel tbm-card" aria-labelledby="tbm-request">
          <header className="tbm-card__head">
            <div><h2 id="tbm-request">확인 요청</h2><p className="rec-help">확인 요청 중인 TBM은 서버가 재개·수정을 거부합니다. 반려되면 작성 중으로 돌아갑니다.</p></div>
            <div className="tbm-card__actions">
              <button type="button" className="ui-btn ui-btn--ghost" disabled={data.locked || !data.canRequest} onClick={data.reopen}>실시 완료 되돌리기</button>
              <button type="button" className="ui-btn ui-btn--primary" disabled={data.locked || !data.canRequest} onClick={data.submit}>TBM 확인 요청</button>
            </div>
          </header>
        </section>
      )}
      {!data.editable && tbm.status !== 'DONE' && <p className="rec-help">완료 또는 승인된 TBM의 참석자와 실시 정보는 이 화면에서 고칠 수 없습니다.</p>}
    </>
  );
}
