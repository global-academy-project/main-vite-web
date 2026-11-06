import { useState } from 'react';
import { Link } from 'react-router-dom';
import StatusView, { Skeleton } from '../ui/status-view.jsx';
import Icon from '../ui/icon.jsx';
import Panel, { Badge } from './panel.jsx';
import {
  tileValue, APPROVAL_TARGET_LABELS, nextAction, timeRange, todoTiles, todoTotal, toneOf, typeCounts, WORK_STATUS_LABELS, WORK_TYPE_LABELS, workStages,
} from '../../utils/home-model.js';

const hm = (value) => (typeof value === 'string' && value.length >= 16 ? value.slice(11, 16) : '');

/** 오늘 할 일: 대시보드 미완료 9종 + 마감 시각 */
export function TodoPanel({ section, onRetry }) {
  const tiles = todoTiles(section.data?.items);
  const deadlines = section.data?.deadlines;
  return (
    <Panel id="todo" title="오늘 할 일" count={section.status === 'ready' ? todoTotal(tiles) : null} section={section} onRetry={onRetry} className="home-todo">
      {deadlines && (
        <div className="home-deadlines">
          <span className={deadlines.tbmPassed ? 'is-passed' : ''}><Icon name="clock" size={14} />TBM 마감 {hm(deadlines.tbmDeadline)}{deadlines.tbmPassed && ' · 지남'}</span>
          <span className={deadlines.dailyLogPassed ? 'is-passed' : ''}><Icon name="clock" size={14} />안전일지 {hm(deadlines.dailyLogDeadline)}{deadlines.dailyLogPassed && ' · 지남'}</span>
        </div>
      )}
      <ul className="home-tiles">
        {tiles.map((tile) => (
          <li key={tile.type}>
            <Link to={tile.path} className={`home-tile${tile.count ? ' has-count' : ''}${tile.overdue ? ' is-overdue' : ''}`} title={tile.fullLabel}>
              <span className="home-tile__label">{tile.label}</span>
              <span className="home-tile__row">
                {tile.overdue && <span className="home-tile__due"><Icon name="clock" size={12} />지남</span>}
                <span className={`home-tile__count${tileValue(tile, section.data).word ? ' home-tile__count--word' : ''}`}>{tileValue(tile, section.data).text}{tileValue(tile, section.data).unit && <small>{tileValue(tile, section.data).unit}</small>}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

const STATUS_ORDER = ['DRAFT', 'PENDING', 'APPROVED', 'IN_PROGRESS', 'BLOCKED', 'DONE'];

/** 작업 현황: 상태별 건수 + 종류별 막대 */
export function WorkStatusPanel({ dashboard, works, onRetry }) {
  const byStatus = dashboard.data?.works?.byStatus ?? {};
  const counts = typeCounts(works.data ?? []);
  const max = Math.max(1, ...counts.map((item) => item.count));
  return (
    <Panel id="status" title="작업 현황" tag="오늘" count={dashboard.data?.works?.total} section={dashboard.status !== 'ready' ? dashboard : works} onRetry={onRetry} link="/job/dashboard" className="home-status">
      <div className="home-status__grid">
      <ul className="home-stats">
        {STATUS_ORDER.map((status) => (
          <li key={status} className={`home-stat home-stat--${toneOf(status)}`}>
            <span className="home-stat__label">{WORK_STATUS_LABELS[status]}</span>
            <strong className="home-stat__value">{byStatus[status] ?? 0}</strong>
          </li>
        ))}
      </ul>
      <ul className="home-bars" aria-label="작업 종류별 건수">
        {counts.map((item) => (
          <li key={item.type} className="home-bar">
            <span className="home-bar__label">{item.label}</span>
            <span className="home-bar__track"><span className="home-bar__fill" style={{ width: `${(item.count / max) * 100}%` }} /></span>
            <span className="home-bar__value">{item.count}</span>
          </li>
        ))}
      </ul>
      </div>
    </Panel>
  );
}

/** 오늘 작업: PC 표 / 모바일 카드. 방금 AI 가 만든 작업은 강조 */
const MOBILE_ROWS = 5;
const APPROVAL_ROWS = 20;

export function TodayWorksPanel({ section, zones, highlightId, onRetry }) {
  const rows = section.data ?? [];
  // 모바일은 카드가 길어지지 않게 5건만 먼저 보이고 "더 보기"로 펼친다 (PC·태블릿은 카드 안에서 스크롤)
  const [expanded, setExpanded] = useState(false);
  const hidden = expanded ? 0 : Math.max(0, rows.length - MOBILE_ROWS);
  const zoneName = (id) => zones.data?.find((zone) => zone.zoneId === id)?.name ?? (id ? `구역 #${id}` : '구역 미지정');
  return (
    <Panel
      id="works" title="오늘 작업" count={section.status === 'ready' ? rows.length : null} section={section} onRetry={onRetry} link="/job/workspace" linkLabel="작업 목록"
      isEmpty={!rows.length}
      empty={{ title: '오늘 등록된 작업이 없습니다', message: '아래 AI 도우미에게 말하거나 단계별로 등록하세요.', action: { label: '작업 등록', onClick: () => document.getElementById('home-composer')?.focus() } }}
      className="home-works"
    >
      <table className={`home-table${hidden ? ' home-table--collapsed' : ''}`}>
        <thead>
          <tr><th scope="col">작업</th><th scope="col">종류</th><th scope="col">진행</th><th scope="col">지금 할 일</th></tr>
        </thead>
        <tbody>
          {rows.map((work) => {
            const stages = workStages(work);
            const next = nextAction(work);
            const hub = `/job/workspace?workId=${work.workId}`;
            const facts = [zoneName(work.zoneId), timeRange(work.startAt, work.endAt), work.workerCount != null ? `${work.workerCount}명` : ''].filter(Boolean).join(' · ');
            return (
              <tr key={work.workId} className={work.workId === highlightId ? 'is-new' : ''}>
                <td data-label="작업">
                  <span className="home-table__name">
                    <Link to={hub} className="home-table__title">{work.title}</Link>
                    {work.workId === highlightId && <Badge tone="info">방금 생성</Badge>}
                  </span>
                  <span className={`home-table__facts${work.zoneId ? '' : ' is-warn'}`}>{facts}</span>
                </td>
                <td data-label="종류"><Badge tone={work.highRisk ? 'warn' : 'neutral'}>{WORK_TYPE_LABELS[work.workType] ?? work.workType}</Badge></td>
                <td data-label="진행">
                  <span className="home-dots" role="img" aria-label={stages.map((stage) => `${stage.label} ${stage.hint || stage.state}`).join(', ')}>
                    {stages.map((stage) => <span key={stage.key} className={`home-dot home-dot--${stage.state}`} title={`${stage.label} · ${stage.hint || ''}`} />)}
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
    </Panel>
  );
}

/**
 * 승인함 카드. 제목·버튼·자리는 역할과 상관없이 항상 같다.
 * 안쪽에 "결재 대기 / 내 요청" 전환(승인함 화면 탭과 같은 이름)이 고정돼 있고, 처음 열리는 쪽만 역할에 따라 다르다.
 */
export function ApprovalsPanel({ pending, requested, approver, onRetry }) {
  const [view, setView] = useState(approver ? 'pending' : 'requested');
  const section = view === 'pending' ? pending : requested;
  const rows = section.data ?? [];
  const waiting = (list) => (list.status === 'ready' ? list.data.filter((row) => row.status === 'PENDING').length : null);
  return (
    <Panel id="approvals" title="승인함" count={waiting(pending)} link="/approvals" linkLabel="승인함 열기" className="home-approvals"
      toolbar={<div className="home-seg" role="tablist" aria-label="승인함 목록">
        {[['pending', '결재 대기', waiting(pending)], ['requested', '내 요청', waiting(requested)]].map(([key, label, count]) => (
          <button key={key} type="button" role="tab" aria-selected={view === key} className={`home-seg__btn${view === key ? ' is-active' : ''}`} onClick={() => setView(key)}>
            {label}{count != null && <span className="home-seg__count">{count}</span>}
          </button>
        ))}
      </div>}>
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
    </Panel>
  );
}

/** 카드 안 일부 영역의 상태 화면 (카드 머리는 그대로 두고 내용만 바뀐다) */
function SectionBody({ section, onRetry, isEmpty, empty, children }) {
  if (section.status === 'loading') return <div className="home-panel__pad"><Skeleton lines={3} /></div>;
  if (section.status === 'error') return section.code === 403 ? <StatusView kind="forbidden" compact /> : <StatusView kind="error" compact message={section.error} onRetry={onRetry} />;
  if (isEmpty) return <StatusView kind="empty" compact title={empty} />;
  return children;
}

/** 위험·주의 알림 */
export function AlertsPanel({ alerts, section, onRetry }) {
  const icon = { block: 'alert', warn: 'clock', info: 'warning' };
  return (
    <Panel id="alerts" title="위험·주의" count={section.status === 'ready' ? alerts.length : null} section={section} onRetry={onRetry} isEmpty={!alerts.length} empty={{ title: '지금 주의할 항목이 없습니다' }} className="home-alerts">
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
    </Panel>
  );
}
