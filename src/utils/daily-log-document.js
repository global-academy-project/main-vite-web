const textOf = (value) => {
  if (value == null) return '';
  if (Array.isArray(value)) return value.map(textOf).filter(Boolean).join('\n');
  return String(value);
};

const firstValue = (...values) => values.find((value) => value != null && value !== '');
const WORK_TYPE_LABELS = Object.freeze({ GENERAL: '일반', HOT: '화기', CONFINED: '밀폐공간', HEIGHT: '고소' });

const countOf = (stats, key) => {
  const value = stats?.[key]?.total;
  return Number.isFinite(value) ? `${value}건` : '';
};

function workContentOf(source) {
  const stats = source?.stats || {};
  return [
    ['작업', countOf(stats, 'works')],
    ['작업허가', countOf(stats, 'permits')],
    ['TBM', countOf(stats, 'tbm')],
    ['점검표', countOf(stats, 'inspections')],
  ].filter(([, value]) => value).map(([label, value]) => `${label} ${value}`).join('\n');
}

function riskFactorsOf(source) {
  return (Array.isArray(source?.checks) ? source.checks : [])
    .map((item) => {
      const label = item?.label || item?.type;
      return label && item?.count != null ? `${label}: ${item.count}건` : '';
    })
    .filter(Boolean)
    .join('\n');
}

function evidenceOf(source) {
  return (Array.isArray(source?.evidence) ? source.evidence : [])
    .map((item) => {
      const title = item?.title || (item?.targetType && item?.targetId != null
        ? `${item.targetType} #${item.targetId}` : '');
      return title ? `${title}${item.detail ? ` · ${item.detail}` : ''}` : '';
    })
    .filter(Boolean)
    .join('\n');
}

function tbmPhotoEvidenceOf(photos) {
  return (Array.isArray(photos) ? photos : [])
    .map((photo) => {
      const id = photo?.attachmentId != null ? `사진 #${photo.attachmentId}` : 'TBM 사진';
      const takenAt = photo?.takenAt ? `촬영 ${String(photo.takenAt).replace('T', ' ').slice(0, 16)}` : '촬영 시각 없음';
      const result = photo?.check?.result ? ` · ${photo.check.result}` : '';
      return `${id} · ${takenAt}${result}`;
    })
    .filter(Boolean)
    .join('\n');
}

/** API 초안 JSON을 공사안전 점검일지 인쇄 양식의 고정 필드로 변환합니다. */
export function normalizeDailyLogDocument(log, context = {}) {
  const source = log?.content || log?.document?.content || log?.document || log || {};
  const user = context.user || {};
  const site = context.site || {};
  const workTypes = [...new Set((context.workTypes || source.workTypes || [])
    .map((type) => WORK_TYPE_LABELS[type] || type)
    .filter(Boolean))];

  return {
    siteName: textOf(firstValue(source.siteName, source.site_name, site.name)),
    workerName: textOf(firstValue(source.workerName, source.worker_name, source.writerName, source.writer_name, user.name)),
    birthDate: textOf(firstValue(source.birthDate, source.birth_date)),
    position: textOf(firstValue(source.position, user.jobTitle)),
    company: textOf(firstValue(source.company, user.department)),
    workType: textOf(firstValue(source.workType, source.work_type, workTypes.join(', '))),
    healthStatus: textOf(firstValue(source.healthStatus, source.health_status)),
    specialNotes: textOf(firstValue(source.specialNotes, source.special_notes)),
    workContent: textOf(firstValue(source.workContent, source.work_content, workContentOf(source))),
    safetyRules: textOf(firstValue(source.safetyRules, source.safety_rules)),
    riskFactors: textOf(firstValue(source.riskFactors, source.risk_factors, riskFactorsOf(source))),
    aiSummary: textOf(firstValue(
      source.aiSummary,
      source.ai_summary,
      source.summary,
    )),
    evidence: tbmPhotoEvidenceOf(context.tbmPhotos) || evidenceOf(source),
  };
}

export function missingDailyLogDocumentFields() {
  // Spring 응답에 없는 양식 필드는 빈칸으로 출력하며 인쇄를 막지 않는다.
  return [];
}

