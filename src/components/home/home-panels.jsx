import { useState } from 'react';
import { Link } from 'react-router-dom';
import StatusView, { Skeleton } from '../ui/status-view.jsx';
import Icon from '../ui/icon.jsx';
import Panel, { Badge } from './panel.jsx';
import {
  tileValue, APPROVAL_TARGET_LABELS, nextAction, timeRange, todoTiles, todoTotal, toneOf, typeCounts, WORK_TYPE_LABELS, workStages,
} from '../../utils/home-model.js';
import { TYPE_KEYS } from '../../utils/schedule-model.js';
import { workStats } from '../../utils/work-list-model.js';

const hm = (value) => (typeof value === 'string' && value.length >= 16 ? value.slice(11, 16) : '');

/** 오늘 할 일: 대시보드 미완료 9종 + 마감 시각 */
export function TodoPanel({ section, onRetry, grip, collapse }) {
  const tiles = todoTiles(section.data?.items);
  const deadlines = section.data?.deadlines;
  return (
    <Panel id="todo" title="오늘 할 일" grip={grip} collapse={collapse} count={section.status === 'ready' ? todoTotal(tiles) : null} section={section} onRetry={onRetry} className="home-todo">
      {deadlines && (
        <div className="home-deadlines">
          <span className={deadlines.tbmPassed ? 'is-passed' : ''}><Icon name="clock" size={14} />TBM 마감 {hm(deadlines.tbmDeadline)}{deadlines.tbmPassed && ' · 지남'}</span>
          <span className={deadlines.dailyLogPassed ? 'is-passed' : ''}><Icon name="clock" size={14} />안전일지 {hm(deadlines.dailyLogDeadline)}{deadlines.dailyLogPassed && ' · 지남'}</span>
        </div>
      )}
      <ul className="home-tiles">
        {tiles.map((tile) => {
          const value = tileValue(tile, section.data);
          return (
            <li key={tile.type}>
              <Link to={tile.path} className={`home-tile${tile.count ? ' has-count' : ''}${tile.overdue ? ' is-overdue' : ''}`} title={tile.fullLabel}>
                <span className="home-tile__label">{tile.label}</span>
                <span className="home-tile__row">
                  {tile.overdue && <span className="home-tile__due"><Icon name="clock" size={12} />지남</span>}
                  <span className={`home-tile__count${value.word ? ' home-tile__count--word' : ''}`}>{value.text}{value.unit && <small>{value.unit}</small>}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

/**
 * 작업 종류 배지 (종류 색, 글자 같이). highRisk: 서버 고위험 표시(종류와 따로 온다).
 * PR1 까지는 배지 색(주황/회색)으로 보였던 정보라, 종류 색으로 바꾼 뒤에도 주황 경고 아이콘으로 남긴다.
 */
export function TypeBadge({ type, highRisk = false }) {
  const badge = <span className={`home-type home-type--${TYPE_KEYS[type] ?? 'general'}`}>{WORK_TYPE_LABELS[type] ?? type ?? '종류 없음'}</span>;
  // 표 칸이 좁아 글자 배지 대신 주황 경고 아이콘 하나 (마우스를 올리면 "고위험", 화면 읽기도 "고위험")
  return highRisk ? <span className="home-type-wrap">{badge}<span className="home-type-risk" title="고위험"><Icon name="warning" size={14} /><span className="sr-only">고위험</span></span></span> : badge;
}

/** 작업 현황: 진행 칸별 건수(작업 목록과 같은 기준) + 종류별 한 줄 막대(종류 색) */
export function WorkStatusPanel({ dashboard, works, onRetry, grip, collapse }) {
  // 서버 작업 상태(byStatus)는 작업 승인·종료 API 가 없어 "작성 중"에서 바뀌지 않아, 오늘 작업 목록으로 진행 칸을 센다
  const stages = workStats(works.data ?? []).filter((stat) => stat.key !== 'ALL');
  const counts = typeCounts(works.data ?? []);
  const total = counts.reduce((sum, item) => sum + item.count, 0);
  const summary = counts.map((item) => `${item.label} ${item.count}`).join(', ');
  return (
    <Panel id="status" title="작업 현황" tag="오늘" grip={grip} collapse={collapse} count={dashboard.data?.works?.total} section={dashboard.status !== 'ready' ? dashboard : works} onRetry={onRetry} link="/job/dashboard" className="home-status">
      <div className="home-status__grid">
        <ul className="home-stats">
          {stages.map((stat) => (
            <li key={stat.key} className={`home-stat home-stat--${stat.tone}`}>
              <span className="home-stat__label"><i aria-hidden="true" />{stat.label}</span>
              <strong className="home-stat__value">{stat.value}</strong>
            </li>
          ))}
        </ul>
        <div className="home-mix" role="img" aria-label={`종류별 작업: ${summary}`}>
          {total ? counts.filter((item) => item.count).map((item) => (
            <span key={item.type} className={`home-mix__part home-mix__part--${TYPE_KEYS[item.type]}`} style={{ flexGrow: item.count }} />
          )) : <span className="home-mix__part home-mix__part--empty" />}
        </div>
        <ul className="home-legend" aria-hidden="true">
          {counts.map((item) => (
            <li key={item.type}><i className={`home-legend__sw home-legend__sw--${TYPE_KEYS[item.type]}`} />{item.type === 'CONFINED' ? '밀폐' : item.label} {item.count}</li>
          ))}
        </ul>
      </div>
    </Panel>
  );
}

/** 작업 목록 (일정 카드 "목록" 보기): PC 표 / 모바일 카드. 방금 AI 가 만든 작업은 강조 */
const MOBILE_ROWS = 5;
const APPROVAL_ROWS = 20;

export function WorksTable({ rows, zones, highlightId, dateColumn = false }) {
  // 모바일은 카드가 길어지지 않게 5건만 먼저 보이고 "더 보기"로 펼친다 (PC·태블릿은 카드 안에서 스크롤)
  const [expanded, setExpanded] = useState(false);
  const hidden = expanded ? 0 : Math.max(0, rows.length - MOBILE_ROWS);
  const zoneName = (id) => zones?.find((zone) => zone.zoneId === id)?.name ?? (id ? `구역 #${id}` : '구역 미지정');
  return (
    <>
      <table className={`home-table${hidden ? ' home-table--collapsed' : ''}`}>
        <thead>
          <tr>
            <th scope="col">작업</th><th scope="col">종류</th>
            <th scope="col"><span className="sr-only">진행</span><span className="home-pgh" aria-hidden="true">{workStages({}).map((stage) => <span key={stage.key}>{stage.label}</span>)}</span></th>
            <th scope="col">지금 할 일</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((work) => {
            const stages = workStages(work);
            const next = nextAction(work);
            const hub = `/job/workspace?workId=${work.workId}`;
            const day = dateColumn && work.workDate ? `${Number(work.workDate.slice(5, 7))}/${Number(work.workDate.slice(8, 10))}` : '';
            const facts = [day, zoneName(work.zoneId), timeRange(work.startAt, work.endAt), work.workerCount != null ? `${work.workerCount}명` : ''].filter(Boolean).join(' · ');
            return (
              <tr key={work.workId} className={work.workId === highlightId ? 'is-new' : ''}>
                <td data-label="작업">
                  <span className="home-table__name">
                    <Link to={hub} className="home-table__title">{work.title}</Link>
                    {work.workId === highlightId && <Badge tone="wait">방금 생성</Badge>}
                  </span>
                  <span className={`home-table__facts${work.zoneId ? '' : ' is-warn'}`}>{facts}</span>
                </td>
                <td data-label="종류"><TypeBadge type={work.workType} highRisk={work.highRisk} /></td>
                <td data-label="진행">
                  <span className="home-dots" role="img" aria-label={stages.map((stage) => `${stage.label} ${stage.hint || stage.state}`).join(', ')}>
                    {stages.map((stage) => (
                      <span key={stage.key} className="home-dots__cell" title={`${stage.label} · ${stage.hint || ''}`}>
                        <span className={`home-dot home-dot--${stage.state}`} />
                        <small aria-hidden="true">{stage.label}</small>
                      </span>
                    ))}
                  </span>
                </td>
                <td data-label="지금 할 일">
                  {next.path ? <Link to={next.path} className={`home-next home-next--${next.tone}`}>{next.label}</Link> : <Badge tone={next.tone}>{next.label}</Badge>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {hidden > 0 && <button type="button" className="home-more" onClick={() => setExpanded(true)}>나머지 {hidden}건 더 보기<Icon name="chevronDown" size={16} /></button>}
    </>
  );
}

/**
 * 위 오른쪽 칸: 제목형 탭 "승인함 | 위험·주의" (11/14 탭 C안). 승인함 안은 밑줄형 "결재 대기 / 내 요청".
 * 승인함 쪽 제목·버튼·자리는 역할과 상관없이 같고, 처음 열리는 목록만 역할에 따라 다르다.
 */
export function SidePanel({ pending, requested, approver, alerts, alertSection, onRetry, grip, collapse }) {
  const [tab, setTab] = useState('approvals');
  const [view, setView] = useState(approver ? 'pending' : 'requested');
  const waiting = (list) => (list.status === 'ready' ? list.data.filter((row) => row.status === 'PENDING').length : null);
  const alertCount = alertSection.status === 'ready' ? alerts.length : null;
  const tabs = [['approvals', '승인함', waiting(pending), false], ['alerts', '위험·주의', alertCount, true]];
  const heading = (
    <>
    <h2 className="sr-only">승인함 · 위험·주의</h2>
    <div className="home-htab" role="tablist" aria-label="승인함과 위험·주의">
      {tabs.map(([key, label, count, urgent]) => (
        <button key={key} type="button" role="tab" id={`home-htab-${key}`} aria-selected={tab === key} aria-controls={`home-htab-panel-${key}`}
          className={`home-htab__btn${tab === key ? ' is-active' : ''}`} onClick={() => { setTab(key); if (collapse && !collapse.open) collapse.toggle(); }}>
          <span className="home-htab__title">{label}</span>
          {count != null && <span className={`home-panel__count${urgent && count > 0 ? ' home-panel__count--urgent' : ''}`}>{count}</span>}
        </button>
      ))}
    </div>
    </>
  );
  if (tab === 'alerts') {
    return (
      <Panel id="side" title="위험·주의" heading={heading} grip={grip} collapse={collapse} section={alertSection} onRetry={onRetry} isEmpty={!alerts.length} empty={{ title: '지금 주의할 항목이 없습니다' }} className="home-side home-alerts">
        <div id="home-htab-panel-alerts" role="tabpanel" aria-labelledby="home-htab-alerts"><AlertsList alerts={alerts} /></div>
      </Panel>
    );
  }
  const section = view === 'pending' ? pending : requested;
  const rows = section.data ?? [];
  return (
    <Panel id="side" title="승인함" heading={heading} grip={grip} collapse={collapse} link="/approvals" linkLabel="승인함 열기" className="home-side home-approvals"
      toolbar={<div className="home-seg" role="tablist" aria-label="승인함 목록">
        {[['pending', '결재 대기', waiting(pending)], ['requested', '내 요청', waiting(requested)]].map(([key, label, count]) => (
          <button key={key} type="button" role="tab" aria-selected={view === key} className={`home-seg__btn${view === key ? ' is-active' : ''}`} onClick={() => setView(key)}>
            {label}{count != null && <span className="home-seg__count">{count}</span>}
          </button>
        ))}
      </div>}>
      <div id="home-htab-panel-approvals" role="tabpanel" aria-labelledby="home-htab-approvals">
        <SectionBody section={section} onRetry={onRetry} isEmpty={!rows.length} empty={view === 'pending' ? '지금 결재할 문서가 없습니다' : '요청한 문서가 없습니다'}>
          <ul className="home-list">
            {rows.slice(0, APPROVAL_ROWS).map((row) => (
              <li key={row.approvalId}>
                <Link to={`/approvals?tab=${view}&open=${row.approvalId}`} className="home-list__item">
                  <span className="home-list__main">
                    <span className="home-list__kind">{APPROVAL_TARGET_LABELS[row.targetType] ?? row.targetType}</span>
                    <span className="home-list__title">{row.title || `${row.targetType} #${row.targetId}`}</span>
                  </span>
                  <span className="home-list__meta">
                    {row.overdue && row.status === 'PENDING' && <Badge tone="block">지연</Badge>}
                    <Badge tone={toneOf(row.status)}>{row.status === 'PENDING' ? `${row.currentStep}/${row.totalSteps} ${row.currentStepLabel ?? ''}`.trim() : ({ APPROVED: '승인', REJECTED: '반려', CANCELED: '회수' }[row.status] ?? row.status)}</Badge>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          {rows.length > APPROVAL_ROWS && <Link className="home-more" to={`/approvals?tab=${view}`}>최근 {APPROVAL_ROWS}건만 보입니다 · 나머지 {rows.length - APPROVAL_ROWS}건은 승인함에서</Link>}
        </SectionBody>
      </div>
    </Panel>
  );
}

/** 카드 안 일부 영역의 상태 화면 (카드 머리는 그대로 두고 내용만 바뀐다) */
export function SectionBody({ section, onRetry, isEmpty, empty, children }) {
  if (section.status === 'loading') return <div className="home-panel__pad"><Skeleton lines={3} /></div>;
  if (section.status === 'error') return section.code === 403 ? <StatusView kind="forbidden" compact /> : <StatusView kind="error" compact message={section.error} onRetry={onRetry} />;
  if (isEmpty) return <StatusView kind="empty" compact title={empty} />;
  return children;
}

/** 위험·주의 목록 (차단 → 기한 지남 → 고위험) */
function AlertsList({ alerts }) {
  const icon = { block: 'alert', warn: 'clock', info: 'warning' };
  return (
    <ul className="home-list">
      {alerts.map((alert) => {
        const content = (
          <>
            <span className={`home-alert__icon home-alert__icon--${alert.tone}`}><Icon name={icon[alert.tone]} size={16} /></span>
            <span className="home-list__main">
              <span className="home-list__title">{alert.title}</span>
              <span className="home-list__kind">{alert.detail}</span>
            </span>
          </>
        );
        return <li key={alert.key}>{alert.path ? <Link to={alert.path} className="home-list__item">{content}</Link> : <div className="home-list__item">{content}</div>}</li>;
      })}
    </ul>
  );
}
