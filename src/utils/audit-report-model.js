// 감사 대응 보고서 화면 규칙: 집계 이름(서버 기록 조회 summary 키)과 검증 표시
export const STAT_LABELS = Object.freeze({
  count: '건수',
  works: '작업', written: '평가 작성', approved: '승인', missing: '미작성', rate: '실시율', approvedRate: '승인율',
  permits: '허가', requested: '승인 요청', rejected: '반려', canceled: '취소', blocked: '차단', approvalRate: '승인률',
  actions: '조치', completed: '완료', verified: '확인 완료', open: '미완료', overdue: '기한 지남', completionRate: '조치율',
});

export const VERIFICATION_LABELS = Object.freeze({ MATCH: '수치 일치', MISMATCH: '불일치' });

/** stats 객체 → [[키, 표시값]] (비율은 %, 값 없으면 -) */
export function statEntries(stats) {
  if (!stats || typeof stats !== 'object' || Array.isArray(stats)) return [];
  return Object.entries(stats)
    .filter(([, value]) => value === null || ['number', 'string', 'boolean'].includes(typeof value))
    .map(([key, value]) => {
      if (value === null || value === '') return [key, '-'];
      if (/rate$/i.test(key)) return [key, `${value}%`];
      return [key, String(value)];
    });
}
