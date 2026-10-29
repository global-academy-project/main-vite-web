import { api } from './client';

export function getPendingApprovals(siteId) {
  return api(`/api/v1/sites/${siteId}/approvals/pending`);
}

export function getApproval(approvalId) {
  return api(`/api/v1/approvals/${approvalId}`);
}

export function approveApproval(approvalId, comment = '') {
  return api(`/api/v1/approvals/${approvalId}/approve`, { method: 'POST', body: { comment } });
}

export function rejectApproval(approvalId, comment) {
  return api(`/api/v1/approvals/${approvalId}/reject`, { method: 'POST', body: { comment } });
}

export function requestApprovalRevision(approvalId, comment) {
  return api(`/api/v1/approvals/${approvalId}/request-revision`, { method: 'POST', body: { comment } });
}
