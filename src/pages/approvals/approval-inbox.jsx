import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getPendingApprovals } from '../../api/approvals';
import SafetyPageLayout from '../../components/safety-page-layout';
import ApprovalFilters from './components/approval-filters';
import ApprovalStatusBadge from './components/approval-status-badge';
import '../../style/records.css';

function Inbox({ site }) {
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({ targetType: '', status: '', from: '', to: '', keyword: '' });
  const [refreshKey, setRefreshKey] = useState(0);
  const siteId = site.currentSite?.siteId;
  const rows = result?.siteId === siteId ? result.rows : [];
  const loading = Boolean(siteId) && result?.siteId !== siteId;
  const filteredRows = rows.filter((row) => {
    const date = row.requestedAt?.slice(0, 10) || '';
    const keyword = filters.keyword.trim().toLowerCase();
    return (!filters.targetType || row.targetType === filters.targetType)
      && (!filters.status || row.status === filters.status)
      && (!filters.from || date >= filters.from)
      && (!filters.to || date <= filters.to)
      && (!keyword || `${row.title || ''} ${row.requesterName || ''}`.toLowerCase().includes(keyword));
  });

  useEffect(() => {
    if (!siteId) return;
    let cancelled = false;
    getPendingApprovals(siteId).then((data) => {
      if (!cancelled) { setResult({ siteId, rows: Array.isArray(data) ? data : [] }); setError(''); }
    }).catch((requestError) => {
      if (!cancelled) { setResult({ siteId, rows: [] }); setError(requestError.message); }
    });
    return () => { cancelled = true; };
  }, [siteId, refreshKey]);

  return (
    <>
      <div className="page-heading records-heading">
        <div><h1>승인함</h1><p>현재 결재 차례인 안전 문서를 검토합니다.</p></div>
        <select value={siteId || ''} onChange={(e) => site.selectSite(e.target.value)} disabled={site.loading || site.selecting}>
          {(site.account?.sites || []).map((item) => <option key={item.siteId} value={item.siteId}>{item.name}</option>)}
        </select>
      </div>
      {error && <p className="dashboard-error" role="alert">{error}</p>}
      <ApprovalFilters filters={filters} onChange={setFilters} onRefresh={() => setRefreshKey((value) => value + 1)} loading={loading} />
      <section className="panel">
        <div className="records-panel-heading"><h2>내 승인 대기 <small>{filteredRows.length}건</small></h2></div>
        {loading ? <p role="status">승인 목록을 불러오는 중입니다...</p> : filteredRows.length ? (
          <div className="table-scroll"><table><thead><tr><th>문서</th><th>제목</th><th>작성자</th><th>현재 단계</th><th>상태</th><th>요청일</th><th>마감</th><th>검토</th></tr></thead>
            <tbody>{filteredRows.map((row) => <tr key={row.approvalId}><td>{row.targetType}</td><td>{row.title || `#${row.targetId}`}</td><td>{row.requesterName || '-'}</td><td>{row.stepLabel || '-'}</td><td><ApprovalStatusBadge status={row.status} /></td><td>{row.requestedAt?.replace('T', ' ') || '-'}</td><td>{row.overdue ? <span className="approval-overdue">지연</span> : row.dueAt?.replace('T', ' ') || '-'}</td><td><Link className="records-link" to={`/approvals/${row.approvalId}`}>검토</Link></td></tr>)}</tbody>
          </table></div>
        ) : <div className="approval-empty"><strong>{error ? '승인 목록을 불러오지 못했습니다.' : '현재 승인 대기 중인 문서가 없습니다.'}</strong><p>{error || '필터 조건을 변경하거나 잠시 후 다시 확인해 주세요.'}</p>{error && <button type="button" onClick={() => setRefreshKey((value) => value + 1)}>다시 시도</button>}</div>}
      </section>
    </>
  );
}

export default function ApprovalInbox() {
  return <SafetyPageLayout title="승인함">{(site) => <Inbox site={site} />}</SafetyPageLayout>;
}
