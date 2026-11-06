import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useWorkSite } from '../../api/workers';
import JobPageLayout from '../../components/job-page-layout';
import PageHeader from '../../components/ui/page-header.jsx';
import { Badge } from '../../components/home/panel.jsx';
import Icon from '../../components/ui/icon.jsx';
import StatusView, { Skeleton } from '../../components/ui/status-view.jsx';
import { useWorkStatus } from '../../hooks/use-work-status.js';
import { APPROVAL_TARGET_LABELS, tileValue, todoTiles, todoTotal } from '../../utils/home-model.js';
import { localDate } from '../../utils/job-forms';
import { shiftDate } from '../../utils/daily-log-model.js';
import { clockOf, deadlineRows, entryPath, statusSegments, summaryBars, summaryTotals, teamRows } from '../../utils/status-model.js';
import '../../styles/home.css';
import '../../styles/work.css';
import '../../styles/records.css';
import '../../styles/tbm.css';
import '../../styles/status.css';

const RANGES = [7, 14, 30];

/**
 * 작업 현황. 고른 날짜의 현장 현황(작업 수·상태·마감·미완료 9종·팀별)과 그날로 끝나는 기간 추이.
 * 값은 모두 서버 대시보드 집계이고 화면에서 새로 세지 않는다.
 */
export default function JobDashboard() {
  const context = useWorkSite();
  const site = context.currentSite;
  return (
    <JobPageLayout title="작업 현황" user={context.account?.user} contentClassName="work-page">
      {site
        ? <StatusPage key={site.siteId} site={site} context={context} />
        : <PageHeader title="작업 현황" context={context} />}
    </JobPageLayout>
  );
}

function StatusPage({ site, context }) {
  const data = useWorkStatus({ siteId: site.siteId, initialDate: localDate(), disabled: context.selecting || context.loading });
  const dashboard = data.dashboard;
  const tiles = todoTiles(dashboard?.items);
  const [openType, setOpenType] = useState(null);
  const open = tiles.find((tile) => tile.type === openType && tile.count > 0) ?? tiles.find((tile) => tile.count > 0) ?? null;

  return (
    <div className="work-list rec-page status-page">
      <PageHeader title="작업 현황" description="현장의 하루 작업과 마감 전에 끝내야 할 일을 한눈에 봅니다. 숫자는 서버 집계입니다." context={context}
        actions={<>
          <button type="button" className="ui-btn ui-btn--ghost" onClick={data.reload}><Icon name="refresh" size={16} />새로고침</button>
          <Link className="ui-btn ui-btn--primary" to="/job/workspace">작업 목록</Link>
        </>} />

      <section className="work-filters rec-datebar" aria-label="기준일">
        <div className="rec-datebar__nav">
          <button type="button" className="ui-icon-btn" aria-label="전날" onClick={() => data.changeDate(shiftDate(data.date, -1))}><Icon name="chevronLeft" size={18} /></button>
          <label><span className="sr-only">기준일</span><input type="date" max="9999-12-31" value={data.date} onChange={(event) => data.changeDate(event.target.value)} /></label>
          <button type="button" className="ui-icon-btn rec-datebar__next" aria-label="다음 날" onClick={() => data.changeDate(shiftDate(data.date, 1))}><Icon name="chevronLeft" size={18} /></button>
          {data.date !== localDate() && <button type="button" className="ui-btn ui-btn--ghost" onClick={() => data.changeDate(localDate())}>오늘</button>}
        </div>
        {!dashboard && !data.dayError && (
          <ul className="status-deadlines" aria-hidden="true">
            {['TBM 마감', '안전일지 마감', '결재 처리 기한'].map((label) => <li key={label}><span>{label}</span><strong>—</strong></li>)}
          </ul>
        )}
        {dashboard && (
          <ul className="status-deadlines" aria-label="마감 시각">
            {deadlineRows(dashboard.deadlines).map((row) => (
              <li key={row.key} className={row.passed ? 'is-passed' : ''}><span>{row.label}</span><strong>{row.time || '미설정'}</strong>{row.passed && <Badge tone="block">지남</Badge>}</li>
            ))}
            {dashboard.now && <li className="status-deadlines__now"><span>집계 시각</span><strong>{clockOf(dashboard.now)}</strong></li>}
          </ul>
        )}
      </section>

      {!data.dayLoading && data.dayError && <section className="home-panel"><StatusView kind="error" message={data.dayError} onRetry={data.reload} /></section>}

      {/* 불러오는 동안에도 같은 틀을 그려 둔다 (숫자만 "—"). 받은 뒤 아래 칸이 밀리지 않게 */}
      {!data.dayError && (
        <>
          <section className="status-kpis" aria-label={`${data.date} 요약`} aria-busy={!dashboard}>
            <Kpi label="작업" value={dashboard?.works.total} unit="건" hint="취소 제외" />
            <Kpi label="차단" value={dashboard?.works.blocked} unit="건" tone={dashboard?.works.blocked ? 'block' : ''} hint="규칙 판정 차단" />
            <Kpi label="미완료" value={dashboard ? todoTotal(tiles) : undefined} unit="건" tone={dashboard && todoTotal(tiles) ? 'warn' : ''} hint="9개 항목 합계" />
            <Kpi label="지연 항목" value={dashboard ? tiles.filter((tile) => tile.overdue).length : undefined} unit="종" tone={tiles.some((tile) => tile.overdue) ? 'block' : ''} hint="마감 지난 항목 종류" />
          </section>

          <section className="home-panel status-card" aria-labelledby="status-works">
            <header className="tbm-card__head"><div><h2 id="status-works">작업 상태</h2><p className="rec-help">{data.date} · 작업 {dashboard ? dashboard.works.total : '—'}건</p></div></header>
            {dashboard ? <StatusBar byStatus={dashboard.works.byStatus} total={dashboard.works.total} /> : <div className="status-bar status-bar--wait"><Skeleton lines={2} /></div>}
          </section>

          <div className="status-grid">
            <section className="home-panel status-card" aria-labelledby="status-todo">
              <header className="tbm-card__head"><div><h2 id="status-todo">미완료 항목</h2><p className="rec-help">항목을 누르면 아래에 대상 목록이 열립니다.</p></div></header>
              <ul className="home-tiles status-tiles">
                {tiles.map((tile) => (
                  <li key={tile.type}>
                    <button type="button" className={`home-tile${tile.count ? ' has-count' : ''}${tile.overdue ? ' is-overdue' : ''}${open?.type === tile.type ? ' is-open' : ''}`}
                      aria-pressed={open?.type === tile.type} disabled={!tile.count} onClick={() => setOpenType(tile.type)}>
                      <span className="home-tile__label">{tile.fullLabel}</span>
                      <span className="home-tile__row">{tile.overdue && <span className="home-tile__due">지연</span>}<span className={`home-tile__count${dashboard && tileValue(tile).word ? ' home-tile__count--word' : ''}`}>{dashboard ? tileValue(tile).text : '—'}{(!dashboard || tileValue(tile).unit) && <small>{dashboard ? tileValue(tile).unit : '건'}</small>}</span></span>
                    </button>
                  </li>
                ))}
              </ul>
              {!dashboard ? <div className="status-entries status-entries--wait"><Skeleton lines={3} /></div>
                : open ? <EntryList tile={open} date={data.date} /> : <p className="rec-note status-allclear"><Icon name="check" size={16} />이 날짜에 남은 미완료 항목이 없습니다.</p>}
            </section>

            <section className="home-panel status-card" aria-labelledby="status-teams">
              <header className="tbm-card__head"><div><h2 id="status-teams">팀별</h2><p className="rec-help">미완료·차단이 많은 팀부터</p></div></header>
              {!dashboard ? <div className="status-pad"><Skeleton lines={3} /></div> : dashboard.teams?.length ? (
                <div className="status-table-wrap">
                  <table className="status-table">
                    <thead><tr><th scope="col">팀</th><th scope="col">작업</th><th scope="col">차단</th><th scope="col">미완료</th></tr></thead>
                    <tbody>{teamRows(dashboard.teams).map((team) => (
                      <tr key={team.teamId ?? 'none'}>
                        <th scope="row">{team.teamName || '팀 미지정'}</th>
                        <td>{team.works}</td>
                        <td className={team.blocked ? 'is-block' : ''}>{team.blocked}</td>
                        <td className={team.incomplete ? 'is-warn' : ''}>{team.incomplete}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              ) : <p className="rec-help status-pad">이 날짜에 작업이 없습니다.</p>}
            </section>
          </div>
        </>
      )}

      <PeriodPanel data={data} />
    </div>
  );
}

function Kpi({ label, value, unit, tone = '', hint }) {
  return (
    <div className={`status-kpi${tone ? ` is-${tone}` : ''}`}>
      <span className="status-kpi__label">{label}</span>
      <strong className="status-kpi__value">{value ?? '—'}<small>{unit}</small></strong>
      <span className="status-kpi__hint">{hint}</span>
    </div>
  );
}

function StatusBar({ byStatus, total }) {
  const segments = statusSegments(byStatus);
  if (!total) return <p className="rec-help status-pad">이 날짜에 등록된 작업이 없습니다.</p>;
  return (
    <div className="status-bar">
      <div className="status-bar__track" role="img" aria-label={segments.map((segment) => `${segment.label} ${segment.count}건`).join(', ')}>
        {segments.map((segment) => (
          <span key={segment.status} className={`status-bar__seg is-${segment.tone}`} style={{ flexGrow: segment.count }} title={`${segment.label} ${segment.count}건`} />
        ))}
      </div>
      <ul className="status-bar__legend">
        {segments.map((segment) => (
          <li key={segment.status}><span className={`status-bar__dot is-${segment.tone}`} aria-hidden="true" />{segment.label}<strong>{segment.count}</strong></li>
        ))}
      </ul>
    </div>
  );
}

function EntryList({ tile, date }) {
  return (
    <div className="status-entries">
      <h3>{tile.fullLabel} <span className="home-panel__count">{tile.count}</span></h3>
      <ul>
        {tile.entries.map((entry, index) => {
          const path = entryPath(entry, date);
          const body = (
            <>
              <span className="status-entry__main">
                <span className="status-entry__kind">{APPROVAL_TARGET_LABELS[entry.targetType] ?? entry.targetType}{entry.targetId ? ` #${entry.targetId}` : ''}</span>
                <span className="status-entry__title">{entry.title}</span>
                {entry.detail && <span className="rec-help">{entry.detail}</span>}
              </span>
              <span className="status-entry__side">
                {entry.dueAt && <span className="rec-help">마감 {clockOf(entry.dueAt)}</span>}
                {entry.overdue && <Badge tone="block">지연</Badge>}
                {path && <Icon name="chevronLeft" size={16} className="status-entry__go" />}
              </span>
            </>
          );
          return (
            <li key={`${entry.targetType}:${entry.targetId}:${index}`}>
              {path ? <Link className="status-entry" to={path}>{body}</Link> : <div className="status-entry">{body}</div>}
            </li>
          );
        })}
      </ul>
      {tile.entries.some((entry) => !entryPath(entry, date)) && <p className="rec-help">개선조치는 아직 웹에 전용 화면이 없어 목록만 보여 줍니다.</p>}
    </div>
  );
}

function PeriodPanel({ data }) {
  const { days } = summaryBars(data.summary);
  const current = data.summary?.current;
  return (
    <section className="home-panel status-card" aria-labelledby="status-period">
      <header className="tbm-card__head">
        <div><h2 id="status-period">기간 추이</h2><p className="rec-help">{data.date}까지 {data.rangeDays}일 · 작업일 기준</p></div>
        <div className="permit-check__options status-range" role="group" aria-label="기간">
          {RANGES.map((range) => <button key={range} type="button" className="permit-check__btn is-unknown" aria-pressed={data.rangeDays === range} onClick={() => data.setRangeDays(range)}>{range}일</button>)}
        </div>
      </header>
      {data.periodLoading && <div className="status-pad"><Skeleton lines={4} /></div>}
      {!data.periodLoading && data.periodError && <StatusView kind="error" compact message={data.periodError} onRetry={data.reload} />}
      {data.summary && (
        <>
          {current && (
            <ul className="status-current" aria-label="지금 기준 현황">
              <li className={current.correctiveOpen ? 'is-warn' : ''}><span>개선조치 미완료</span><strong>{current.correctiveOpen}</strong></li>
              <li className={current.correctiveOverdue ? 'is-block' : ''}><span>개선조치 기한 지남</span><strong>{current.correctiveOverdue}</strong></li>
              <li className={current.approvalOverdue ? 'is-block' : ''}><span>승인 지연</span><strong>{current.approvalOverdue}</strong></li>
            </ul>
          )}
          <div className="status-charts">
            <Chart title="날짜별 작업" days={days} value={(day) => day.works} part={(day) => day.blocked}
              legend={[['is-primary', '작업'], ['is-block', '그중 차단']]} />
            <Chart title="날짜별 미완료" days={days} value={(day) => day.incomplete} tone="is-warn" />
          </div>
          <details className="status-totals">
            <summary>기간 합계 표 보기</summary>
            <table className="status-table">
              <thead><tr><th scope="col">항목</th><th scope="col">기간 합계</th></tr></thead>
              <tbody>{summaryTotals(data.summary.totals).map((row) => <tr key={row.type}><th scope="row">{row.label}</th><td>{row.count}{row.type === 'DAILY_LOG_MISSING' ? '일' : '건'}</td></tr>)}</tbody>
            </table>
            <table className="status-table">
              <thead><tr><th scope="col">날짜</th><th scope="col">작업</th><th scope="col">차단</th><th scope="col">미완료</th></tr></thead>
              <tbody>{days.map((day) => <tr key={day.date}><th scope="row">{day.date}</th><td>{day.works}</td><td>{day.blocked}</td><td>{day.incomplete}</td></tr>)}</tbody>
            </table>
          </details>
        </>
      )}
    </section>
  );
}

/** 날짜별 세로 막대 (한 축). part 가 있으면 막대 아래쪽을 그 값만큼 다른 색으로 */
function Chart({ title, days, value, part, tone = 'is-primary', legend }) {
  const dense = days.length > 14;
  const max = Math.max(1, ...days.map(value));
  return (
    <figure className="status-chart">
      <figcaption>
        <span>{title}</span>
        {legend && <span className="status-chart__legend">{legend.map(([cls, text]) => <span key={text}><i className={cls} aria-hidden="true" />{text}</span>)}</span>}
      </figcaption>
      <div className={`status-chart__plot${dense ? ' is-dense' : ''}`}>
        {days.map((day) => {
          const total = value(day);
          const low = part ? Math.min(part(day), total) : 0;
          const label = `${day.date} ${title.replace('날짜별 ', '')} ${total}건${part ? ` (차단 ${low}건)` : ''}`;
          return (
            <div key={day.date} className="status-chart__col" title={label} aria-label={label} role="img" tabIndex={0}>
              <span className="status-chart__value">{total || ''}</span>
              <span className="status-chart__bar" style={{ height: `${(total / max) * 100}%` }}>
                {total > 0 && <span className={`status-chart__fill ${tone}`} style={{ flexGrow: total - low }} />}
                {low > 0 && <span className="status-chart__fill is-block" style={{ flexGrow: low }} />}
              </span>
              <span className="status-chart__x">{day.label}</span>
            </div>
          );
        })}
      </div>
    </figure>
  );
}
