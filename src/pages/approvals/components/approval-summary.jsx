export default function ApprovalSummary({ approval }) {
  return (
    <section className="panel records-detail-grid">
      <div><span>현재 상태</span><strong>{approval.status}</strong></div>
      <div><span>작성자</span><strong>{approval.requesterName || '-'}</strong></div>
      <div><span>현재 단계</span><strong>{approval.currentStep || '-'}</strong></div>
      <div><span>요청 시각</span><strong>{approval.requestedAt?.replace('T', ' ') || '-'}</strong></div>
    </section>
  );
}
