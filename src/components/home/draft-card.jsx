import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { checkPermit, getPermit, getWork, measurementFields, saveMeasurements, submitPermit, measurementItems } from '../../api/jobs';
import { getRiskAssessment, submitRiskAssessment } from '../../api/risk-assessments';
import { getTbm } from '../../api/tbm';
import { useToast } from '../ui/toast-context.js';
import Field from '../ui/field.jsx';
import Icon from '../ui/icon.jsx';
import StatusView from '../ui/status-view.jsx';
import { Badge } from './panel.jsx';
import { draftDocs, draftRemaining, PERMIT_STATUS_LABELS, RISK_STATUS_LABELS, TBM_STATUS_LABELS, timeRange, toneOf, WORK_STATUS_LABELS, WORK_TYPE_LABELS } from '../../utils/home-model.js';
import { jobRecordPath } from '../../utils/job-forms.js';

const loaders = {
  WORK: (doc) => getWork(doc.id),
  RISK: (doc, siteId) => getRiskAssessment(doc.id, siteId),
  PERMIT: (doc, siteId) => getPermit(doc.id, siteId),
  TBM: (doc, siteId) => getTbm(doc.id, siteId),
};

/**
 * AI 작업 등록이 끝난(DONE) 뒤 대화 안에서 초안을 끝까지 처리하는 카드.
 * 쓰는 서버 값: run.result.saved (workId, riskAssessmentId, permits[], tbmId), run.result.approvalGate.
 * 각 탭은 기존 api 함수(조회·저장·판정·승인 요청)를 그대로 부른다. 서버 변경 없음.
 */
export default function DraftCard({ result, siteId, zones, onChanged }) {
  const docs = useMemo(() => draftDocs(result.saved), [result.saved]);
  const [records, setRecords] = useState({});
  const [active, setActive] = useState(docs[0]?.key);

  const load = useCallback(async (doc) => {
    try {
      const record = await loaders[doc.type](doc, siteId);
      setRecords((prev) => ({ ...prev, [doc.key]: { status: 'ready', data: record } }));
      return record;
    } catch (error) {
      setRecords((prev) => ({ ...prev, [doc.key]: { status: 'error', error: error.message } }));
      return null;
    }
  }, [siteId]);

  useEffect(() => { docs.forEach((doc) => { void load(doc); }); }, [docs, load]);

  const remaining = docs.map((doc) => ({ doc, ...draftRemaining(doc, records[doc.key]?.data) }));
  const left = remaining.filter((item) => !item.done).length;
  const current = docs.find((doc) => doc.key === active) ?? docs[0];

  // 처리하면 다음 남은 탭으로 이동
  const advance = async (doc) => {
    const fresh = await load(doc);
    onChanged?.();
    const after = docs.map((item) => ({ item, done: draftRemaining(item, item.key === doc.key ? fresh : records[item.key]?.data).done }));
    const next = after.find((entry) => !entry.done && entry.item.key !== doc.key);
    if (next) setActive(next.item.key);
  };

  if (!docs.length) return null;
  return (
    <article className="draft-card" aria-label="AI가 만든 초안">
      <header className="draft-card__head">
        <span className="draft-card__title"><Icon name="records" size={18} />초안 {docs.length}건을 만들었습니다</span>
        <span className="draft-card__left">{left ? <>남은 일 <strong>{left}</strong></> : <><Icon name="check" size={14} />모두 처리</>}</span>
      </header>
      {result.saved.workDateAssumed && <p className="draft-card__note"><Icon name="info" size={14} />작업 날짜가 없어 오늘로 저장했습니다. 작업일을 확인하세요.</p>}
      <div className="draft-card__tabs" role="tablist" aria-label="초안 문서">
        {remaining.map(({ doc, done, label }) => (
          <button key={doc.key} type="button" role="tab" aria-selected={doc.key === current.key} className={`draft-tab${doc.key === current.key ? ' is-active' : ''}`} onClick={() => setActive(doc.key)}>
            {doc.label}
            <span className={`draft-tab__state${done ? ' is-done' : ''}`}>{done ? <Icon name="check" size={12} strokeWidth={3} label="완료" /> : label}</span>
          </button>
        ))}
      </div>
      <div className="draft-card__body" role="tabpanel">
        <DraftPanel doc={current} entry={records[current.key]} siteId={siteId} zones={zones} gate={result.approvalGate} onReload={() => load(current)} onDone={() => advance(current)} />
      </div>
    </article>
  );
}

function DraftPanel({ doc, entry, siteId, zones, gate, onReload, onDone }) {
  if (!entry) return <StatusView kind="loading" compact />;
  if (entry.status === 'error') return <StatusView kind="error" compact message={entry.error} onRetry={onReload} />;
  const record = entry.data;
  const full = jobRecordPath(doc.type, doc.id);
  const footer = full && <Link className="ui-btn ui-btn--ghost" to={full}>전체 보기</Link>;
  if (doc.type === 'WORK') return <WorkDraft work={record} zones={zones} footer={footer} />;
  if (doc.type === 'RISK') return <RiskDraft risk={record} siteId={siteId} footer={footer} onDone={onDone} />;
  if (doc.type === 'PERMIT') return <PermitDraft permit={record} siteId={siteId} gate={gate} footer={footer} onDone={onDone} onReload={onReload} />;
  return <TbmDraft tbm={record} footer={footer} />;
}

function Facts({ rows }) {
  return <dl className="draft-facts">{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>;
}

function WorkDraft({ work, zones, footer }) {
  const zone = zones?.find((item) => item.zoneId === work.zoneId);
  return (
    <div className="draft-panel">
      <Facts rows={[
        ['작업', work.title], ['종류', `${WORK_TYPE_LABELS[work.workType] ?? work.workType}${work.highRisk ? ' · 고위험' : ''}`],
        ['구역', zone?.name ?? (work.zoneId ? `구역 #${work.zoneId}` : '등록된 구역 아님')], ['시간', timeRange(work.startAt, work.endAt) || '-'],
        ['인원', `${work.workerCount ?? '-'}명`], ['상태', WORK_STATUS_LABELS[work.status] ?? work.status],
      ]} />
      {!work.zoneId && <p className="draft-warn"><Icon name="alert" size={14} />구역이 등록된 목록과 연결되지 않았습니다. 대화로 구역을 다시 알려 주세요.</p>}
      <div className="draft-actions">{footer}</div>
    </div>
  );
}

function RiskDraft({ risk, siteId, footer, onDone }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    try {
      await submitRiskAssessment(risk.riskAssessmentId, siteId);
      toast.show({ tone: 'success', message: '위험성평가 승인 요청을 보냈습니다.' });
      await onDone();
    } catch (error) {
      toast.show({ tone: 'error', message: error.message || '승인 요청에 실패했습니다.' });
    } finally { setBusy(false); }
  };
  return (
    <div className="draft-panel">
      <div className="draft-panel__status"><Badge tone={toneOf(risk.status)}>{RISK_STATUS_LABELS[risk.status]}</Badge><span>위험요인 {risk.items.length}개</span></div>
      <ol className="draft-risks">
        {risk.items.slice(0, 5).map((item) => (
          <li key={item.seq}><strong>{item.hazard}</strong><span>{item.controls || '감소대책 없음'}</span>{item.riskLevel && <Badge tone={item.riskLevel === 'HIGH' ? 'block' : item.riskLevel === 'MEDIUM' ? 'warn' : 'neutral'}>{item.riskLevel}</Badge>}</li>
        ))}
      </ol>
      {risk.items.length > 5 && <p className="draft-muted">외 {risk.items.length - 5}개</p>}
      <div className="draft-actions">
        {footer}
        {risk.status === 'DRAFT' && <button type="button" className="ui-btn ui-btn--primary" disabled={busy || !risk.canSubmit} onClick={submit}>{busy ? '보내는 중…' : '승인 요청'}</button>}
      </div>
      {risk.status === 'DRAFT' && !risk.canSubmit && <p className="draft-muted">위험요인이 1개 이상 있어야 승인 요청할 수 있습니다.</p>}
    </div>
  );
}

function latestValues(measurements) {
  const values = {};
  [...measurements].sort((a, b) => String(a.measuredAt).localeCompare(String(b.measuredAt))).forEach((m) => { values[m.item] = String(m.value); });
  return values;
}

/** 측정 항목 하나의 판정 문제. 상세 판정(checks)의 target 이 정확히 measurement.<코드> 인 것만, 없으면 규칙 코드 끝자리 */
function fieldProblem(evaluation, code) {
  const check = evaluation?.checks?.find((item) => item.target === `measurement.${code}` && item.status !== 'PASS');
  if (check) return { message: check.message || `${code} ${check.expected}` };
  return evaluation?.violations?.find((item) => String(item.ruleCode ?? '').split('.').pop() === code) ?? null;
}

function PermitDraft({ permit, siteId, gate, footer, onDone, onReload }) {
  const toast = useToast();
  const fields = measurementFields[permit.permitType] ?? [];
  const editable = ['DRAFT', 'CHECKING', 'BLOCKED'].includes(permit.status);
  const [values, setValues] = useState(() => latestValues(permit.measurements));
  const [evaluation, setEvaluation] = useState(permit.lastEvaluation);
  const [busy, setBusy] = useState('');
  const [fieldError, setFieldError] = useState('');

  const saveAndCheck = async () => {
    setFieldError('');
    setBusy('check');
    try {
      const saved = latestValues(permit.measurements);
      const changed = fields.some(({ code }) => String(values[code] ?? '').trim() !== String(saved[code] ?? ''));
      if (fields.length && changed) await saveMeasurements(permit.permitId, measurementItems(permit.permitType, values), siteId);
      const result = await checkPermit(permit.permitId);
      setEvaluation(result.evaluation);
      toast.show({ tone: result.evaluation.result === 'BLOCK' ? 'error' : 'success', message: result.evaluation.result === 'BLOCK' ? '판정 결과 차단입니다. 문제 항목을 고쳐 다시 판정하세요.' : '판정을 통과했습니다. 승인 요청을 보낼 수 있습니다.' });
      await onReload();
    } catch (error) {
      if (/측정값/.test(error.message || '')) setFieldError(error.message);
      else toast.show({ tone: 'error', message: error.message || '판정에 실패했습니다.' });
    } finally { setBusy(''); }
  };

  const submit = async () => {
    setBusy('submit');
    try {
      await submitPermit(permit.permitId, siteId);
      toast.show({ tone: 'success', message: '작업허가 승인 요청을 보냈습니다.' });
      await onDone();
    } catch (error) {
      toast.show({ tone: 'error', message: error.message || '승인 요청에 실패했습니다.' });
    } finally { setBusy(''); }
  };

  const result = evaluation?.result;
  return (
    <div className="draft-panel">
      <div className="draft-panel__status">
        <Badge tone={toneOf(permit.status)}>{PERMIT_STATUS_LABELS[permit.status]}</Badge>
        <span>{permit.permitNo || `허가 #${permit.permitId}`}</span>
        {result && <Badge tone={result === 'BLOCK' ? 'block' : result === 'WARN' ? 'warn' : 'done'}>{result === 'BLOCK' ? '판정 차단' : result === 'WARN' ? '판정 주의' : '판정 통과'}</Badge>}
      </div>
      {fields.length > 0 && (
        <div className="draft-measures">
          {fields.map(({ code, label }) => {
            const violation = fieldProblem(evaluation, code);
            return (
              <Field key={code} name={`m-${code}`} label={label} inputMode="decimal" value={values[code] ?? ''} disabled={!editable || Boolean(busy)}
                onChange={(event) => setValues((prev) => ({ ...prev, [code]: event.target.value }))}
                error={violation?.message} valid={Boolean(result && result !== 'BLOCK' && values[code])} />
            );
          })}
        </div>
      )}
      {!fields.length && <p className="draft-muted">이 허가는 측정 항목이 없습니다. 확인 항목은 전체 보기에서 입력합니다.</p>}
      {fieldError && <p className="draft-warn" role="alert"><Icon name="alert" size={14} />{fieldError}</p>}
      {evaluation?.violations?.length > 0 && (
        <ul className="draft-violations">
          {evaluation.violations.map((item, index) => <li key={`${item.ruleCode}-${index}`}><Icon name={item.severity === 'BLOCK' ? 'alert' : 'warning'} size={14} />{item.message}</li>)}
        </ul>
      )}
      {gate && !gate.canRequest && gate.reasons?.length > 0 && <p className="draft-muted">AI 초안 검토(작성 당시): {gate.reasons.join(' · ')}</p>}
      <div className="draft-actions">
        {footer}
        {editable && <button type="button" className="ui-btn ui-btn--secondary" disabled={Boolean(busy)} onClick={saveAndCheck}>{busy === 'check' ? '판정 중…' : fields.length ? '저장하고 판정' : '판정'}</button>}
        {editable && <button type="button" className="ui-btn ui-btn--primary" disabled={Boolean(busy) || !permit.canSubmit} onClick={submit}>{busy === 'submit' ? '보내는 중…' : '승인 요청'}</button>}
      </div>
    </div>
  );
}

function TbmDraft({ tbm, footer }) {
  return (
    <div className="draft-panel">
      <div className="draft-panel__status"><Badge tone={toneOf(tbm.status)}>{TBM_STATUS_LABELS[tbm.status]}</Badge><span>{tbm.tbmDate}</span></div>
      <Facts rows={[['참석', `${tbm.attendees.length}명`], ['연결 작업', `${tbm.works.length}건`], ['결재', tbm.approvalStatus ? ({ PENDING: '승인 대기', APPROVED: '승인', REJECTED: '반려', CANCELED: '취소' }[tbm.approvalStatus]) : '요청 전']]} />
      <p className="draft-muted">참석 확인·교육 포인트·사진은 TBM 화면에서 이어서 합니다.</p>
      <div className="draft-actions">{footer}</div>
    </div>
  );
}
