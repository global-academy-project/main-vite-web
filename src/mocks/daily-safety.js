export const dailySafetyTeams = [
  { teamId: 1, teamName: '배관팀', status: 'DRAFT', signatures: 2, measurements: 1, photos: 0 },
  { teamId: 2, teamName: '용접팀', status: 'NOT_STARTED', signatures: 1, measurements: 2, photos: 1 },
  { teamId: 3, teamName: '설비팀', status: 'COMPLETED', signatures: 0, measurements: 0, photos: 0 },
];

export const dailySafetyMissingItems = [
  { type: 'SIGNATURE_MISSING', label: '서명 누락', count: 2, overdue: false },
  { type: 'MEASUREMENT_MISSING', label: '가스측정값 누락', count: 3, overdue: true },
  { type: 'TBM_MISSING', label: 'TBM 미실시', count: 1, overdue: true },
  { type: 'PHOTO_MISSING', label: 'TBM 사진 누락', count: 1, overdue: false },
  { type: 'DAILY_LOG_MISSING', label: '안전일지 미작성', count: 1, overdue: false },
];

export const dailySafetyFindings = [
  { id: 1, title: '용접기 접지선 미체결', status: 'OPEN' },
  { id: 2, title: '작업구역 통로 적치물', status: 'DONE' },
];

export const dailySafetyEquipmentChecks = [
  { id: 1, equipment: '용접기 1호', result: 'PASS' },
  { id: 2, equipment: '가스측정기 2호', result: 'CHECK' },
];

export const dailySafetyDraft = {
  status: 'DRAFT',
  summary: '오늘 화기작업 3건이 승인됐으며, 측정값 누락 1건과 서명 누락 2건이 있습니다.',
  checks: [
    '화기작업허가 #5001: LEL 측정값 없음',
    'TBM #71: 참석자 10명, 서명 8명',
    'TBM #72: 사진 없음',
  ],
  evidence: [
    '승인된 허가 3건',
    'TBM 2건',
    '장비 점검표 4건',
    '전날 지적사항 2건',
  ],
};

