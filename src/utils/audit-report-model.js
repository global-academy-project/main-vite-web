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

const ymd = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

/**
 * 만들기 화면의 기본 기간: 이번 달 1일 ~ 오늘 (브라우저 날짜 기준, 11/20).
 * toISOString() 은 UTC 라서 한국 시간에서는 1일이 전달 말일로, 오전 9시 전에는 오늘이 어제로 바뀌었다.
 */
export function defaultAuditPeriod(now = new Date()) {
  return { dateFrom: ymd(new Date(now.getFullYear(), now.getMonth(), 1)), dateTo: ymd(now) };
}

/**
 * "검토 필요" 안내 문구. 예전 요약(항목별 수치 검증)에서 불일치가 있었던 보고서(overallVerification=FAIL)만 불일치 안내,
 * 구성기 응답(11/20, 항목별 검증 없음)은 확인 요청. 검토 필요가 아니면 null.
 */
export function reviewNotice(report) {
  if (report?.status !== 'REVIEW_REQUIRED') return null;
  if (report.overallVerification === 'FAIL') return 'AI 요약의 수치가 집계와 맞지 않는 항목이 있습니다. 항목의 "불일치"를 확인하고 요약을 고쳐 주세요.';
  return 'AI가 집계를 바탕으로 만든 요약입니다. 항목별 요약과 집계를 확인하고, 필요하면 고쳐 저장해 주세요.';
}

/** 항목 검증 배지: 검증 결과가 있을 때만 (구성기 응답은 항목별 검증이 없어 배지를 보이지 않는다) */
export function verificationBadge(item) {
  const status = item?.verification?.status;
  if (!status) return null;
  return { className: String(status).toLowerCase(), label: VERIFICATION_LABELS[status] ?? status };
}
