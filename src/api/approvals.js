import { api } from './client';

// API: GET /api/v1/sites/{siteId}/approvals/pending
// CALLED_BY: src/pages/approvals/approval-inbox.jsx
export function getPendingApprovals(siteId) {
  return api(`/api/v1/sites/${siteId}/approvals/pending`);
}

// API: GET /api/v1/sites/{siteId}/approvals?mine=requested
// TODO: BACKEND CONTRACT REQUIRED if the server route is not deployed.
export function getRequestedApprovals(siteId) {
  return api(`/api/v1/sites/${siteId}/approvals?mine=requested`);
}

// API: GET /api/v1/approvals/{approvalId}
export function getApproval(approvalId) {
  return api(`/api/v1/approvals/${approvalId}`);
}

// API: POST /api/v1/approvals/{approvalId}/approve
// FLOW: current PENDING step -> next PENDING or final APPROVED
export function approveApproval(approvalId, comment = '') {
  return api(`/api/v1/approvals/${approvalId}/approve`, { method: 'POST', body: { comment } });
}

// API: POST /api/v1/approvals/{approvalId}/reject
// FLOW: reject (revision request) -> REJECTED; never creates an approval step.
export function rejectApproval(approvalId, reason, missingItems = []) {
  return api(`/api/v1/approvals/${approvalId}/reject`, {
    method: 'POST', body: { reason, missingItems },
  });
}

// API: POST /api/v1/approvals/{approvalId}/cancel
// TODO: BACKEND CONTRACT REQUIRED if the server route is not deployed.
export function cancelApproval(approvalId) {
  return api(`/api/v1/approvals/${approvalId}/cancel`, { method: 'POST' });
}
