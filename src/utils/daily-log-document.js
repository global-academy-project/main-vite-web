const textOf = (value) => {
  if (value == null) return '';
  if (Array.isArray(value)) return value.map(textOf).filter(Boolean).join('\n');
  return String(value);
};

const firstValue = (...values) => values.find((value) => value != null && value !== '');

/** API 초안 JSON을 공사안전 점검일지 인쇄 양식의 고정 필드로 변환합니다. */
export function normalizeDailyLogDocument(log) {
  const source = log?.content || log?.document?.content || log?.document || log || {};

  return {
    siteName: textOf(firstValue(source.siteName, source.site_name)),
    workerName: textOf(firstValue(source.workerName, source.worker_name)),
    birthDate: textOf(firstValue(source.birthDate, source.birth_date)),
    position: textOf(source.position),
    company: textOf(source.company),
    workType: textOf(firstValue(source.workType, source.work_type)),
    healthStatus: textOf(firstValue(source.healthStatus, source.health_status)),
    specialNotes: textOf(firstValue(source.specialNotes, source.special_notes)),
    workContent: textOf(firstValue(source.workContent, source.work_content)),
    safetyRules: textOf(firstValue(source.safetyRules, source.safety_rules)),
    riskFactors: textOf(firstValue(source.riskFactors, source.risk_factors)),
    aiSummary: textOf(firstValue(
      source.aiSummary,
      source.ai_summary,
      source.summary,
    )),
  };
}

export function missingDailyLogDocumentFields(document) {
  return [
    ['siteName', '현장'],
    ['workerName', '성명'],
    ['workContent', '작업내용'],
    ['safetyRules', '안전수칙'],
    ['riskFactors', '위험요인'],
  ].filter(([field]) => !document?.[field]?.trim()).map(([, label]) => label);
}

