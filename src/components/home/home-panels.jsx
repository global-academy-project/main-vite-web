import { Link } from 'react-router-dom';
import Icon from '../ui/icon.jsx';
import Panel, { Badge } from './panel.jsx';
import {
  APPROVAL_TARGET_LABELS, nextAction, timeRange, todoTiles, todoTotal, toneOf, typeCounts, WORK_STATUS_LABELS, WORK_TYPE_LABELS, workStages,
} from '../../utils/home-model.js';
import { jobRecordPath } from '../../utils/job-forms.js';

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
        {tiles.filter((tile) => tile.count > 0).map((tile) => (
          <li key={tile.type}>
            <Link to={tile.path} className={`home-tile has-count${tile.overdue ? ' is-overdue' : ''}`} title={tile.fullLabel}>
              <span className="home-tile__label">{tile.label}</span>
              <span className="home-tile__row">
                <span className="home-tile__count">{tile.count}<small>건</small></span>
                {tile.overdue && <span className="home-tile__due"><Icon name="clock" size={12} />지남</span>}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {tiles.some((tile) => tile.count === 0) && (
        <p className="home-tiles__none"><Icon name="check" size={14} />없음: {tiles.filter((tile) => tile.count === 0).map((tile) => tile.label).join(' · ')}</p>
      )}
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
export function TodayWorksPanel({ section, zones, highlightId, onRetry }) {
  const rows = section.data ?? [];
  const zoneName = (id) => zones.data?.find((zone) => zone.zoneId === id)?.name ?? (id ? `구역 #${id}` : '구역 미지정');
  return (
    <Panel
      id="works" title="오늘 작업" count={section.status === 'ready' ? rows.length : null} section={section} onRetry={onRetry} link="/job/workspace" linkLabel="작업 목록"
      isEmpty={!rows.length}
      empty={{ title: '오늘 등록된 작업이 없습니다', message: '아래 AI 도우미에게 말하거나 단계별로 등록하세요.', action: { label: '작업 등록', onClick: () => document.getElementById('home-composer')?.focus() } }}
      className="home-works"
    >
      <table className="home-table">
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
    </Panel>
  );
}

/** 승인 대기(승인자) 또는 내가 올린 요청(작성자) */
export function ApprovalsPanel({ section, approver, onRetry }) {
  const rows = section.data ?? [];
  const open = approver ? rows : rows.filter((row) => row.status === 'PENDING');
  return (
    <Panel
      id="approvals" title={approver ? '승인 대기' : '내 승인 요청'} count={section.status === 'ready' ? open.length : null}
      section={section} onRetry={onRetry} link={approver ? '/approvals' : null}
      isEmpty={!rows.length} empty={{ title: approver ? '기다리는 승인이 없습니다' : '올린 승인 요청이 없습니다' }}
      className="home-approvals"
    >
      <ul className="home-list">
        {rows.slice(0, 20).map((row) => (
          <li key={row.approvalId}>
            <Link to={approver ? `/approvals/${row.approvalId}` : (jobRecordPath(row.targetType, row.targetId) ?? `/approvals/${row.approvalId}`)} className="home-list__item">
              <span className="home-list__main">
                <span className="home-list__kind">{APPROVAL_TARGET_LABELS[row.targetType] ?? row.targetType}</span>
                <span className="home-list__title">{row.title || `${row.targetType} #${row.targetId}`}</span>
              </span>
              <span className="home-list__meta">
                {row.overdue && <Badge tone="block">지연</Badge>}
                <Badge tone={toneOf(row.status)}>{row.status === 'PENDING' ? `${row.currentStep}/${row.totalSteps} ${row.currentStepLabel ?? ''}`.trim() : ({ APPROVED: '승인', REJECTED: '반려', CANCELED: '취소' }[row.status] ?? row.status)}</Badge>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Panel>
  );
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
