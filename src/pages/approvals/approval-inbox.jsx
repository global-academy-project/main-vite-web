import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { refreshWorkSite } from '../../api/workers';
import SafetyPageLayout from '../../components/safety-page-layout';
import ApprovalReview from '../../components/approvals/approval-review.jsx';
import { Badge } from '../../components/home/panel.jsx';
import Icon from '../../components/ui/icon.jsx';
import Sheet from '../../components/ui/sheet.jsx';
import StatusView, { Skeleton } from '../../components/ui/status-view.jsx';
import { useApprovalInbox } from '../../hooks/use-approval-inbox.js';
import { effectiveRole } from '../../components/app-shell/nav-config.js';
import {
  APPROVAL_STATUS_LABELS, approvalStats, approvalTone, filterApprovals, shortDateTime, sortApprovals, TARGET_FILTERS,
} from '../../utils/approval-model.js';
import { APPROVAL_TARGET_LABELS } from '../../utils/home-model.js';
import '../../styles/home.css';
import '../../styles/work.css';
import '../../styles/approvals.css';

const TABS = [
  { key: 'pending', label: '내 승인 대기', empty: '지금 결재할 문서가 없습니다' },
  { key: 'requested', label: '내가 요청한 문서', empty: '요청한 문서가 없습니다' },
];
const STATUS_FILTERS = ['PENDING', 'APPROVED', 'REJECTED', 'CANCELED'];
const EMPTY_FILTERS = { types: [], status: '', from: '', to: '', keyword: '' };

/**
 * 승인함. 서버 목록은 "내 승인 대기"(pending)와 "내가 요청한 문서"(mine=requested) 두 가지.
 * 검토를 누르면 PC 는 오른쪽 드로어, 모바일은 바텀 시트로 열리고 주소에 open=결재번호 가 남는다.
 * /approvals/:id 전체 화면(알림·공유 링크)도 같은 검토 부품을 쓴다.
 */
export default function ApprovalInbox() {
  return <SafetyPageLayout title="승인함">{(site) => <Inbox site={site} />}</SafetyPageLayout>;
}

function Inbox({ site }) {
  const siteId = site.currentSite?.siteId;
  const inbox = useApprovalInbox(siteId);
  const [params, setParams] = useSearchParams();
  // 승인 권한이 없는 작성자는 "내가 요청한 문서"가 첫 탭
  const approver = ['ADMIN', 'SITE_ADMIN', 'APPROVER'].includes(effectiveRole(site.account?.user?.role, site.currentSite?.role));
  const tab = params.get('tab') === 'requested' || params.get('tab') === 'pending' ? params.get('tab') : (approver ? 'pending' : 'requested');
  const openId = /^\d+$/.test(params.get('open') ?? '') ? params.get('open') : null;
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const section = inbox[tab];
  const rows = useMemo(() => sortApprovals(filterApprovals(section.rows, filters)).filter((row) => !filters.overdueOnly || row.overdue), [section.rows, filters]);
  const stats = approvalStats(section.rows);
  const filtered = Boolean(filters.types.length || filters.status || filters.from || filters.to || filters.keyword.trim() || filters.overdueOnly);

  const setQuery = (next) => {
    const merged = { tab, ...(openId ? { open: openId } : {}), ...next };
    setParams(Object.fromEntries(Object.entries(merged).filter(([, value]) => value)));
  };
  const changeSite = async (event) => { await site.selectSite(event.target.value); refreshWorkSite(); setParams({}); };
  const update = (key, value) => setFilters((prev) => ({ ...prev, [key]: value }));

  if (!siteId) return site.loading ? <StatusView kind="loading" /> : <StatusView kind="empty" title="선택할 수 있는 현장이 없습니다" message="관리자에게 현장 권한을 요청하세요." />;

  return (
    <div className="work-list appr-inbox">
      <header className="work-head">
        <div>
          <h1 className="work-head__title">승인함</h1>
          <p className="work-head__meta">{site.currentSite?.name} · 지연된 결재가 맨 위에 옵니다.</p>
        </div>
        <div className="work-head__actions">
          {site.account?.sites?.length > 1 && (
            <label className="home-site"><span className="sr-only">현장 선택</span>
              <select value={siteId} onChange={changeSite} disabled={site.selecting}>{site.account.sites.map((item) => <option key={item.siteId} value={item.siteId}>{item.name}</option>)}</select>
            </label>
          )}
          <button type="button" className="ui-btn ui-btn--ghost" onClick={inbox.reload}><Icon name="refresh" size={16} />새로고침</button>
        </div>
      </header>

      <div className="home-assistant__tabs appr-tabs" role="tablist" aria-label="승인함 목록">
        {TABS.map((item) => {
          const count = inbox[item.key].status === 'ready' ? inbox[item.key].rows.filter((row) => row.status === 'PENDING').length : null;
          return (
            <button key={item.key} type="button" role="tab" aria-selected={tab === item.key} className={`home-assistant__tab${tab === item.key ? ' is-active' : ''}`}
              onClick={() => { setFilters(EMPTY_FILTERS); setParams({ tab: item.key }); }}>
              {item.label}{count != null && <span className="home-panel__count">{count}</span>}
            </button>
          );
        })}
      </div>

      <ul className="work-stats appr-stats" aria-label="결재 건수">
        {[
          { key: '', label: tab === 'pending' ? '결재할 문서' : '전체', value: stats.total, tone: 'neutral' },
          { key: 'OVERDUE', label: '지연', value: stats.overdue, tone: 'block' },
          { key: 'PENDING', label: '승인 대기', value: stats.pending, tone: 'wait' },
          ...(tab === 'requested' ? [{ key: 'REJECTED', label: '반려', value: stats.rejected, tone: 'block' }, { key: 'APPROVED', label: '승인 완료', value: stats.approved, tone: 'done' }] : []),
        ].map((stat) => {
          const active = stat.key === 'OVERDUE' ? filters.status === 'PENDING' && filters.overdueOnly : stat.key ? filters.status === stat.key && !filters.overdueOnly : !filters.status;
          return (
            <li key={stat.key || 'all'}>
              <button type="button" aria-pressed={active} className={`work-stat work-stat--${stat.tone}${active ? ' is-active' : ''}`}
                onClick={() => setFilters((prev) => ({ ...prev, status: stat.key === 'OVERDUE' ? 'PENDING' : stat.key, overdueOnly: stat.key === 'OVERDUE' }))}>
                <span className="work-stat__label">{stat.label}</span>
                <strong className="work-stat__value">{section.status === 'ready' ? stat.value : '–'}</strong>
              </button>
            </li>
          );
        })}
      </ul>

      <section className="work-filters" aria-label="결재 거르기">
        <div className="work-filters__row">
          <div className="work-types" role="group" aria-label="문서 종류">
            {TARGET_FILTERS.map((type) => (
              <button key={type} type="button" className="work-chip" aria-pressed={filters.types.includes(type)}
                onClick={() => update('types', filters.types.includes(type) ? filters.types.filter((item) => item !== type) : [...filters.types, type])}>
                {filters.types.includes(type) && <Icon name="check" size={14} />}{APPROVAL_TARGET_LABELS[type]}
              </button>
            ))}
          </div>
          {tab === 'requested' && (
            <label className="appr-select"><span className="sr-only">상태</span>
              <select value={filters.status} onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value, overdueOnly: false }))}>
                <option value="">상태 전체</option>
                {STATUS_FILTERS.map((status) => <option key={status} value={status}>{APPROVAL_STATUS_LABELS[status]}</option>)}
              </select>
            </label>
          )}
        </div>
        <div className="work-filters__row">
          <div className="work-period" role="group" aria-label="요청일">
            <label><span className="sr-only">요청일 시작</span><input type="date" value={filters.from} max={filters.to || undefined} onChange={(event) => update('from', event.target.value)} /></label>
            <span aria-hidden="true">~</span>
            <label><span className="sr-only">요청일 끝</span><input type="date" value={filters.to} min={filters.from || undefined} onChange={(event) => update('to', event.target.value)} /></label>
          </div>
          <label className="work-search"><span className="sr-only">문서명·요청자 검색</span>
            <input type="search" value={filters.keyword} placeholder="문서명·요청자 검색" onChange={(event) => update('keyword', event.target.value)} />
          </label>
          {filtered && <button type="button" className="ui-btn ui-btn--ghost" onClick={() => setFilters(EMPTY_FILTERS)}>거르기 지우기</button>}
        </div>
      </section>

      <section className="home-panel work-table-panel" aria-label={TABS.find((item) => item.key === tab).label}>
        {section.status === 'loading' && <div className="home-panel__pad"><Skeleton lines={6} /></div>}
        {section.status === 'error' && <StatusView kind={section.code === 403 ? 'forbidden' : 'error'} message={section.error} onRetry={inbox.reload} />}
        {section.status === 'ready' && !rows.length && (
          <StatusView kind="empty" title={section.rows.length ? '조건에 맞는 결재가 없습니다' : TABS.find((item) => item.key === tab).empty}
            action={section.rows.length ? { label: '거르기 지우기', onClick: () => setFilters(EMPTY_FILTERS) } : undefined} />
        )}
        {section.status === 'ready' && rows.length > 0 && (
          <table className="home-table appr-table-list">
            <thead><tr><th scope="col">문서</th><th scope="col">제목</th><th scope="col">요청자</th><th scope="col">단계</th><th scope="col">요청</th><th scope="col">마감</th><th scope="col">상태</th><th scope="col"><span className="sr-only">검토</span></th></tr></thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.approvalId} className={String(row.approvalId) === openId ? 'is-new' : ''}>
                  <td data-label="문서"><Badge tone="info">{APPROVAL_TARGET_LABELS[row.targetType] ?? row.targetType}</Badge></td>
                  <td data-label="제목"><button type="button" className="appr-row-title" onClick={() => setQuery({ open: String(row.approvalId) })}>{row.title || `${row.targetType} #${row.targetId}`}</button></td>
                  <td data-label="요청자">{row.requestedByName || '-'}</td>
                  <td data-label="단계">{row.status === 'PENDING' ? <span className="appr-step">{row.currentStep}/{row.totalSteps} {row.currentStepLabel}</span> : '-'}</td>
                  <td data-label="요청" className="work-table__date">{shortDateTime(row.requestedAt)}</td>
                  <td data-label="마감">{row.overdue && row.status === 'PENDING' ? <Badge tone="block"><Icon name="clock" size={12} />지연</Badge> : <span className="work-table__date">{shortDateTime(row.dueAt) || '-'}</span>}</td>
                  <td data-label="상태"><Badge tone={approvalTone(row.status)}>{APPROVAL_STATUS_LABELS[row.status] ?? row.status}</Badge></td>
                  <td data-label="검토"><button type="button" className="ui-btn ui-btn--secondary appr-open" onClick={() => setQuery({ open: String(row.approvalId) })}>{tab === 'pending' ? '검토' : '보기'}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <Sheet open={Boolean(openId)} onClose={() => setQuery({ open: '' })} title="결재 검토" subtitle={openId ? `/approvals/${openId}` : ''} wide
        actions={openId && <Link className="ui-icon-btn" to={`/approvals/${openId}`} aria-label="전체 화면으로 열기"><Icon name="external" size={18} /></Link>}>
        {openId && <ApprovalReview key={openId} approvalId={openId} onDecided={() => inbox.reload()} />}
      </Sheet>
    </div>
  );
}
