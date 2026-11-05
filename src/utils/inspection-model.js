/** 점검표 표시·계산 (서버 InspectionResult.of 와 같은 규칙) */

export const INSPECTION_STATUS_LABELS = Object.freeze({ DRAFT: '작성 중', PENDING: '승인 대기', APPROVED: '승인', REJECTED: '반려' });
export const INSPECTION_STATUS_TONES = Object.freeze({ DRAFT: 'todo', PENDING: 'wait', APPROVED: 'done', REJECTED: 'block' });
export const INSPECTION_RESULT_LABELS = Object.freeze({ PASS: '적합', PARTIAL: '일부 불량', FAIL: '불량' });
export const INSPECTION_RESULT_TONES = Object.freeze({ PASS: 'done', PARTIAL: 'warn', FAIL: 'block' });
export const ITEM_RESULT_OPTIONS = Object.freeze([
  { value: 'OK', label: '양호' }, { value: 'NG', label: '불량' }, { value: 'NA', label: '해당 없음' },
]);
export const TARGET_LABELS = Object.freeze({ ZONE: '구역', EQUIPMENT: '설비' });
export const NOTE_MAX = 300;

/** 해당 없음은 빼고: 불량 없음 PASS / 일부 불량 PARTIAL / 전부 불량 FAIL. 빈 항목이 있으면 null */
export function expectedResult(answers) {
  const values = Object.values(answers);
  if (!values.length || values.some((answer) => !answer?.result)) return null;
  const counted = values.filter((answer) => answer.result !== 'NA').length;
  const ng = values.filter((answer) => answer.result === 'NG').length;
  if (ng === 0) return 'PASS';
  return ng === counted ? 'FAIL' : 'PARTIAL';
}

/** 서버 항목 → 화면 답 { itemCode: { result, note } } */
export const answersOf = (inspection) => Object.fromEntries((inspection?.items ?? [])
  .map((item) => [item.itemCode, { result: item.result ?? null, note: item.note ?? '' }]));

export function answerCounts(answers) {
  const values = Object.values(answers);
  return {
    total: values.length,
    answered: values.filter((answer) => answer.result).length,
    OK: values.filter((answer) => answer.result === 'OK').length,
    NG: values.filter((answer) => answer.result === 'NG').length,
    NA: values.filter((answer) => answer.result === 'NA').length,
    missingNote: values.filter((answer) => answer.result === 'NG' && !answer.note?.trim()).length,
  };
}

/** 서버 값과 다른 항목 코드 (화면에서 고친 것) */
export function diffCodes(inspection, answers) {
  const saved = answersOf(inspection);
  return Object.entries(answers)
    .filter(([code, answer]) => (saved[code]?.result ?? null) !== (answer.result ?? null)
      || (saved[code]?.note ?? '').trim() !== (answer.note ?? '').trim())
    .map(([code]) => code);
}

/** 저장할 항목: 서버 값과 달라진 것만 (NG 는 내용 필수라 빈 내용이면 보내지 않고 화면에 남겨 둔다) */
export function changedAnswers(inspection, answers) {
  return diffCodes(inspection, answers).map((code) => [code, answers[code]])
    .filter(([, answer]) => answer.result !== 'NG' || answer.note?.trim())
    .map(([itemCode, answer]) => ({ itemCode, result: answer.result ?? null, note: answer.note?.trim() || null }));
}

/** 양식 구역 순서대로 묶기 (서버 items[].section. 양식에서 빠진 항목은 "기타") */
export function groupItems(items = []) {
  const groups = [];
  for (const item of items) {
    const title = item.section ?? '기타';
    let group = groups.find((entry) => entry.title === title);
    if (!group) { group = { title, items: [] }; groups.push(group); }
    group.items.push(item);
  }
  return groups;
}

export function targetName(inspection) {
  if (!inspection) return '';
  if (inspection.targetType === 'EQUIPMENT') return inspection.equipmentName ?? `설비 #${inspection.equipmentId}`;
  return inspection.zoneName ?? `구역 #${inspection.zoneId}`;
}

export function inspectionSteps(inspection, { dirty = false } = {}) {
  const status = inspection?.status;
  const answered = inspection?.answered ?? 0;
  const total = inspection?.total ?? 0;
  const filled = status && status !== 'DRAFT' ? 'done' : answered === total && total > 0 && !dirty ? 'done' : inspection ? 'current' : 'todo';
  return [
    { key: 'create', label: '점검표 만들기', state: inspection ? 'done' : 'current', hint: inspection ? `#${inspection.inspectionId}` : '대상·양식' },
    { key: 'fill', label: '항목 점검', state: filled, hint: inspection ? `${answered}/${total}` : '' },
    { key: 'submit', label: '제출', state: status === 'PENDING' || status === 'APPROVED' ? 'done' : filled === 'done' ? 'current' : 'todo' },
    { key: 'approve', label: '승인', state: status === 'APPROVED' ? 'done' : status === 'PENDING' ? 'current' : 'todo', hint: status === 'PENDING' ? '대기 중' : '' },
  ];
}
