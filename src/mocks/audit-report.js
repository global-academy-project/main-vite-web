export const AUDIT_QUERY_TYPES = Object.freeze([
  { key: 'risk_assessment_rate', label: '위험성평가 실시율' },
  { key: 'permit_approval_statistics', label: '허가 승인 현황' },
  { key: 'corrective_action_rate', label: '지적사항 조치율' },
  { key: 'blocked_records', label: '차단 기록' },
  { key: 'missing_measurements', label: '측정값 없이 승인된 허가' },
]);

export const auditReportFixture = {
  reportId: 1001, siteId: 1, from: '2026-11-01', to: '2026-11-13', status: 'REVIEW_REQUIRED', overallVerification: 'PASS',
  items: [
    { queryType: 'risk_assessment_rate', title: '위험성평가 실시율', stats: { total: 20, completed: 18, rate: 90.0 }, summary: '위험성평가는 총 20건 중 18건이 실시되어 실시율은 90.0%입니다.', verificationStatus: 'MATCH', evidence: [{ type: 'RISK', id: 7, label: '위험성평가 #7' }] },
    { queryType: 'permit_approval_statistics', title: '허가 승인 현황', stats: { total: 20, approved: 18, pending: 1, rejected: 1 }, summary: '작업허가 20건 중 승인 18건, 승인 대기 1건, 반려 1건입니다.', verificationStatus: 'MATCH', evidence: [{ type: 'PERMIT', id: 5001, label: '허가 승인 통계' }] },
    { queryType: 'corrective_action_rate', title: '지적사항 조치율', stats: { total: 10, completed: 7, open: 3, rate: 70.0 }, summary: '지적사항 10건 중 7건이 조치되어 조치율은 70.0%입니다.', verificationStatus: 'MATCH', evidence: [{ type: 'CORRECTIVE_ACTION', id: 31, label: '미완료 개선조치 #31' }] },
    { queryType: 'blocked_records', title: '차단 기록', stats: { total: 3, blocked: 3 }, summary: '차단 기록은 총 3건이며, 차단 판정은 3건입니다.', verificationStatus: 'MATCH', evidence: [{ type: 'PERMIT', id: 5004, label: '차단 허가 #5004' }] },
    { queryType: 'missing_measurements', title: '측정값 없이 승인된 허가', stats: { total: 2, missing: 2 }, summary: '측정값 없이 승인된 허가는 총 2건입니다.', verificationStatus: 'MATCH', evidence: [{ type: 'PERMIT', id: 5007, label: '측정값 누락 허가 #5007' }] },
  ],
  previousUnresolvedItems: [
    { id: 31, title: '가스측정기 교정 기록 보완', status: 'OPEN', dueDate: '2026-11-14' },
    { id: 32, title: 'TBM 참석자 서명 누락 조치', status: 'OPEN', dueDate: '2026-11-12' },
  ],
};
