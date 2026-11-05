// 위험성평가 화면 계산 (React 없이 테스트할 수 있게 분리). 저장 본문 검사는 기존 job-forms.riskAssessmentBody 를 그대로 쓴다.

export const RISK_LEVEL_TEXT = Object.freeze({ HIGH: '높음', MEDIUM: '보통', LOW: '낮음' });
export const RISK_LEVEL_TONES = Object.freeze({ HIGH: 'block', MEDIUM: 'warn', LOW: 'done' });
const ORDER = { LOW: 0, MEDIUM: 1, HIGH: 2 };

export const blankRiskItem = (seq) => ({
  seq, workStep: '', hazard: '', accidentType: '', frequency: '', severity: '',
  riskLevel: 'MEDIUM', controls: '', residualFrequency: '', residualSeverity: '',
});

/** 서버 항목 → 입력칸 값(문자열) */
export function riskItemForForm(item, index) {
  return {
    seq: index + 1,
    workStep: item.workStep ?? '',
    hazard: item.hazard ?? '',
    accidentType: item.accidentType ?? '',
    frequency: String(item.frequency ?? ''),
    severity: String(item.severity ?? ''),
    riskLevel: item.riskLevel ?? 'MEDIUM',
    computedLevel: item.computedLevel,
    controls: item.controls ?? '',
    residualFrequency: item.residualFrequency == null ? '' : String(item.residualFrequency),
    residualSeverity: item.residualSeverity == null ? '' : String(item.residualSeverity),
  };
}

const score = (a, b) => {
  const x = Number(a);
  const y = Number(b);
  return Number.isInteger(x) && Number.isInteger(y) && x >= 1 && x <= 5 && y >= 1 && y <= 5 ? x * y : null;
};

/** 빈도×강도 → 등급 (12 이상 높음, 6 이상 보통, 그 아래 낮음). 서버와 같은 기준 */
export function levelOfScore(value) {
  if (value == null) return null;
  return value >= 12 ? 'HIGH' : value >= 6 ? 'MEDIUM' : 'LOW';
}

/** 항목 하나의 점수·계산 등급·저장 시 등급(선택이 계산보다 낮으면 서버가 올림) */
export function itemScore(item) {
  const before = score(item.frequency, item.severity);
  const after = score(item.residualFrequency, item.residualSeverity);
  const computed = levelOfScore(before);
  const raised = computed && ORDER[item.riskLevel] < ORDER[computed];
  return { before, after, computed, saved: raised ? computed : item.riskLevel, raised: Boolean(raised) };
}

/** 등급별 개수 (저장 시 등급 기준) */
export function levelCounts(items = []) {
  const counts = { HIGH: 0, MEDIUM: 0, LOW: 0 };
  for (const item of items) counts[itemScore(item).saved] += 1;
  return counts;
}

/** 문서 단계: 작성 → 승인 요청 → 승인 */
export function riskSteps(risk) {
  const status = risk?.status;
  return [
    { key: 'write', label: '작성', state: !risk ? 'current' : status === 'DRAFT' ? 'current' : status === 'REJECTED' ? 'problem' : 'done', hint: !risk ? '새 평가' : status === 'REJECTED' ? '반려 · 새 판 작성' : status === 'DRAFT' ? '작성 중' : '' },
    { key: 'submit', label: '승인 요청', state: ['PENDING', 'APPROVED'].includes(status) ? 'done' : 'todo', hint: status === 'PENDING' ? '요청함' : '' },
    { key: 'approve', label: '승인', state: status === 'APPROVED' ? 'done' : status === 'PENDING' ? 'current' : status === 'REJECTED' ? 'problem' : 'todo', hint: status === 'APPROVED' ? '완료' : status === 'PENDING' ? '대기' : status === 'REJECTED' ? '반려' : '' },
  ];
}
