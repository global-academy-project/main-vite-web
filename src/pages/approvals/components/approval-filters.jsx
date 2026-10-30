export default function ApprovalFilters({ filters, onChange, onRefresh, loading }) {
  const update = (key) => (event) => onChange({ ...filters, [key]: event.target.value });
  return (
    <section className="panel approval-filters">
      <div className="approval-filter-row">
        <label>문서 종류<select value={filters.targetType} onChange={update('targetType')}><option value="">전체</option><option value="WORK">작업</option><option value="PERMIT">작업허가</option><option value="RISK">위험성평가</option><option value="TBM">TBM</option><option value="DAILY_LOG">안전일지</option><option value="INSPECTION">점검표</option></select></label>
        <label>상태<select value={filters.status} onChange={update('status')}><option value="">전체</option><option value="PENDING">승인 대기</option><option value="APPROVED">승인 완료</option><option value="REJECTED">반려</option></select></label>
        <label>시작일<input type="date" value={filters.from} onChange={update('from')} /></label>
        <label>종료일<input type="date" value={filters.to} onChange={update('to')} /></label>
        <label className="approval-filter-keyword">검색어<input value={filters.keyword} onChange={update('keyword')} placeholder="문서명·작성자" /></label>
        <button type="button" className="approval-refresh" onClick={onRefresh} disabled={loading}>새로고침</button>
      </div>
    </section>
  );
}
