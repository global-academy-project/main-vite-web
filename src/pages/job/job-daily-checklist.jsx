import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useWorkSite } from '../../api/workers';
import JobPageLayout from '../../components/job-page-layout';
import PageHeader from '../../components/ui/page-header.jsx';
import { Badge } from '../../components/home/panel.jsx';
import Icon from '../../components/ui/icon.jsx';
import Sheet from '../../components/ui/sheet.jsx';
import StatusView, { Skeleton } from '../../components/ui/status-view.jsx';
import StepIndicator from '../../components/ui/step-indicator.jsx';
import { useInspection } from '../../hooks/use-inspection.js';
import { localDate } from '../../utils/job-forms';
import { shiftDate } from '../../utils/daily-log-model.js';
import {
  groupItems, INSPECTION_RESULT_LABELS, INSPECTION_RESULT_TONES, INSPECTION_STATUS_LABELS, INSPECTION_STATUS_TONES,
  inspectionSteps, ITEM_RESULT_OPTIONS, NOTE_MAX, TARGET_LABELS, targetName,
} from '../../utils/inspection-model.js';
import '../../styles/home.css';
import '../../styles/work.css';
import '../../styles/records.css';
import '../../styles/risk.css';
import '../../styles/permit.css';
import '../../styles/tbm.css';
import '../../styles/inspection.css';

/**
 * 점검표 (구역·설비). 날짜 하나에 점검표 여러 건 — 왼쪽 목록, 오른쪽 고른 점검표의 항목 점검 · 저장 · 제출.
 * 주소: ?date=YYYY-MM-DD&inspectionId=번호 (승인함·알림에서 오면 그 점검표 날짜로 옮겨 연다), workId 가 있으면 새 점검표에 연결
 */
export default function DailyChecklist() {
  const context = useWorkSite();
  const [params] = useSearchParams();
  const site = context.currentSite;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(params.get('date') ?? '') ? params.get('date') : localDate();
  const inspectionId = /^\d+$/.test(params.get('inspectionId') ?? '') ? params.get('inspectionId') : null;
  return (
    <JobPageLayout title="점검표" user={context.account?.user} contentClassName="work-page">
      {site
        ? <ChecklistPage key={`${site.siteId}:${inspectionId}:${date}`} site={site} context={context} initialDate={date} initialId={inspectionId}
          workId={/^\d+$/.test(params.get('workId') ?? '') ? params.get('workId') : null} />
        : <PageHeader title="점검표" context={context} />}
    </JobPageLayout>
  );
}

function ChecklistPage({ site, context, initialDate, initialId, workId }) {
  const data = useInspection({ siteId: site.siteId, disabled: context.selecting || context.loading, initialId, initialDate });
  const [creating, setCreatingState] = useState(false);
  const setCreating = (open) => { if (open) data.clearError(); setCreatingState(open); };
  const item = data.selected;

  return (
    <div className="work-list rec-page tbm-page insp-page">
      <PageHeader title="점검표" description="작업구역·설비 점검. 항목별로 양호·불량·해당 없음을 적고 저장한 뒤 제출합니다." context={context}
        actions={<>
          {workId && <Link className="ui-btn ui-btn--ghost" to={`/job/workspace?workId=${workId}`}><Icon name="chevronLeft" size={16} />작업 허브로</Link>}
          <button type="button" className="ui-btn ui-btn--ghost" disabled={data.busy || data.loading} onClick={data.reload}><Icon name="refresh" size={16} />새로고침</button>
          <button type="button" className="ui-btn ui-btn--primary" disabled={data.locked} onClick={() => setCreating(true)}>새 점검표</button>
        </>} />

      <section className="work-filters rec-datebar" aria-label="점검일">
        <div className="rec-datebar__nav">
          <button type="button" className="ui-icon-btn" aria-label="전날" disabled={data.busy} onClick={() => data.changeDate(shiftDate(data.date, -1))}><Icon name="chevronLeft" size={18} /></button>
          <label><span className="sr-only">점검일</span><input type="date" max="9999-12-31" value={data.date} disabled={data.busy} onChange={(event) => data.changeDate(event.target.value)} /></label>
          <button type="button" className="ui-icon-btn rec-datebar__next" aria-label="다음 날" disabled={data.busy} onClick={() => data.changeDate(shiftDate(data.date, 1))}><Icon name="chevronLeft" size={18} /></button>
          {data.date !== localDate() && <button type="button" className="ui-btn ui-btn--ghost" onClick={() => data.changeDate(localDate())}>오늘</button>}
        </div>
        <span className="rec-help">같은 날짜·대상·양식의 점검표는 하나만 만들 수 있습니다.</span>
      </section>

      {data.needsReload && (
        <div className="work-form__error" role="alert"><Icon name="warning" size={16} /><span>저장 결과나 최신 내용을 확인해야 합니다. 새로고침으로 서버 반영 여부를 확인한 뒤 계속하세요.</span>
          <button type="button" className="ui-btn ui-btn--ghost" disabled={data.busy} onClick={data.reload}>새로고침</button></div>
      )}

      <div className="tbm-layout">
        <section className="home-panel tbm-list" aria-label={`${data.date} 점검표 목록`}>
          <header className="home-panel__head"><h2 className="home-panel__title">이날 점검표{!data.loading && <span className="home-panel__count">{data.records.length}</span>}</h2></header>
          <div className="home-panel__body">
            {data.loading && <div className="home-panel__pad"><Skeleton lines={4} /></div>}
            {!data.loading && data.listError && <StatusView kind="error" compact message={data.listError} onRetry={data.reload} />}
            {!data.loading && !data.listError && !data.records.length && <StatusView kind="empty" compact title="이 날짜의 점검표가 없습니다" action={{ label: '새 점검표 만들기', onClick: () => setCreating(true) }} />}
            {!data.loading && data.records.length > 0 && (
              <ul className="home-list">
                {data.records.map((record) => {
                  const active = String(record.inspectionId) === String(item?.inspectionId);
                  return (
                    <li key={record.inspectionId}>
                      <button type="button" className={`home-list__item tbm-list__item${active ? ' is-active' : ''}`} aria-pressed={active} onClick={() => data.select(record)}>
                        <span className="home-list__main">
                          <span className="home-list__kind">{TARGET_LABELS[record.targetType]} · {targetName(record)}</span>
                          <span className="home-list__title">{record.templateName ?? record.templateCode}</span>
                          <span className="insp-list__progress"><span style={{ width: `${record.total ? Math.round((record.answered / record.total) * 100) : 0}%` }} /></span>
                        </span>
                        <span className="insp-list__side">
                          <Badge tone={INSPECTION_STATUS_TONES[record.status]}>{INSPECTION_STATUS_LABELS[record.status]}</Badge>
                          <span className="rec-help">{record.answered}/{record.total}</span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>

        <div className="tbm-detail">
          {!item && !data.loading && <section className="home-panel"><StatusView kind="empty" title="점검표를 고르거나 새로 만드세요" message="구역 또는 설비와 양식을 고르면 양식의 항목이 그대로 복사됩니다." /></section>}
          {item && <InspectionDetail data={data} item={item} />}
        </div>
      </div>

      <Sheet open={creating} onClose={() => setCreating(false)} title="새 점검표" subtitle={site.name}
        footer={<><button type="button" className="ui-btn ui-btn--ghost" onClick={() => setCreating(false)}>취소</button><button type="submit" form="insp-create-form" className="ui-btn ui-btn--primary ui-btn--lg" disabled={data.locked || Boolean(data.refs.loading)}>점검표 만들기</button></>}>
        {creating && <CreateForm data={data} workId={workId} onDone={() => setCreating(false)} />}
      </Sheet>
    </div>
  );
}

function CreateForm({ data, workId, onDone }) {
  const { templates, zones, equipment, error, loading } = data.refs;
  const [form, setForm] = useState({ targetType: 'ZONE', templateCode: '', zoneId: '', equipmentId: '', inspectDate: data.date });
  const set = (field, value) => setForm((current) => ({ ...current, [field]: value }));
  const choices = templates.filter((template) => template.targetType === form.targetType);
  const templateCode = choices.some((template) => template.code === form.templateCode) ? form.templateCode : choices[0]?.code ?? '';
  const template = choices.find((entry) => entry.code === templateCode);
  const itemCount = template?.sections.reduce((sum, section) => sum + section.items.length, 0) ?? 0;
  const ready = templateCode && (form.targetType === 'ZONE' ? form.zoneId : form.equipmentId);

  return (
    <form id="insp-create-form" className="tbm-form" onSubmit={async (event) => {
      event.preventDefault();
      if (!ready) return;
      if (await data.create({ ...form, templateCode, workId })) onDone();
    }}>
      {loading && <Skeleton lines={3} />}
      {error && <p className="work-form__error" role="alert"><Icon name="alert" size={16} />{error}</p>}
      {data.error && <p className="work-form__error" role="alert"><Icon name="alert" size={16} />{data.error}</p>}
      <fieldset className="tbm-form__fields" disabled={data.busy || data.needsReload || loading}>
        <legend className="sr-only">점검 대상과 양식</legend>
        <div className="tbm-form__wide">
          <span className="risk-field">점검 대상</span>
          <div className="permit-check__options insp-target" role="group" aria-label="점검 대상 종류">
            {['ZONE', 'EQUIPMENT'].map((type) => (
              <button key={type} type="button" className="permit-check__btn is-unknown" aria-pressed={form.targetType === type} onClick={() => set('targetType', type)}>{TARGET_LABELS[type]} 점검</button>
            ))}
          </div>
        </div>
        {form.targetType === 'ZONE' ? (
          <label className="risk-field"><span className="risk-field__label">구역<span className="risk-req" aria-hidden="true">*</span></span>
            <select required value={form.zoneId} onChange={(event) => set('zoneId', event.target.value)}>
              <option value="">구역을 고르세요</option>
              {zones.map((zone) => <option key={zone.zoneId} value={zone.zoneId}>{zone.code} · {zone.name}</option>)}
            </select></label>
        ) : (
          <label className="risk-field"><span className="risk-field__label">설비<span className="risk-req" aria-hidden="true">*</span></span>
            <select required value={form.equipmentId} onChange={(event) => set('equipmentId', event.target.value)}>
              <option value="">설비를 고르세요</option>
              {equipment.map((entry) => <option key={entry.equipmentId} value={entry.equipmentId}>{entry.code ? `${entry.code} · ` : ''}{entry.name}{entry.inspectionOverdue ? ' (점검 기한 지남)' : ''}</option>)}
            </select></label>
        )}
        <label className="risk-field"><span className="risk-field__label">점검일<span className="risk-req" aria-hidden="true">*</span></span>
          <input required type="date" max="9999-12-31" value={form.inspectDate} onChange={(event) => set('inspectDate', event.target.value)} /></label>
        <label className="risk-field tbm-form__wide"><span className="risk-field__label">양식<span className="risk-req" aria-hidden="true">*</span></span>
          <select required value={templateCode} onChange={(event) => set('templateCode', event.target.value)}>
            {!choices.length && <option value="">이 대상용 양식이 없습니다</option>}
            {choices.map((entry) => <option key={entry.code} value={entry.code}>{entry.name}</option>)}
          </select></label>
        {form.targetType === 'EQUIPMENT' && !equipment.length && !loading && <p className="rec-help tbm-form__wide">이 현장에 사용 중인 설비가 없습니다. 기준 정보에서 설비를 먼저 등록하세요.</p>}
      </fieldset>
      {template && (
        <div className="insp-preview">
          <span className="rec-block__title">항목 미리보기 · {itemCount}개</span>
          <ul>{template.sections.map((section) => <li key={section.title}><strong>{section.title}</strong><span className="rec-help">{section.items.length}개</span></li>)}</ul>
        </div>
      )}
      {workId && <p className="rec-help">작업 #{workId}에 연결해 만듭니다.</p>}
    </form>
  );
}

function InspectionDetail({ data, item }) {
  const { counts, answers, editable } = data;
  const finalResult = item.result ?? (editable ? data.expected : item.expectedResult);
  const rejected = item.status === 'DRAFT' && item.approvalStatus === 'REJECTED';
  return (
    <>
      <section className="home-panel tbm-card" aria-labelledby="insp-title">
        <header className="tbm-card__head">
          <div>
            <h2 id="insp-title">{item.templateName ?? item.templateCode} <Badge tone={INSPECTION_STATUS_TONES[item.status]}>{INSPECTION_STATUS_LABELS[item.status]}</Badge></h2>
            <p className="rec-help">점검표 #{item.inspectionId} · {item.inspectDate} · 점검자 {item.inspectorName ?? '미상'}</p>
          </div>
          <div className="tbm-card__actions">
            <Link className="ui-btn ui-btn--ghost" to={`/records/INSPECTION/${item.inspectionId}`}>문서 보기</Link>
            {item.approvalId && <Link className="ui-btn ui-btn--ghost" to={`/approvals/${item.approvalId}`}>결재 보기</Link>}
            {item.workId && <Link className="ui-btn ui-btn--ghost" to={`/job/workspace?workId=${item.workId}`}>작업 #{item.workId}</Link>}
          </div>
        </header>
        <div className="tbm-card__steps"><StepIndicator steps={inspectionSteps(item, { dirty: data.dirty })} label="점검표 진행 단계" /></div>
        {item.status === 'PENDING' && <p className="rec-note"><Icon name="clock" size={16} />제출해 승인을 기다리는 중입니다. 결과를 고칠 수 없습니다.</p>}
        {rejected && <p className="rec-note rec-note--block"><Icon name="alert" size={16} />반려되어 작성 중으로 돌아왔습니다. 결재 의견을 확인하고 고친 뒤 다시 제출하세요.</p>}
        <dl className="rec-facts tbm-card__facts">
          <div><dt>{TARGET_LABELS[item.targetType]}</dt><dd>{targetName(item)}</dd></div>
          {item.targetType === 'EQUIPMENT' && <div><dt>구역</dt><dd>{item.zoneName ?? (item.zoneId ? `#${item.zoneId}` : '미지정')}</dd></div>}
          <div><dt>점검 진행</dt><dd>{counts.answered}/{counts.total}</dd></div>
          <div><dt>{item.result ? '종합 결과' : '예상 결과'}</dt><dd>{finalResult ? <Badge tone={INSPECTION_RESULT_TONES[finalResult]}>{INSPECTION_RESULT_LABELS[finalResult]}</Badge> : '항목을 다 적으면 계산'}</dd></div>
        </dl>
        <ul className="risk-counts insp-counts" aria-label="항목 결과 개수">
          <li className="is-done"><span>양호</span><strong>{counts.OK}</strong></li>
          <li className="is-block"><span>불량</span><strong>{counts.NG}</strong></li>
          <li><span>해당 없음</span><strong>{counts.NA}</strong></li>
          <li className="is-warn"><span>미점검</span><strong>{counts.total - counts.answered}</strong></li>
        </ul>
      </section>

      {groupItems(item.items).map((group, index) => {
        const done = group.items.filter((entry) => answers[entry.itemCode]?.result).length;
        return (
          <section key={group.title} className="home-panel tbm-card insp-section" aria-labelledby={`insp-sec-${index}`}>
            <header className="tbm-card__head">
              <div><h2 id={`insp-sec-${index}`}><span className="risk-item__no">{index + 1}</span>{group.title}</h2></div>
              <span className={`insp-section__count${done === group.items.length ? ' is-done' : ''}`}>{done}/{group.items.length}</span>
            </header>
            <ol className="insp-items">
              {group.items.map((entry) => {
                const answer = answers[entry.itemCode] ?? {};
                const missing = answer.result === 'NG' && !answer.note?.trim();
                return (
                  <li key={entry.itemCode} className={`insp-item${answer.result ? ` is-${answer.result.toLowerCase()}` : ''}`}>
                    <div className="insp-item__main">
                      <div className="insp-item__text">
                        <strong>{entry.question}</strong>
                        {entry.detail && <span className="rec-help">{entry.detail}</span>}
                      </div>
                      <div className="permit-check__options insp-item__options" role="group" aria-label={`${entry.question} 결과`}>
                        {ITEM_RESULT_OPTIONS.map((option) => (
                          <button key={option.value} type="button" disabled={!editable || data.locked}
                            className={`permit-check__btn ${option.value === 'OK' ? 'is-yes' : option.value === 'NG' ? 'is-no' : 'is-unknown'}`}
                            aria-pressed={answer.result === option.value} onClick={() => data.setResult(entry.itemCode, option.value)}>{option.label}</button>
                        ))}
                      </div>
                    </div>
                    {(answer.result === 'NG' || (answer.note && answer.result)) && (
                      <label className="risk-field insp-item__note">
                        <span className="risk-field__label">{answer.result === 'NG' ? '불량 내용과 조치' : '메모'}{answer.result === 'NG' && <span className="risk-req" aria-hidden="true">*</span>}</span>
                        <textarea rows={2} maxLength={NOTE_MAX} value={answer.note ?? ''} readOnly={!editable} aria-invalid={missing}
                          placeholder="확인한 문제와 작업 전 조치를 적으세요." onChange={(event) => data.setNote(entry.itemCode, event.target.value)} />
                        <span className={`rec-help${missing ? ' insp-item__warn' : ''}`}>{missing ? '불량은 내용을 적어야 저장됩니다.' : `${(answer.note ?? '').length}/${NOTE_MAX}자`}</span>
                      </label>
                    )}
                  </li>
                );
              })}
            </ol>
          </section>
        );
      })}

      {editable && (
        <div className="risk-bar" role="region" aria-label="점검표 저장·제출">
          <span className={`risk-bar__state${data.dirty ? ' is-dirty' : ''}`}>{data.dirty ? '저장하지 않은 변경이 있습니다' : '서버에 저장됨'}</span>
          {data.error && <span className="insp-bar__error" role="alert">{data.error}</span>}
          {data.dirty && <button type="button" className="ui-btn ui-btn--ghost" disabled={data.busy} onClick={data.reset}>변경 취소</button>}
          <button type="button" className="ui-btn ui-btn--secondary" disabled={data.locked || !data.dirty} onClick={data.save}>저장</button>
          <button type="button" className="ui-btn ui-btn--primary" disabled={data.locked || counts.answered < counts.total || counts.missingNote > 0} onClick={data.submit}>제출</button>
        </div>
      )}
    </>
  );
}
