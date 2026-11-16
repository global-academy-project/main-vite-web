import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../ui/icon.jsx';
import Panel, { Badge } from './panel.jsx';
import { TypeBadge, WorksTable } from './home-panels.jsx';
import { useScheduleWorks } from '../../hooks/use-schedule-works.js';
import { nextAction, timeRange, workStages } from '../../utils/home-model.js';
import {
  byDay, clockOf, dayColumns, dayLabel, filterByType, hasTime, hourRange, layoutBlocks, minutesOf, monthCells, rangeLabel,
  SCHEDULE_VIEWS, shiftAnchor, TYPE_FILTERS, TYPE_KEYS, weekDays, weekdayOf,
} from '../../utils/schedule-model.js';

const HOUR = 52; // 하루 보기 1시간 높이(px)
const MONTH_CHIPS = 3;

/**
 * 일정 카드 (11/13 홈 2안). 하루(구역별 시간표) · 주간 · 월간 · 목록. 종류 필터, 시간 미정, 지금 시각 선, TBM 마감 선.
 * 블록을 누르면 요약 창. 모바일은 시간표 폭이 모자라 목록·월간만 (기본 목록).
 * 데이터는 작업 목록 API 만 쓴다(use-schedule-works). 목록 보기는 예전 "오늘 작업" 표 그대로.
 */
export default function SchedulePanel({ siteId, today, todayWorks, zones, deadlines, highlightId, view, onView, mobile, revision, onRetry, grip, collapse }) {
  const [anchor, setAnchor] = useState(today);
  const [type, setType] = useState('ALL');
  const [opened, setOpened] = useState(null);
  const shownView = mobile && (view === 'day' || view === 'week') ? 'list' : view;
  const { section } = useScheduleWorks(siteId, shownView === 'list' ? 'day' : shownView, anchor, today, todayWorks, revision);
  const works = useMemo(() => filterByType(section.data ?? [], type), [section.data, type]);
  const views = mobile ? SCHEDULE_VIEWS.filter((item) => item.key === 'list' || item.key === 'month') : SCHEDULE_VIEWS;
  const step = (delta) => { setOpened(null); setAnchor((current) => shiftAnchor(shownView === 'list' ? 'day' : shownView, current, delta)); };
  const openDay = (date) => { setAnchor(date); setOpened(null); onView(mobile ? 'list' : 'day'); };
  const zoneList = zones.data ?? [];

  const toolbar = (
    <div className="home-cal__bar">
      <span className="home-cal__label">{rangeLabel(shownView === 'list' ? 'day' : shownView, anchor)}</span>
      <span className="home-cal__nav" role="group" aria-label="날짜 이동">
        <button type="button" className="home-cal__round" aria-label="이전" onClick={() => step(-1)}><Icon name="chevronLeft" size={16} /></button>
        <button type="button" className={`home-cal__today${anchor === today ? ' is-on' : ''}`} onClick={() => { setAnchor(today); setOpened(null); }}>오늘</button>
        <button type="button" className="home-cal__round" aria-label="다음" onClick={() => step(1)}><Icon name="chevronRight" size={16} /></button>
      </span>
      <span className="home-cal__views" role="group" aria-label="보기">
        {views.map((item) => (
          <button key={item.key} type="button" aria-pressed={shownView === item.key} className={shownView === item.key ? 'is-on' : ''} onClick={() => { setOpened(null); onView(item.key); }}>{item.label}</button>
        ))}
      </span>
    </div>
  );
  const undated = shownView === 'day' ? works.filter((work) => !hasTime(work)) : [];
  const filters = (
    <div className="home-cal__filters">
      <span className="home-cal__types" role="group" aria-label="작업 종류">
        {TYPE_FILTERS.map((item) => (
          <button key={item.key} type="button" aria-pressed={type === item.key} className={`home-chip${type === item.key ? ' is-on' : ''}`} onClick={() => setType(item.key)}>
            {item.key !== 'ALL' && <i className={`home-legend__sw home-legend__sw--${TYPE_KEYS[item.key]}`} aria-hidden="true" />}{item.label}
          </button>
        ))}
      </span>
      {undated.length > 0 && (
        <span className="home-cal__undated">
          <b>시간 미정</b>
          {undated.map((work) => <button key={work.workId} type="button" className="home-cal__undated-chip" onClick={() => setOpened(work)}>{work.title}</button>)}
        </span>
      )}
      {/* 작업 목록 링크는 종류 버튼 줄 오른쪽 끝 (칸이 좁아도 혼자 한 줄을 차지하지 않게) */}
      <Link className="home-panel__link home-cal__more" to="/job/workspace">작업 목록<Icon name="chevronRight" size={14} /></Link>
    </div>
  );

  const count = section.status === 'ready' ? works.length : null;
  const isEmpty = section.status === 'ready' && !works.length && shownView !== 'month' && shownView !== 'week';
  return (
    <Panel id="schedule" title="일정" grip={grip} collapse={collapse} count={count} section={section} onRetry={onRetry} className="home-cal"
      // PC·태블릿: 날짜·보기 줄을 제목 "일정" 바로 오른쪽(머리)에 붙여 달력 칸을 한 줄 더 쓴다. 모바일은 예전처럼 머리 아래
      actions={mobile ? null : toolbar}
      toolbar={<div className="home-cal__tools">{mobile && toolbar}{filters}</div>}
      isEmpty={isEmpty}
      empty={{ title: anchor === today ? '오늘 등록된 작업이 없습니다' : `${dayLabel(anchor)} 작업이 없습니다`, message: 'AI 도우미에게 말하거나 단계별로 등록하세요.', action: { label: '작업 등록', onClick: () => document.getElementById('home-composer')?.focus() } }}>
      {shownView === 'day' && <DayView works={works.filter(hasTime)} zones={zoneList} isToday={anchor === today} tbmDeadline={anchor === today ? deadlines?.tbmDeadline : null} highlightId={highlightId} onOpen={setOpened} />}
      {shownView === 'week' && <WeekView works={works} anchor={anchor} today={today} highlightId={highlightId} onOpen={setOpened} onDay={openDay} />}
      {shownView === 'month' && <MonthView works={works} anchor={anchor} today={today} onDay={openDay} />}
      {shownView === 'list' && <WorksTable rows={works} zones={zoneList} highlightId={highlightId} />}
      {opened && <WorkSummary work={opened} zones={zoneList} onClose={() => setOpened(null)} />}
    </Panel>
  );
}

/** 하루: 구역 열 × 시간 */
function DayView({ works, zones, isToday, tbmDeadline, highlightId, onOpen }) {
  const columns = dayColumns(works, zones);
  const [startHour, endHour] = hourRange(works);
  const now = useNow(isToday);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const tbmMin = minutesOf(tbmDeadline);
  const top = (minutes) => ((minutes - startHour * 60) / 60) * HOUR;
  const height = (endHour - startHour) * HOUR;
  // 오늘이면 처음 그릴 때 지금 시각 조금 위로 스크롤 (한 번만)
  const firstTop = isToday ? Math.max(0, top(nowMin) - HOUR * 1.5) : 0;
  const scrolled = useRef(false);
  const scroller = (node) => { if (node && !scrolled.current) { scrolled.current = true; node.scrollTop = firstTop; } };
  if (!columns.length) return <p className="home-cal__none">시간이 정해진 작업이 없습니다.</p>;
  const hours = Array.from({ length: endHour - startHour + 1 }, (_, index) => startHour + index);
  return (
    <div className="home-day" ref={scroller} style={{ '--cols': columns.length }}>
      <div className="home-day__head" aria-hidden="true">
        <span />
        {columns.map((column) => <span key={column.key} className="home-day__zone">{column.name}</span>)}
      </div>
      <div className="home-day__grid" style={{ height }}>
        <div className="home-day__hours" aria-hidden="true">
          {hours.map((hour) => <span key={hour} style={{ top: top(hour * 60) }}>{String(hour).padStart(2, '0')}</span>)}
        </div>
        {hours.map((hour) => <i key={hour} className="home-day__line" style={{ top: top(hour * 60) }} aria-hidden="true" />)}
        {columns.map((column, index) => (
          <ul key={column.key} className="home-day__col" style={{ gridColumn: index + 2 }} aria-label={column.name}>
            {layoutBlocks(works.filter((work) => (work.zoneId ?? null) === column.zoneId)).map((item) => (
              <li key={item.work.workId} className="home-day__slot" style={{ top: top(item.start), height: Math.max(26, ((item.end - item.start) / 60) * HOUR - 4), left: `calc(${(item.lane / item.lanes) * 100}% + 3px)`, width: `calc(${100 / item.lanes}% - 6px)` }}>
                <Block work={item.work} highlight={item.work.workId === highlightId} onOpen={onOpen} size={item.end - item.start < 75 ? 'short' : item.end - item.start < 120 ? 'mid' : ''} />
              </li>
            ))}
          </ul>
        ))}
        {tbmMin != null && tbmMin >= startHour * 60 && tbmMin <= endHour * 60 && (
          <div className="home-day__mark home-day__mark--tbm" style={{ top: top(tbmMin) }}><span>TBM 마감 {clockOf(tbmMin)}</span></div>
        )}
        {isToday && nowMin >= startHour * 60 && nowMin <= endHour * 60 && (
          <div className="home-day__mark home-day__mark--now" style={{ top: top(nowMin) }}><span>{clockOf(nowMin)}</span></div>
        )}
      </div>
    </div>
  );
}

/** 시간표 블록: 이름 · 시간 · 지금 할 일. 좁으면 이름·상태만 (CSS 컨테이너 쿼리) */
function Block({ work, highlight, onOpen, compact = false, size = '' }) {
  const next = nextAction(work);
  const typeKey = TYPE_KEYS[work.workType] ?? 'general';
  const blocked = next.tone === 'block';
  return (
    <button type="button" className={`home-block home-block--${typeKey}${blocked ? ' is-blocked' : ''}${highlight ? ' is-new' : ''}${compact ? ' is-compact' : ''}${size ? ` is-${size}` : ''}`}
      onClick={() => onOpen(work)} aria-label={`${work.title} ${timeRange(work.startAt, work.endAt)} ${next.label} — 요약 열기`}>
      <span className="home-block__title">{work.title}</span>
      <span className="home-block__time">{timeRange(work.startAt, work.endAt)}</span>
      {!compact && <span className={`home-block__next home-block__next--${next.tone}`}>{next.label}</span>}
    </button>
  );
}

/** 주간: 요일 7칸, 칸 안은 시작 시각 순 */
function WeekView({ works, anchor, today, highlightId, onOpen, onDay }) {
  const days = weekDays(anchor);
  const map = byDay(works);
  return (
    <div className="home-week">
      {days.map((date) => (
        <section key={date} className={`home-week__day${date === today ? ' is-today' : ''}`} aria-label={dayLabel(date)}>
          <button type="button" className="home-week__head" onClick={() => onDay(date)} title="이 날 하루 보기">
            <span>{weekdayOf(date)}</span><b>{Number(date.slice(8, 10))}</b>
            {(map[date]?.length ?? 0) > 0 && <small>{map[date].length}</small>}
          </button>
          <ul className="home-week__list">
            {(map[date] ?? []).map((work) => <li key={work.workId}><Block work={work} compact highlight={work.workId === highlightId} onOpen={onOpen} /></li>)}
          </ul>
        </section>
      ))}
    </div>
  );
}

/** 월간: 칸마다 작업 3개까지 + 나머지 수. 날짜를 누르면 그 날로 */
function MonthView({ works, anchor, today, onDay }) {
  const map = byDay(works);
  return (
    <div className="home-month">
      <div className="home-month__weekdays" aria-hidden="true">{['일', '월', '화', '수', '목', '금', '토'].map((day) => <span key={day}>{day}</span>)}</div>
      <div className="home-month__grid">
        {monthCells(anchor).map((cell) => {
          const list = map[cell.date] ?? [];
          return (
            <button key={cell.date} type="button" className={`home-month__cell${cell.outside ? ' is-outside' : ''}${cell.date === today ? ' is-today' : ''}`}
              onClick={() => onDay(cell.date)} aria-label={`${dayLabel(cell.date)} 작업 ${list.length}건`}>
              <span className="home-month__date">{Number(cell.date.slice(8, 10))}</span>
              {list.slice(0, MONTH_CHIPS).map((work) => (
                <span key={work.workId} className={`home-month__chip home-month__chip--${TYPE_KEYS[work.workType] ?? 'general'}`}>{work.title}</span>
              ))}
              {list.length > MONTH_CHIPS && <span className="home-month__more">+{list.length - MONTH_CHIPS}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** 블록 요약 창: 진행 단계 · 지금 할 일 · 작업 허브로 */
function WorkSummary({ work, zones, onClose }) {
  const titleId = useId();
  const panel = useRef(null);
  const stages = workStages(work);
  const next = nextAction(work);
  const zone = zones.find((item) => item.zoneId === work.zoneId)?.name ?? (work.zoneId ? `구역 #${work.zoneId}` : '구역 미지정');
  useEffect(() => {
    const returnTo = document.activeElement;
    panel.current?.focus();
    const onKey = (event) => { if (event.key === 'Escape') { event.stopPropagation(); onClose(); } };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); if (returnTo?.focus && document.contains(returnTo)) returnTo.focus(); };
  }, [onClose]);
  return (
    <div className="home-pop" role="dialog" aria-labelledby={titleId} tabIndex={-1} ref={panel}>
      <div className="home-pop__head">
        <TypeBadge type={work.workType} highRisk={work.highRisk} />
        <h3 id={titleId}>{work.title}</h3>
        <button type="button" className="ui-icon-btn" aria-label="요약 닫기" onClick={onClose}><Icon name="close" size={16} /></button>
      </div>
      <p className="home-pop__facts">{[work.workDate && dayLabel(work.workDate), timeRange(work.startAt, work.endAt) || '시간 미정', zone, work.workerCount != null ? `${work.workerCount}명` : ''].filter(Boolean).join(' · ')}</p>
      <ol className="home-pop__stages">
        {stages.map((stage) => (
          <li key={stage.key}><span className={`home-dot home-dot--${stage.state}`} aria-hidden="true" /><b>{stage.label}</b><span>{stage.hint || (stage.state === 'skip' ? '해당 없음' : '')}</span></li>
        ))}
      </ol>
      <div className="home-pop__actions">
        {next.path ? <Link to={next.path} className={`home-next home-next--${next.tone}`}>{next.label}</Link> : <Badge tone={next.tone}>{next.label}</Badge>}
        <Link to={`/job/workspace?workId=${work.workId}`} className="ui-btn ui-btn--ghost ui-btn--sm">작업 허브 열기</Link>
      </div>
    </div>
  );
}

/** 지금 시각 (1분마다) */
function useNow(active) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (!active) return undefined;
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, [active]);
  return now;
}
