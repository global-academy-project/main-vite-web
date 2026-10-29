const labels = {
  PENDING: '승인 대기',
  APPROVED: '승인 완료',
  REJECTED: '반려',
  CANCELED: '취소',
  REVISION_REQUESTED: '보완 요청',
};

export default function ApprovalStatusBadge({ status }) {
  return <span className={`pill approval-status-${String(status || '').toLowerCase()}`}>{labels[status] || status || '-'}</span>;
}
