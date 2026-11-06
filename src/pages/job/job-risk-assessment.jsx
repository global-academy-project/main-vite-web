import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { getSiteWorks, getWork } from '../../api/jobs';
import { useWorkSite } from '../../api/workers';
import JobPageLayout from '../../components/job-page-layout';
import PageHeader from '../../components/ui/page-header.jsx';
import { Badge } from '../../components/home/panel.jsx';
import Icon from '../../components/ui/icon.jsx';
import StatusView, { Skeleton } from '../../components/ui/status-view.jsx';
import StepIndicator from '../../components/ui/step-indicator.jsx';
import { useRiskAssessment } from '../../hooks/use-risk-assessment.js';
import { TAG_LABELS } from '../../utils/agentic-rag-tags';
import { RISK_STATUS_LABELS, toneOf, WORK_TYPE_LABELS } from '../../utils/home-model.js';
import { itemScore, levelCounts, RISK_LEVEL_TEXT, RISK_LEVEL_TONES, riskSteps } from '../../utils/risk-model.js';
import { backToHubPath, withBack } from '../../utils/work-list-model.js';
import '../../styles/home.css';
import '../../styles/work.css';
import '../../styles/records.css';
import '../../styles/risk.css';
import { usePeriod } from '../../hooks/use-period.js';
import PeriodBar from '../../components/period-bar.jsx';

const SCALE = ['1', '2', '3', '4', '5'];
const FREQUENCY_HINT = { 1: '거의 없음', 2: '드묾', 3: '가끔', 4: '자주', 5: '매우 자주' };
const SEVERITY_HINT = { 1: '경미', 2: '가벼운 부상', 3: '치료 필요', 4: '중상', 5: '사망·중대' };

/**
 * 위험성평가. 주소에 riskId 또는 workId 가 있으면 그 평가를 바로 열고, 없으면 작업을 고르는 화면.
 * 저장·검사·승인 요청 규칙은 기존과 같다(use-risk-assessment).
 */
// 기간으로 보면 여러 날 작업이 섞이므로 최근 날짜부터
const sortByDate = (works) => [...works].sort((a, b) => String(b.workDate).localeCompare(String(a.workDate)) || b.workId - a.workId);
const shortDay = (date) => (date ? date.slice(5).replace('-', '/') : '-');

export default function JobRiskAssessment() {
  const context = useWorkSite();
  const [params] = useSearchParams();
  const site = context.currentSite;
  const riskId = /^\d+$/.test(params.get('riskId') ?? '') ? params.get('riskId') : null;
  const workId = /^\d+$/.test(params.get('workId') ?? '') ? params.get('workId') : null;
  return (
    <JobPageLayout title="위험성평가" user={context.account?.user} contentClassName="work-page">
      {!site ? <PageHeader title="위험성평가" context={context} />
        : riskId || workId
          ? <RiskEditor key={`${site.siteId}:${riskId}:${workId}`} site={site} context={context} initialRiskId={riskId} initialWorkId={workId} back={backToHubPath(params.get('back'))} />
          : <RiskFinder key={site.siteId} site={site} context={context} />}
    </JobPageLayout>
  );
}

/** 평가 찾기: 날짜별 작업에서 고르기 (+ 평가 번호로 바로 열기) */
function RiskFinder({ site, context }) {
  const navigate = useNavigate();
  // 기간(오늘·7일·30일)은 다른 메뉴에 다녀와도 남는다
  const period = usePeriod(`risk:${site.siteId}`);
  const { from, to } = period;
  const [state, setState] = useState({ key: null, works: [], error: '' });
  const [lookup, setLookup] = useState('');
  const key = `${site.siteId}:${from}:${to}`;
  useEffect(() => {
    let active = true;
    getSiteWorks(site.siteId, from, to).then((works) => { if (active) setState({ key, works: sortByDate(works), error: '' }); })
      .catch((requestError) => { if (active) setState({ key, works: [], error: requestError.message || '작업 목록을 불러오지 못했습니다.' }); });
    return () => { active = false; };
  }, [site.siteId, from, to, key]);
  const loading = state.key !== key;

  return (
    <div className="work-list rec-page">
      <PageHeader title="위험성평가" description="작업을 고르면 그 작업의 위험성평가를 열거나 새로 작성합니다." context={context} />
      <section className="work-filters rec-datebar" aria-label="작업일">
        <PeriodBar period={period} label="작업일" />
        <form className="risk-lookup" onSubmit={(event) => { event.preventDefault(); if (/^\d+$/.test(lookup.trim())) navigate(`/job/risk-assessment?riskId=${lookup.trim()}`); }}>
          <label><span className="sr-only">평가 번호</span><input value={lookup} inputMode="numeric" placeholder="평가 번호로 열기" onChange={(event) => setLookup(event.target.value)} /></label>
          <button type="submit" className="ui-btn ui-btn--ghost" disabled={!/^\d+$/.test(lookup.trim())}>열기</button>
        </form>
        {period.error && <p className="work-filters__help" role="alert">{period.error}</p>}
      </section>
      <section className="home-panel work-table-panel" aria-label="작업 목록">
        {loading && <div className="home-panel__pad"><Skeleton lines={5} /></div>}
        {!loading && state.error && <StatusView kind="error" message={state.error} />}
        {!loading && !state.error && !state.works.length && <StatusView kind="empty" title={from === to ? '이 날짜에 등록된 작업이 없습니다' : '이 기간에 등록된 작업이 없습니다'} message="작업을 먼저 등록하세요." action={{ label: '작업 목록으로', onClick: () => navigate('/job/workspace') }} />}
        {!loading && state.works.length > 0 && (
          <table className="home-table">
            <thead><tr><th scope="col" className="work-table__date">작업일</th><th scope="col">작업</th><th scope="col">종류</th><th scope="col">위험성평가</th><th scope="col"><span className="sr-only">열기</span></th></tr></thead>
            <tbody>
              {state.works.map((work) => {
                const brief = work.riskAssessment;
                return (
                  <tr key={work.workId}>
                    <td data-label="작업일" className="work-table__date">{shortDay(work.workDate)}</td>
                    <td data-label="작업"><span className="home-table__name"><span className="home-table__title">{work.title}</span><span className="work-table__id">#{work.workId}</span></span></td>
                    <td data-label="종류"><Badge tone={work.highRisk ? 'warn' : 'neutral'}>{WORK_TYPE_LABELS[work.workType] ?? work.workType}</Badge></td>
                    <td data-label="위험성평가">{brief ? <Badge tone={toneOf(brief.status)}>{RISK_STATUS_LABELS[brief.status] ?? brief.status}</Badge> : <span className="work-none">작성 전</span>}</td>
                    <td data-label="열기"><Link className="ui-btn ui-btn--secondary appr-open" to={brief ? `/job/risk-assessment?riskId=${brief.riskAssessmentId}` : `/job/risk-assessment?workId=${work.workId}`}>{brief ? '열기' : '작성하기'}</Link></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

function RiskEditor({ site, context, initialRiskId, initialWorkId, back }) {
  const navigate = useNavigate();
  const data = useRiskAssessment({ siteId: site.siteId, initialRiskId, initialWorkId, disabled: context.selecting || context.loading });
  const { risk } = data;
  const [work, setWork] = useState(null);
  const targetWorkId = risk?.workId ?? (/^\d+$/.test(data.workId) ? data.workId : null);
  useEffect(() => {
    if (!targetWorkId) return undefined;
    let active = true;
    getWork(targetWorkId).then((found) => { if (active) setWork(found); }).catch(() => { if (active) setWork(null); });
    return () => { active = false; };
  }, [targetWorkId]);
  const counts = levelCounts(data.items);
  const editable = !data.locked && !data.needsReload;
  const hub = back ?? (targetWorkId ? `/job/workspace?workId=${targetWorkId}` : null);
  const status = risk ? (RISK_STATUS_LABELS[risk.status] ?? risk.status) : '새 평가';

  if (data.loading) return <div className="work-list"><PageHeader title="위험성평가" context={context} /><div className="home-panel home-panel__pad"><Skeleton lines={8} /></div></div>;

  return (
    <div className="work-list rec-page risk-page">
      <PageHeader title={work?.title ? `${work.title} 위험성평가` : '위험성평가'} context={context} onBeforeSelect={() => navigate('/job/risk-assessment')}
        badges={<Badge tone={risk ? toneOf(risk.status) : 'todo'}>{status}</Badge>}
        description={[risk ? `평가 #${risk.riskAssessmentId}${risk.revision ? ` · ${risk.revision}판` : ''}` : null, targetWorkId ? `작업 #${targetWorkId}` : null, work?.workType ? WORK_TYPE_LABELS[work.workType] : null].filter(Boolean).join(' · ')}
        actions={<>
          {hub && <Link className="ui-btn ui-btn--ghost" to={hub}><Icon name="chevronLeft" size={16} />작업 허브로</Link>}
          {risk?.approvalId && <Link className="ui-btn ui-btn--ghost" to={`/approvals?tab=requested&open=${risk.approvalId}`}>결재 보기</Link>}
          {risk?.riskAssessmentId && <Link className="ui-btn ui-btn--ghost" to={`/records/RISK/${risk.riskAssessmentId}`}>문서 보기</Link>}
          <Link className="ui-btn ui-btn--ghost" to="/job/risk-assessment">다른 평가</Link>
        </>} />

      {data.needsReload && (
        <div className="work-form__error" role="alert">
          <Icon name="warning" size={16} />
          <span>저장 결과나 최신 내용을 확인해야 합니다. 다시 불러온 뒤 계속하세요.</span>
          <button type="button" className="ui-btn ui-btn--ghost" disabled={data.busy} onClick={() => data.load({ riskId: risk?.riskAssessmentId, workId: data.workId })}>다시 불러오기</button>
        </div>
      )}
      {data.error && <p className="work-form__error" role="alert"><Icon name="alert" size={16} />{data.error}</p>}

      <section className="home-panel risk-summary" aria-label="평가 요약">
        <div className="risk-summary__steps"><StepIndicator steps={riskSteps(risk)} label="위험성평가 진행 단계" /></div>
        <div className="risk-summary__row">
          {!risk && (
            <label className="risk-field risk-field--inline">작업 ID
              <input required inputMode="numeric" value={data.workId} disabled={!editable || data.busy} onChange={(event) => data.setWorkId(event.target.value)} />
            </label>
          )}
          <label className="risk-field risk-field--inline">평가일
            <input required type="date" max="9999-12-31" value={data.assessDate} disabled={!editable || data.busy} onChange={(event) => data.setAssessDate(event.target.value)} />
          </label>
          <ul className="risk-counts" aria-label="등급별 위험요인">
            <li><span>위험요인</span><strong>{data.items.length}</strong></li>
            {['HIGH', 'MEDIUM', 'LOW'].map((level) => <li key={level} className={`is-${RISK_LEVEL_TONES[level]}`}><span>{RISK_LEVEL_TEXT[level]}</span><strong>{counts[level]}</strong></li>)}
          </ul>
        </div>
        <p className="rec-help risk-summary__rule">빈도×강도 12 이상 높음, 6 이상 보통, 그 아래 낮음. 고른 등급이 계산보다 낮으면 서버가 올려 저장하고, 높게 고른 것은 그대로 둡니다. 등급은 승인이나 작업 시작 허가가 아닙니다.</p>
        {risk?.formData && risk.formData !== '{}' && (
          <details className="risk-formdata"><summary>기존 초안 근거·검토 정보 (수정해도 그대로 보존)</summary><pre>{typeof risk.formData === 'string' ? risk.formData : JSON.stringify(risk.formData, null, 2)}</pre></details>
        )}
      </section>

      <form className="risk-items" onSubmit={(event) => { event.preventDefault(); void data.save(); }} aria-label="위험요인 및 감소대책">
        <fieldset disabled={!editable || data.busy} className="risk-items__fields">
          <legend className="sr-only">위험요인 및 감소대책</legend>
          {data.items.map((item, index) => <RiskItem key={item.seq} item={item} index={index} data={data} canRemove={data.items.length > 1} />)}
          {editable && <button type="button" className="risk-add" onClick={data.addItem}><span aria-hidden="true">＋</span>위험요인 추가</button>}
        </fieldset>

        <div className="risk-bar">
          <span className={`risk-bar__state${data.dirty ? ' is-dirty' : ''}`}>
            {data.locked ? (risk?.status === 'REJECTED' ? '반려된 평가입니다. "수정 후 다시 제출"을 누르면 반려된 내용을 그대로 옮긴 수정본이 열립니다.' : '작성 중인 평가만 고칠 수 있습니다.')
              : data.dirty ? '저장하지 않은 변경이 있습니다. 저장한 뒤 승인 요청하세요.' : risk ? '서버에 저장된 최신 내용입니다.' : '아직 저장하지 않은 새 평가입니다.'}
          </span>
          {risk?.status === 'REJECTED' && <button type="button" className="ui-btn ui-btn--secondary" disabled={data.busy || data.needsReload} onClick={async () => { const next = await data.revise(); if (next) navigate(withBack(`/job/risk-assessment?riskId=${next.riskAssessmentId}`, back ? targetWorkId : null), { replace: true }); }}>수정 후 다시 제출</button>}
          {editable && <button type="submit" className="ui-btn ui-btn--ghost" disabled={data.busy || (!data.dirty && Boolean(risk))}>{data.busy ? '저장 중…' : '초안 저장'}</button>}
          {risk?.canSubmit && <button type="button" className="ui-btn ui-btn--primary" disabled={data.busy || data.dirty} onClick={data.submit}>승인 요청</button>}
        </div>
      </form>
    </div>
  );
}

function ScaleField({ label, value, onChange, hints }) {
  return (
    <div className="risk-scale" role="group" aria-label={label}>
      <span className="risk-scale__label">{label}</span>
      <div className="risk-scale__options">
        {SCALE.map((option) => (
          <button key={option} type="button" className="risk-scale__btn" aria-pressed={value === option} title={hints[option]} aria-label={`${label} ${option} (${hints[option]})`}  onClick={() => onChange(value === option ? '' : option)}>{option}</button>
        ))}
      </div>
      <span className="risk-scale__hint">{value ? hints[value] : '고르세요'}</span>
    </div>
  );
}

function RiskItem({ item, index, data, canRemove }) {
  const score = itemScore(item);
  const set = (field) => (value) => data.updateItem(item.seq, field, value);
  const unknownType = item.accidentType && !Object.hasOwn(TAG_LABELS.ACCIDENT_TYPE, item.accidentType);
  return (
    <fieldset className={`risk-item risk-item--${RISK_LEVEL_TONES[score.saved] ?? 'neutral'}`}>
      <legend className="sr-only">위험요인 {index + 1}</legend>
      <header className="risk-item__head">
        <span className="risk-item__no">{index + 1}</span>
        <span className="risk-item__title">{item.workStep || '작업 단계'} · {item.hazard || '위험요인'}</span>
        <span className="risk-item__score">
          {score.before != null ? <>점수 <strong>{score.before}</strong></> : '점수 미입력'}
          <Badge tone={RISK_LEVEL_TONES[score.saved]}>{RISK_LEVEL_TEXT[score.saved]}</Badge>
          {score.after != null && <span className="risk-item__after">개선 후 {score.after}</span>}
        </span>
        {canRemove && <button type="button" className="ui-icon-btn risk-item__remove" aria-label={`위험요인 ${index + 1} 삭제`} onClick={() => data.removeItem(item.seq)}><Icon name="close" size={16} /></button>}
      </header>
      <div className="risk-item__grid">
        <label className="risk-field"><span className="risk-field__label">작업 단계<span className="risk-req" aria-hidden="true">*</span></span><input required value={item.workStep} placeholder="예: 진입 전" onChange={(event) => set('workStep')(event.target.value)} /></label>
        <label className="risk-field"><span className="risk-field__label">위험요인<span className="risk-req" aria-hidden="true">*</span></span><input required value={item.hazard} placeholder="예: 산소 결핍" onChange={(event) => set('hazard')(event.target.value)} /></label>
        <label className="risk-field">사고 유형
          <select value={item.accidentType} onChange={(event) => set('accidentType')(event.target.value)}>
            <option value="">미지정</option>
            {Object.entries(TAG_LABELS.ACCIDENT_TYPE).map(([code, label]) => <option key={code} value={code}>{label}</option>)}
            {unknownType && <option value={item.accidentType}>{item.accidentType}</option>}
          </select>
        </label>
        <label className="risk-field">위험 등급
          <select value={item.riskLevel} onChange={(event) => set('riskLevel')(event.target.value)}>
            <option value="HIGH">높음</option><option value="MEDIUM">보통</option><option value="LOW">낮음</option>
          </select>
        </label>
        <div className="risk-item__scales">
          <ScaleField label="빈도" value={item.frequency} onChange={set('frequency')} hints={FREQUENCY_HINT} />
          <ScaleField label="강도" value={item.severity} onChange={set('severity')} hints={SEVERITY_HINT} />
        </div>
        {score.raised && <p className="risk-item__raised"><Icon name="info" size={14} /><span>점수 {score.before}점이라 저장하면 등급이 <strong>{RISK_LEVEL_TEXT[score.computed]}</strong>으로 올라갑니다.</span></p>}
        {!data.dirty && item.computedLevel && item.computedLevel !== item.riskLevel && !score.raised && <p className="risk-item__raised is-up"><Icon name="info" size={14} /><span>서버 계산 등급은 {RISK_LEVEL_TEXT[item.computedLevel] ?? item.computedLevel}이고, 작성자가 {RISK_LEVEL_TEXT[item.riskLevel]}으로 높여 저장했습니다.</span></p>}
        <label className="risk-field risk-field--wide"><span className="risk-field__label">감소대책<span className="risk-req" aria-hidden="true">*</span></span><textarea required rows={2} value={item.controls} placeholder="예: 작업 전 산소 농도 측정, 송기마스크 착용" onChange={(event) => set('controls')(event.target.value)} /></label>
        <div className="risk-item__scales risk-item__scales--after">
          <ScaleField label="개선 후 빈도" value={item.residualFrequency} onChange={set('residualFrequency')} hints={FREQUENCY_HINT} />
          <ScaleField label="개선 후 강도" value={item.residualSeverity} onChange={set('residualSeverity')} hints={SEVERITY_HINT} />
        </div>
      </div>
    </fieldset>
  );
}
