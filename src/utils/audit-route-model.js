// 작업 등록 대화의 감사 분기 (AI 서버 route.target=AUDIT_REPORT → 메인 서버가 감사 대응 보고서를 만들거나 같은 보고서에 연결) 화면 규칙

const positiveId = (value) => Number.isSafeInteger(value) && value > 0;

/**
 * 대화 카드에 보일 감사 대응 보고서 번호. 감사 분기로 끝난(DONE) 실행이고 서버가 보고서를 연결했을 때만.
 * 권한·기간 때문에 거절된 실행은 auditReportId 가 null 이라 카드가 없다 (사유는 대화 메시지로 보인다).
 */
export function auditRouteReportId(run) {
  if (!run || run.status !== 'DONE' || run.result?.route?.target !== 'AUDIT_REPORT') return null;
  return positiveId(run.auditReportId) ? run.auditReportId : null;
}

/** 감사 대응 보고서가 아직 요약 중인가 (카드가 다시 조회하는 동안) */
export const auditReportGenerating = (report) => report?.status === 'GENERATING';

/**
 * 카드 모양. 상태 이름은 서버가 준 statusLabel 을 쓰고 내부 코드(GENERATING 등)는 보이지 않는다.
 *  - 요약 중: 진행 표시 + 중지 (만들고 있는 보고서를 지운다)
 *  - 초안·검토 필요: 감사 대응 화면으로 이동
 *  - 요약 실패: 감사 대응 화면으로 이동 (그 화면에서 다시 요약)
 *  - 지움(중지했거나 다른 곳에서 지움): 이동·중지 없음
 */
export function auditCardView({ report, stopped = false, missing = false } = {}) {
  if (stopped) return { tone: 'info', label: '중지함', note: '만들던 감사 대응 보고서를 지웠습니다.', canOpen: false, canStop: false };
  if (missing) return { tone: 'info', label: '없음', note: '감사 대응 보고서가 지워졌거나 찾을 수 없습니다.', canOpen: false, canStop: false };
  if (!report) return null;
  const label = report.statusLabel || '확인 중';
  switch (report.status) {
    case 'GENERATING':
      return { tone: 'wait', label, note: '기록을 모아 요약하고 있습니다. 끝나면 감사 대응 화면에서 볼 수 있습니다.', canOpen: false, canStop: true };
    case 'FAILED':
      return { tone: 'block', label, note: 'AI 요약을 마치지 못했습니다. 감사 대응 화면에서 다시 요약할 수 있습니다.', canOpen: true, canStop: false };
    case 'REVIEW_REQUIRED':
      return { tone: 'warn', label, note: '요약이 끝났습니다. 감사 대응 화면에서 내용을 확인해 주세요.', canOpen: true, canStop: false };
    default:
      return { tone: 'done', label, note: '요약이 끝났습니다. 감사 대응 화면에서 내용을 확인해 주세요.', canOpen: true, canStop: false };
  }
}
