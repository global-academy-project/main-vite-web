export default function ApprovalSummary({ approval }) {
  const summary = approval.summary || approval;
  return (
    <section className="panel records-detail-grid">
      <div><span>현재 상태</span><strong>{summary.status || '-'}</strong></div>
      <div><span>작성자</span><strong>{summary.requestedByName || summary.requesterName || '-'}</strong></div>
      <div><span>현재 단계</span><strong>{summary.currentStepLabel || summary.currentStep || '-'}</strong></div>
      <div><span>요청 시각</span><strong>{summary.requestedAt?.replace('T', ' ') || '-'}</strong></div>
    </section>
  );
}
