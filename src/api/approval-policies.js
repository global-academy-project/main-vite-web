import { api } from './client';

// 현장 결재선 (문서 종류별 결재 단계). 서버: ApprovalPolicyController
// 조회는 현장 권한이 있으면 누구나, 바꾸기는 현장 관리자 이상 (최종 판단은 서버)

// API: GET /api/v1/sites/{siteId}/approval-policies
// 응답: [{ targetType, defaultLine, steps: [{ stepNo, label, requiredRole }] }] (서버가 결재를 지원하는 문서 종류만)
// CALLED_BY: src/hooks/use-approval-lines.js
export function getApprovalLines(siteId) {
  return api(`/api/v1/sites/${siteId}/approval-policies`);
}

// API: PUT /api/v1/sites/{siteId}/approval-policies/{targetType}
// 본문: [{ label, requiredRole }] (순서 = 단계 순서). 빈 목록이면 기본 결재선(1단계 승인 · 승인자)으로 돌아간다
// 이미 올라간 결재에는 영향 없음 (승인 요청 때 결재선을 복사한다)
export function saveApprovalLine(siteId, targetType, steps) {
  return api(`/api/v1/sites/${siteId}/approval-policies/${targetType}`, { method: 'PUT', body: steps });
}
