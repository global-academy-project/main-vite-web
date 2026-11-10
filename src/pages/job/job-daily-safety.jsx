import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useWorkSite } from '../../api/workers';
import JobPageLayout from '../../components/job-page-layout';
import PageHeader from '../../components/ui/page-header.jsx';
import { Badge } from '../../components/home/panel.jsx';
import Icon from '../../components/ui/icon.jsx';
import StatusView, { Skeleton } from '../../components/ui/status-view.jsx';
import StepIndicator from '../../components/ui/step-indicator.jsx';
import { useToast } from '../../components/ui/toast-context.js';
import { useDailySafety } from '../../hooks/use-daily-safety.js';
import { useDateRange } from '../../hooks/use-date-range.js';
import PeriodBar from '../../components/period-bar.jsx';
import SafetyInspectionLogForm from '../../components/daily-safety/safety-inspection-log-form.jsx';
import {
  checksTotal, DAILY_LOG_APPROVER_ROLES, DAILY_LOG_STATUS_LABELS, DAILY_LOG_TONES, dailyLogSteps, deadlineOf, teamRow,
} from '../../utils/daily-log-model.js';
import { jobRecordPath, localDate } from '../../utils/job-forms';
import { missingDailyLogDocumentFields, normalizeDailyLogDocument } from '../../utils/daily-log-document.js';
import '../../styles/home.css';
import '../../styles/work.css';
import '../../styles/records.css';

const roleOf = (site) => site?.role || site?.siteRole || '';

/**
 * 안전일지. 날짜 하나 = 일지 하나.
 * 작성자: 초안 만들기 → 요약 작성·저장 → 승인 요청. 승인자·현장 관리자: 현장 미완료 항목·팀별 현황을 먼저 보고 일지를 검토(승인은 승인함).
 */
export default function JobDailySafety() {
  const context = useWorkSite();
  const site = context.currentSite;
  const toast = useToast();
  // 기간(from~to, 같은 탭 유지, 서버 한도 92일). 일지는 날짜당 1건이라 보는 날짜는 기간 안의 하루: 기본은 끝 날짜
  const range = useDateRange('daily-log', localDate(), { maxDays: 92 });
  const [picked, setPicked] = useState(null);
  const date = picked && picked >= range.from && picked <= range.to ? picked : range.to;
  const data = useDailySafety(site?.siteId, date, range);
  const canApprove = DAILY_LOG_APPROVER_ROLES.includes(roleOf(site));
  const deadline = deadlineOf(data.dashboard);

  const confirmLeave = () => !data.dirty || window.confirm('저장하지 않은 요약이 있습니다. 날짜를 바꾸면 사라집니다. 바꿀까요?');
  const changeDate = (next) => {
    if (!next || next === date || !confirmLeave()) return;
    setPicked(next);
  };
  const period = {
    ...range.period,
    setPeriod: (from, to) => { if (confirmLeave()) { setPicked(null); range.setPeriod(from, to); } },
    pick: (days) => { if (confirmLeave()) { setPicked(null); range.period.pick(days); } },
  };
  const handlePrint = () => {
    const missing = missingDailyLogDocumentFields(normalizeDailyLogDocument(data.log));
    if (missing.length > 0) {
      toast.show({ tone: 'warning', message: `인쇄 전에 확인해 주세요: ${missing.join(', ')}` });
      return;
    }
    window.print();
  };

  return (
    <JobPageLayout title="안전일지" user={context.account?.user} contentClassName="work-page">
      <div className="work-list rec-page">
        <PageHeader title="안전일지" description="그날 작업·허가·TBM·점검을 서버가 모아 초안을 만듭니다." context={context}
          onBeforeSelect={() => { if (data.dirty) toast.show({ tone: 'info', message: '저장하지 않은 요약 수정 내용은 현장을 바꾸면 사라집니다. 현장을 바꾸기 전에 저장해 주세요.' }); }}
          badges={deadline && <Badge tone={deadline.passed ? 'block' : 'neutral'}><Icon name="clock" size={12} />{deadline.text}</Badge>}
          actions={<>
            <button type="button" className="ui-btn ui-btn--ghost" disabled={data.busy || data.loading} onClick={data.reload}><Icon name="refresh" size={16} />새로고침</button>
            <button type="button" className="ui-btn ui-btn--ghost" disabled={!data.log || data.busy || data.loading} onClick={handlePrint}><Icon name="print" size={16} />인쇄</button>
            {data.log?.dailyLogId && <Link className="ui-btn ui-btn--ghost" to={`/records/DAILY_LOG/${data.log.dailyLogId}`}>문서 보기</Link>}
          </>} />

        <section className="work-filters rec-datebar" aria-label="기준 날짜">
          <PeriodBar period={period} label="일지 기간" disabled={data.busy} />
          {period.error && <span className="work-filters__help" role="alert">{period.error}</span>}
          {data.log && <Badge tone={DAILY_LOG_TONES[data.log.status] ?? 'neutral'}>{DAILY_LOG_STATUS_LABELS[data.log.status] ?? data.log.status}</Badge>}
        </section>
        {site && data.multiDay && <RangeLogs data={data} date={date} onPick={changeDate} />}

        {!site ? <StatusView kind="empty" title="현장을 선택해 주세요" />
          : canApprove ? <ManagerView data={data} /> : <WriterView data={data} />}
      </div>
      <SafetyInspectionLogForm log={normalizeDailyLogDocument(data.log)} />
    </JobPageLayout>
  );
}

/** 기간 일지 목록: 날짜를 누르면 그날 일지로 (일지는 현장·날짜당 1건) */
function RangeLogs({ data, date, onPick }) {
  return (
    <section className="home-panel rec-range" aria-labelledby="daily-range-title">
      <header className="home-panel__head">
        <h2 id="daily-range-title" className="home-panel__title">기간 일지{!data.rangeLoading && <span className="home-panel__count">{data.rangeLogs.length}</span>}</h2>
        <span className="rec-help">{data.rangeFrom.slice(5).replace('-', '/')} ~ {data.rangeTo.slice(5).replace('-', '/')} · 날짜를 누르면 그날 일지를 엽니다 · 지금 {date.slice(5).replace('-', '/')}</span>
      </header>
      {data.rangeLoading && <div className="home-panel__pad"><Skeleton lines={1} /></div>}
      {!data.rangeLoading && data.rangeError && <StatusView kind="error" compact message={data.rangeError} onRetry={data.reload} />}
      {!data.rangeLoading && !data.rangeError && !data.rangeLogs.length && <p className="rec-pad rec-help">이 기간에 만든 일지가 없습니다.</p>}
      {!data.rangeLoading && data.rangeLogs.length > 0 && (
        <ul className="rec-range__list">
          {data.rangeLogs.map((log) => (
            <li key={log.dailyLogId}>
              <button type="button" className={`rec-range__item${log.date === date ? ' is-active' : ''}`} aria-pressed={log.date === date} disabled={data.busy} onClick={() => onPick(log.date)}>
                <strong>{log.date.slice(5).replace('-', '/')}</strong>
                <Badge tone={DAILY_LOG_TONES[log.status] ?? 'neutral'}>{DAILY_LOG_STATUS_LABELS[log.status] ?? log.status}</Badge>
                {log.writerName && <span className="rec-help">{log.writerName}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Alerts({ data }) {
  if (!data.error) return null;
  return (
    <p className="work-form__error" role="alert"><Icon name="alert" size={16} />{data.error}
      <button type="button" className="ui-btn ui-btn--ghost" disabled={data.loading || data.busy} onClick={data.reload}>다시 조회</button>
    </p>
  );
}

function WriterView({ data }) {
  return (
    <>
      <Alerts data={data} />
      <div className="rec-daily">
        <div className="rec-daily__main"><LogPanel data={data} editable /></div>
        <div className="rec-daily__side">
          <ChecksPanel data={data} />
          <EvidencePanel log={data.log} />
        </div>
      </div>
    </>
  );
}

function ManagerView({ data }) {
  return (
    <>
      <Alerts data={data} />
      <SiteItemsPanel data={data} />
      <div className="rec-daily">
        <div className="rec-daily__main">
          <LogPanel data={data} />
          <TeamsPanel data={data} />
        </div>
        <div className="rec-daily__side">
          <ChecksPanel data={data} />
          <EvidencePanel log={data.log} />
        </div>
      </div>
    </>
  );
}

/** 일지 본문: 단계 · 요약 · 저장/승인 요청 (승인자 화면은 읽기 + 승인함으로) */
function LogPanel({ data, editable = false }) {
  const { log } = data;
  const draftEditable = editable && log?.status === 'DRAFT';
  return (
    <section className="home-panel rec-log" aria-labelledby="daily-log-title">
      <header className="home-panel__head">
        <h2 id="daily-log-title" className="home-panel__title">{editable ? '안전일지' : '안전일지 검토'}</h2>
        {log?.approvalId && <Link className="home-panel__link" to={`/approvals?tab=${editable ? 'requested' : 'pending'}&open=${log.approvalId}`}>{editable ? '승인 상세 보기' : '승인함에서 검토'}</Link>}
      </header>
      <div className="rec-log__steps"><StepIndicator steps={dailyLogSteps(log)} label="안전일지 진행 단계" /></div>
      <div className="rec-log__body">
        {data.loading && <Skeleton lines={5} />}
        {!data.loading && data.loadError && <StatusView kind="error" compact message={data.loadError} onRetry={data.reload} />}
        {!data.loading && !data.loadError && !log && (
          <StatusView kind="empty" title="이 날짜의 안전일지가 아직 없습니다"
            message="그날의 작업·허가·TBM·점검·미완료 항목을 서버가 모아 초안을 만듭니다."
            action={{ label: data.busy ? '만드는 중…' : '서버에서 초안 만들기', onClick: data.createDraft }} />
        )}
        {!data.loading && log && (
          <>
            {draftEditable ? (
              <label className="rec-log__summary">
                <span className="rec-block__title">일일 안전일지 요약</span>
                <textarea rows={8} value={data.summary} disabled={data.busy} onChange={(event) => data.setSummary(event.target.value)} />
              </label>
            ) : (
              <div className="rec-log__summary">
                <span className="rec-block__title">일일 안전일지 요약</span>
                <p className="rec-text rec-log__read">{log.summary || '요약이 비어 있습니다.'}</p>
              </div>
            )}
            {draftEditable && (
              <div className="rec-log__actions">
                <span className={`rec-log__state${data.dirty ? ' is-dirty' : ''}`}>{data.dirty ? '저장하지 않은 수정 내용이 있습니다.' : '서버에 저장된 최신 초안입니다.'}</span>
                <button type="button" className="ui-btn ui-btn--ghost" disabled={data.busy || !data.dirty} onClick={data.saveSummary}>요약 저장</button>
                <button type="button" className="ui-btn ui-btn--primary" disabled={data.busy || !data.summary.trim()} onClick={data.submit}>승인 요청</button>
              </div>
            )}
            <section className="rec-log__json" aria-labelledby="daily-log-json-title">
              <span id="daily-log-json-title" className="rec-block__title">안전일지 초안 JSON</span>
              <pre>{JSON.stringify({ ...log, summary: data.summary }, null, 2)}</pre>
            </section>
            {log.status === 'PENDING' && <p className="rec-note"><Icon name="clock" size={16} />승인 대기 중입니다. 승인 또는 회수는 승인함에서 처리합니다.</p>}
            {log.status === 'APPROVED' && <p className="rec-note rec-note--done"><Icon name="check" size={16} />승인 완료된 안전일지는 수정할 수 없습니다.</p>}
            {log.status === 'REJECTED' && <p className="rec-note rec-note--block"><Icon name="alert" size={16} />반려된 일지입니다. 승인함에서 반려 사유를 확인하세요.</p>}
          </>
        )}
      </div>
    </section>
  );
}

/** 일지에 붙은 확인 필요 항목 (종류별 건수 + 관련 기록 링크) */
function ChecksPanel({ data }) {
  const checks = data.log?.checks ?? [];
  return (
    <section className="home-panel" aria-labelledby="daily-checks-title">
      <header className="home-panel__head">
        <h2 id="daily-checks-title" className="home-panel__title">확인 필요 항목{data.log && <span className="home-panel__count">{checksTotal(checks)}</span>}</h2>
      </header>
      <div className="home-panel__body">
        {!data.log ? <p className="rec-pad rec-help">일지를 만들면 서버가 확인할 항목을 모아 보여 줍니다.</p>
          : !checks.length ? <StatusView kind="empty" compact title="확인할 미완료 항목이 없습니다" />
            : (
              <ul className="rec-checks">
                {checks.map((item) => (
                  <li key={item.type} className={item.overdue ? 'is-overdue' : ''}>
                    <div className="rec-checks__head">
                      <span className="rec-checks__label">{item.label || item.type}</span>
                      {item.overdue && <Badge tone="block">지연</Badge>}
                      <strong className="rec-checks__count">{item.count}<small>건</small></strong>
                    </div>
                    <RecordLinks entries={item.entries} />
                  </li>
                ))}
              </ul>
            )}
      </div>
    </section>
  );
}

function EvidencePanel({ log }) {
  if (!log?.evidence?.length) return null;
  return (
    <section className="home-panel" aria-labelledby="daily-evidence-title">
      <header className="home-panel__head"><h2 id="daily-evidence-title" className="home-panel__title">요약 근거 기록<span className="home-panel__count">{log.evidence.length}</span></h2></header>
      <div className="home-panel__body rec-pad"><RecordLinks entries={log.evidence} /></div>
    </section>
  );
}

function RecordLinks({ entries = [] }) {
  if (!entries?.length) return null;
  return (
    <ul className="rec-links">
      {entries.map((entry, index) => {
        const path = jobRecordPath(entry.targetType, entry.targetId);
        const label = entry.title || entry.label || `${entry.targetType} #${entry.targetId}`;
        return (
          <li key={`${entry.targetType}-${entry.targetId}-${index}`}>
            {path ? <Link to={path}>{label}</Link> : <span>{label}</span>}
            {entry.detail && <span className="rec-links__detail">{entry.detail}</span>}
          </li>
        );
      })}
    </ul>
  );
}

/** 승인자 화면 맨 위: 현장 미완료 항목 (대시보드 집계) */
function SiteItemsPanel({ data }) {
  const items = data.dashboard?.items ?? [];
  return (
    <section className="home-panel" aria-labelledby="daily-items-title">
      <header className="home-panel__head"><h2 id="daily-items-title" className="home-panel__title">현장 미완료 항목{data.dashboard && <span className="home-panel__count">{checksTotal(items)}</span>}</h2></header>
      {data.dashboardLoading ? <div className="home-panel__pad"><Skeleton lines={2} /></div>
        : !items.length ? <p className="rec-pad rec-help">확인할 미완료 항목이 없습니다.</p>
          : (
            <ul className="home-tiles rec-tiles">
              {items.map((item) => (
                <li key={item.type} className={`home-tile${item.count ? ' has-count' : ''}${item.overdue ? ' is-overdue' : ''}`}>
                  <span className="home-tile__label">{item.label || item.type}</span>
                  <span className="home-tile__row">
                    {item.overdue && <span className="home-tile__due"><Icon name="clock" size={11} />지연</span>}
                    <span className="home-tile__count">{item.count}<small>건</small></span>
                  </span>
                </li>
              ))}
            </ul>
          )}
    </section>
  );
}

function TeamsPanel({ data }) {
  const teams = (data.dashboard?.teams ?? []).map(teamRow);
  return (
    <section className="home-panel" aria-labelledby="daily-teams-title">
      <header className="home-panel__head"><h2 id="daily-teams-title" className="home-panel__title">팀별 작성 현황</h2></header>
      {!teams.length ? <p className="rec-pad rec-help">팀별 집계가 없습니다.</p> : (
        <table className="home-table rec-teams">
          <thead><tr><th scope="col">팀</th><th scope="col">안전일지</th><th scope="col">서명</th><th scope="col">측정값</th><th scope="col">사진</th></tr></thead>
          <tbody>
            {teams.map((team) => (
              <tr key={team.key}>
                <td data-label="팀">{team.name}</td>
                <td data-label="안전일지">{team.status ? <Badge tone={DAILY_LOG_TONES[team.status] ?? 'neutral'}>{DAILY_LOG_STATUS_LABELS[team.status] ?? team.status}</Badge> : '-'}</td>
                <td data-label="서명">{team.signatures}</td>
                <td data-label="측정값">{team.measurements}</td>
                <td data-label="사진">{team.photos}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
