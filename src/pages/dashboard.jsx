import { useCallback, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import SafetyPageLayout from '../components/safety-page-layout';
import { effectiveRole } from '../components/app-shell/nav-config.js';
import PageHeader from '../components/ui/page-header.jsx';
import AssistantPanel from '../components/home/assistant-panel.jsx';
import { SidePanel, TodoPanel, WorkStatusPanel } from '../components/home/home-panels.jsx';
import SchedulePanel from '../components/home/schedule-panel.jsx';
import ErrorBoundary from '../components/ui/error-boundary.jsx';
import Icon from '../components/ui/icon.jsx';
import StatusView from '../components/ui/status-view.jsx';
import { useToast } from '../components/ui/toast-context.js';
import { useBreakpoint } from '../hooks/use-breakpoint.js';
import { useHomeData } from '../hooks/use-home-data.js';
import { useHomeLayout, useMediaQuery } from '../hooks/use-home-layout.js';
import { alertsOf, homeHeadline, todoTiles } from '../utils/home-model.js';
import { AI_WIDTH, aiMaxWidth, moveTop, swapTop } from '../utils/home-layout.js';
import { dayLabel } from '../utils/schedule-model.js';
import '../styles/home.css';

const APPROVERS = ['ADMIN', 'SITE_ADMIN', 'APPROVER'];
const TOP_LABELS = { status: '작업 현황', todo: '오늘 할 일', side: '승인함·위험·주의' };

/**
 * 홈 (11/13 2안): 위 3칸(작업 현황 · 오늘 할 일 · 승인함|위험·주의) + 아래 일정 / AI 도우미.
 * PC 는 화면 높이에 고정되고 카드 안쪽만 스크롤된다. 칸 순서·AI 폭·위치·접힘은 이 브라우저에 사용자별로 기억한다.
 * 좁은 PC(≤1180)·태블릿은 AI 가 아이콘으로 접혀 시작하고, 모바일은 한 줄로 쌓는다
 * (AI 도우미 → 오늘 할 일 → 작업 현황 → 승인함 → 일정, 카드마다 접기 · 일정은 목록).
 */
export default function Dashboard() {
  return (
    <SafetyPageLayout title="홈" fixed>
      {(site) => <Home site={site} />}
    </SafetyPageLayout>
  );
}

function Home({ site }) {
  const toast = useToast();
  const siteId = site.currentSite?.siteId ?? null;
  const user = site.account?.user;
  const role = effectiveRole(user?.role, site.currentSite?.role);
  const approver = APPROVERS.includes(role);
  const data = useHomeData(siteId);
  const [newWorkId, setNewWorkId] = useState(null);
  const [revision, setRevision] = useState(0);
  const alerts = useMemo(() => alertsOf(data.dashboard.data, data.works.data ?? []), [data.dashboard.data, data.works.data]);
  const { reload } = data;
  const refresh = useCallback(() => { reload(); setRevision((value) => value + 1); }, [reload]);
  const onDraftSaved = useCallback((workId) => { setNewWorkId(workId); refresh(); }, [refresh]);

  const breakpoint = useBreakpoint();
  const mobile = breakpoint === 'mobile';
  const narrow = useMediaQuery('(max-width: 1180px)');
  const { layout, custom, update, reset } = useHomeLayout(user?.userId);
  const [peek, setPeek] = useState(false); // 좁은 화면에서 접힌 AI 를 잠깐 펼침 (기억하지 않음)
  const folded = !mobile && (narrow ? !peek : layout.aiFolded);

  if (site.loading && !site.account) return <StatusView kind="loading" title="현장 정보를 불러오는 중입니다" />;
  if (!siteId) {
    return <StatusView kind="empty" title="선택할 수 있는 현장이 없습니다" message="관리자에게 현장 권한을 요청하세요." action={{ label: '내 정보', onClick: () => window.location.assign('/me') }} />;
  }

  const userName = user?.name || '사용자';
  const headline = data.dashboard.status === 'ready' ? homeHeadline(data.dashboard.data, todoTiles(data.dashboard.data?.items)) : '홈';
   // 모바일: 카드마다 접기 (처음엔 AI 도우미만 펼침, 이 브라우저에 기억)
  const collapse = (key) => (mobile ? { open: layout.mobileOpen[key], toggle: () => update((current) => ({ mobileOpen: { ...current.mobileOpen, [key]: !current.mobileOpen[key] } })) } : null);
  const grip = (key) => (mobile ? null : <Grip label={TOP_LABELS[key]} onMove={(step) => update({ top: moveTop(layout.top, key, step) })} dragKey={key} />);
  const dropTop = (key) => ({
    onDragOver: (event) => { if (event.dataTransfer.types.includes('text/home-card')) event.preventDefault(); },
    onDrop: (event) => { const from = event.dataTransfer.getData('text/home-card'); if (from && from !== 'bottom') { event.preventDefault(); update({ top: swapTop(layout.top, from, key) }); } },
  });
  const cards = {
    status: <WorkStatusPanel dashboard={data.dashboard} works={data.works} onRetry={reload} grip={grip('status')} collapse={collapse('status')} />,
    todo: <TodoPanel section={data.dashboard} onRetry={reload} grip={grip('todo')} collapse={collapse('todo')} />,
    side: <SidePanel pending={data.pending} requested={data.requested} approver={approver} alerts={alerts} alertSection={data.works.status === 'ready' ? data.dashboard : data.works} onRetry={reload} grip={grip('side')} collapse={collapse('side')} />,
  };
  const swapSides = () => update({ aiSide: layout.aiSide === 'right' ? 'left' : 'right' });
  const bottomGrip = (label) => (mobile ? null : <Grip label={label} onMove={swapSides} dragKey="bottom" hint="끌어서 놓기 · 좌우 화살표로 일정과 AI 도우미 자리 바꾸기" />);

  return (
    <div className="home">
      <PageHeader title={headline} eyebrow={<><b>{userName}님</b> · {dayLabel(data.date, true)}</>} hideMeta context={site} notices={false}
        onBeforeSelect={() => toast.show({ tone: 'info', message: '현장을 바꿉니다. AI 도우미는 새 대화로 시작합니다.' })}
        actions={<>
          {custom && !mobile && <button type="button" className="ui-btn ui-btn--sm home-reset" title="칸 위치·폭·AI 접힘을 처음 상태로" onClick={reset}>기본 배치로</button>}
          <Link className="ui-btn ui-btn--secondary" to="/job/workspace">단계별로 만들기</Link>
          <button type="button" className="ui-btn ui-btn--primary" onClick={() => { if (folded) { if (narrow) setPeek(true); else update({ aiFolded: false }); } requestAnimationFrame(() => document.getElementById('home-composer')?.focus()); }}>대화로 만들기</button>
        </>} />

      <div className="home-grid">
        <div className="home-top">
          {layout.top.map((key) => (
            <div key={key} className={`home-cell home-cell--${key}`} {...dropTop(key)}>
              <ErrorBoundary compact resetKeys={[siteId]}>{cards[key]}</ErrorBoundary>
            </div>
          ))}
        </div>
        <Bottom
          side={layout.aiSide} width={layout.aiWidth} folded={folded} narrow={narrow && !mobile}
          onWidth={(aiWidth) => update({ aiWidth })}
          onSwap={swapSides}
          onUnfold={() => (narrow ? setPeek(true) : update({ aiFolded: false }))}
          schedule={(
            <ErrorBoundary compact resetKeys={[siteId]}>
              <SchedulePanel siteId={siteId} today={data.date} todayWorks={data.works} zones={data.zones} deadlines={data.dashboard.data?.deadlines}
                highlightId={newWorkId} view={layout.view} onView={(view) => update({ view })} mobile={mobile} revision={revision} onRetry={refresh}
                grip={bottomGrip('일정')} collapse={collapse('schedule')} />
            </ErrorBoundary>
          )}
          ai={(
            <ErrorBoundary compact resetKeys={[siteId]} title="AI 도우미를 표시하지 못했습니다">
              <AssistantPanel siteId={siteId} siteName={site.currentSite?.name} zones={data.zones.data ?? []} onDraftSaved={onDraftSaved} onDraftChanged={refresh}
                grip={bottomGrip('AI 도우미')} collapse={collapse('ai')} onFold={mobile ? null : () => (narrow ? setPeek(false) : update({ aiFolded: true }))} />
            </ErrorBoundary>
          )}
        />
      </div>
    </div>
  );
}

/**
 * 아래 줄: 일정 | 나눔 손잡이 | AI 도우미. AI 는 접으면 아이콘만(가져가면 "AI 도우미" 이름표).
 * 접혀도 AI 대화는 살아 있어야 해서(진행 중 실행) 숨기기만 하고 내리지 않는다.
 */
function Bottom({ side, width, folded, narrow, onWidth, onUnfold, onSwap, schedule, ai }) {
  const box = useRef(null);
  const startDrag = (event) => {
    const rect = box.current?.getBoundingClientRect();
    if (!rect) return;
    event.preventDefault();
    const max = aiMaxWidth(rect.width);
    const move = (moveEvent) => {
      const next = side === 'right' ? rect.right - moveEvent.clientX : moveEvent.clientX - rect.left;
      onWidth(Math.round(Math.min(max, Math.max(AI_WIDTH.min, next))));
    };
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };
  const nudge = (event) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const grow = (event.key === 'ArrowLeft') === (side === 'right');
    const max = aiMaxWidth(box.current?.getBoundingClientRect().width ?? 0);
    onWidth(Math.min(max, Math.max(AI_WIDTH.min, Math.min(width, max) + (grow ? 20 : -20))));
  };
  // 아래 칸 손잡이를 끌어 다른 쪽에 놓으면 일정과 AI 자리를 바꾼다
  const dropSwap = {
    onDragOver: (event) => { if (event.dataTransfer.types.includes('text/home-card')) event.preventDefault(); },
    onDrop: (event) => { if (event.dataTransfer.getData('text/home-card') === 'bottom') { event.preventDefault(); onSwap(); } },
  };
  const className = ['home-bottom', `home-bottom--ai-${side}`, folded && 'is-folded', narrow && 'is-narrow'].filter(Boolean).join(' ');
  return (
    <div className={className} ref={box} style={{ '--ai-width': `${width}px` }}>
      <div className="home-cell home-cell--schedule" {...dropSwap}>{schedule}</div>
      {!folded && !narrow && (
        <button type="button" className="home-split" aria-label={`AI 도우미 폭 조절 (지금 ${width}px, 좌우 화살표 · 두 번 누르면 처음 폭)`}
          onPointerDown={startDrag} onKeyDown={nudge} onDoubleClick={() => onWidth(AI_WIDTH.base)}><span /></button>
      )}
      <div className="home-cell home-cell--ai" hidden={folded} {...dropSwap}>{ai}</div>
      {folded && (
        <aside className="home-airail" aria-label="AI 도우미 (접힘)">
          <button type="button" className="home-airail__btn" aria-label="AI 도우미 펼치기" onClick={onUnfold}><Icon name="panelRight" size={18} /></button>
          <span className="home-airail__tip" role="tooltip">AI 도우미 펼치기</span>
        </aside>
      )}
    </div>
  );
}

/** 칸 옮기기 손잡이: 끌어서 다른 칸에 놓거나, 포커스 후 좌우 화살표 */
function Grip({ label, onMove, dragKey, hint }) {
  return (
    <button type="button" className="home-grip" draggable={Boolean(dragKey)}
      aria-label={`${label} 칸 옮기기${hint ? ` (${hint})` : ' (끌어서 놓기 · 좌우 화살표)'}`} title="끌어서 위치 바꾸기"
      onDragStart={(event) => { if (!dragKey) return; event.dataTransfer.setData('text/home-card', dragKey); event.dataTransfer.effectAllowed = 'move'; }}
      onKeyDown={(event) => {
        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
        event.preventDefault();
        onMove(event.key === 'ArrowLeft' ? -1 : 1);
      }}>
      <Icon name="grip" size={14} />
    </button>
  );
}
