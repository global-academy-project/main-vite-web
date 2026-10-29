import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getPendingApprovals } from '../../api/approvals';
import SafetyPageLayout from '../../components/safety-page-layout';
import '../../style/records.css';

function Inbox({ site }) {
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const siteId = site.currentSite?.siteId;
  const rows = result?.siteId === siteId ? result.rows : [];
  const loading = Boolean(siteId) && result?.siteId !== siteId;

  useEffect(() => {
    if (!siteId) return;
    let cancelled = false;
    getPendingApprovals(siteId).then((data) => {
      if (!cancelled) { setResult({ siteId, rows: Array.isArray(data) ? data : [] }); setError(''); }
    }).catch((requestError) => {
      if (!cancelled) { setResult({ siteId, rows: [] }); setError(requestError.message); }
    });
    return () => { cancelled = true; };
  }, [siteId]);

  return (
    <>
      <div className="page-heading records-heading">
        <div><h1>승인함</h1><p>현재 결재 차례인 안전 문서를 검토합니다.</p></div>
        <select value={siteId || ''} onChange={(e) => site.selectSite(e.target.value)} disabled={site.loading || site.selecting}>
          {(site.account?.sites || []).map((item) => <option key={item.siteId} value={item.siteId}>{item.name}</option>)}
        </select>
      </div>
      {error && <p className="dashboard-error" role="alert">{error}</p>}
      <section className="panel">
        <h2>승인 대기 <small>{rows.length}건</small></h2>
        {loading ? <p role="status">승인 목록을 불러오는 중입니다...</p> : (
          <div className="table-scroll"><table><thead><tr><th>문서</th><th>제목</th><th>작성자</th><th>현재 단계</th><th>요청일</th><th>마감</th><th>검토</th></tr></thead>
            <tbody>{rows.map((row) => <tr key={row.approvalId}><td>{row.targetType}</td><td>{row.title || `#${row.targetId}`}</td><td>{row.requesterName}</td><td>{row.stepLabel}</td><td>{row.requestedAt?.replace('T', ' ')}</td><td>{row.overdue ? '지연' : row.dueAt?.replace('T', ' ') || '-'}</td><td><Link className="records-link" to={`/approvals/${row.approvalId}`}>검토</Link></td></tr>)}</tbody>
          </table></div>
        )}
      </section>
    </>
  );
}

export default function ApprovalInbox() {
  return <SafetyPageLayout title="승인함">{(site) => <Inbox site={site} />}</SafetyPageLayout>;
}
