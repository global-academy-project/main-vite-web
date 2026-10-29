export const TAG_AXES = [
  { axis: 'SEVERITY', label: '중대도' },
  { axis: 'ACCIDENT_TYPE', label: '사고 유형' },
  { axis: 'HAZARD', label: '유해·위험요인' },
  { axis: 'WORK_TYPE', label: '작업 유형' },
  { axis: 'SUBSTANCE', label: '물질(CAS)' },
];

export const TAG_LABELS = {
  SEVERITY: {
    NEAR_MISS: '아차사고',
    MINOR: '경상',
    SERIOUS: '중상',
    FATAL: '사망',
  },
  ACCIDENT_TYPE: {
    FIRE: '화재',
    EXPLOSION: '폭발·파열',
    LEAK: '누출·접촉',
    ASPHYXIATION: '질식',
    FALL: '떨어짐',
    TRIP: '넘어짐',
    CAUGHT: '끼임',
    STRUCK: '맞음',
    COLLAPSE: '무너짐',
    ELECTRIC: '감전',
  },
  HAZARD: {
    MECHANICAL: '기계적',
    ELECTRICAL: '전기적',
    CHEMICAL: '화학적',
    ENVIRONMENTAL: '작업환경',
    HUMAN: '인적·관리',
  },
  WORK_TYPE: {
    GENERAL: '일반',
    HOT: '화기',
    CONFINED: '밀폐공간',
    HEIGHT: '고소',
    ELECTRICAL: '전기',
    LIFTING: '중량물·양중',
  },
};

const AXIS_WEIGHTS = {
  SEVERITY: 1,
  ACCIDENT_TYPE: 3,
  HAZARD: 2,
  WORK_TYPE: 1,
  SUBSTANCE: 2,
};

const daysAgo = (days) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
};

export const sampleNearMiss = {
  id: 1,
  siteId: 1,
  zoneId: 1,
  occurredAt: daysAgo(3),
  title: '탱크 맨홀 근처 미끄러짐',
  description: '맨홀 주변 기름 유출로 미끄러질 뻔함',
  immediateAction: null,
  status: 'TAGGED',
  reporterId: 1,
  tags: [
    { recordType: 'NEAR_MISS', recordId: 1, axis: 'SEVERITY', value: 'NEAR_MISS', source: 'AI', confidence: 0.99 },
    { recordType: 'NEAR_MISS', recordId: 1, axis: 'ACCIDENT_TYPE', value: 'TRIP', source: 'AI', confidence: 0.92 },
    { recordType: 'NEAR_MISS', recordId: 1, axis: 'HAZARD', value: 'ENVIRONMENTAL', source: 'AI', confidence: 0.88 },
  ],
};

function assertTags(tags) {
  if (!Array.isArray(tags)) {
    throw new TypeError('태그는 record_tags 형식의 배열이어야 합니다.');
  }

  for (const tag of tags) {
    if (!TAG_AXES.some(({ axis }) => axis === tag.axis)) {
      throw new Error(`알 수 없는 태그 축: ${tag.axis}`);
    }

    if (tag.axis === 'SUBSTANCE') {
      if (!/^\d{2,7}-\d{2}-\d$/.test(tag.value)) {
        throw new Error(`SUBSTANCE 태그는 CAS 번호여야 합니다: ${tag.value}`);
      }
    } else if (!Object.hasOwn(TAG_LABELS[tag.axis], tag.value)) {
      throw new Error(`알 수 없는 ${tag.axis} 태그: ${tag.value}`);
    }

    if (tag.source !== undefined && !['AI', 'USER'].includes(tag.source)) {
      throw new Error(`알 수 없는 태그 출처: ${tag.source}`);
    }
    if (tag.confidence != null && (!Number.isFinite(tag.confidence) || tag.confidence < 0 || tag.confidence > 1)) {
      throw new RangeError('태그 confidence는 0과 1 사이여야 합니다.');
    }
  }
}

export function toIncidentFilters(tags) {
  assertTags(tags);
  const keys = {
    SEVERITY: 'severity', ACCIDENT_TYPE: 'accidentType', HAZARD: 'hazard',
    WORK_TYPE: 'workType', SUBSTANCE: 'cas',
  };
  return Object.fromEntries(TAG_AXES.map(({ axis }) => [
    keys[axis], [...new Set(tags.filter((tag) => tag.axis === axis).map((tag) => tag.value))],
  ]));
}

export function getTagEntries(tags) {
  assertTags(tags);
  return TAG_AXES.map(({ axis, label }) => ({
    axis,
    label,
    values: tags
      .filter((tag) => tag.axis === axis)
      .map((tag) => ({
        code: tag.value,
        label: axis === 'SUBSTANCE' ? tag.value : TAG_LABELS[axis][tag.value],
        source: tag.source ?? 'AI',
        confidence: tag.confidence ?? null,
      })),
  }));
}

function tagScore(queryTags, incidentTags) {
  const queryValues = new Set(queryTags.map(({ axis, value }) => `${axis}:${value}`));
  return incidentTags.reduce((score, { axis, value }) => (
    queryValues.has(`${axis}:${value}`) ? score + AXIS_WEIGHTS[axis] : score
  ), 0);
}

export function searchRelatedIncidents({
  incidents,
  siteId,
  zoneId,
  tags,
  limit = 5,
}) {
  if (!Array.isArray(incidents)) {
    throw new TypeError('사고 자료 목록은 배열이어야 합니다.');
  }
  if (!Number.isInteger(limit) || limit < 1) {
    throw new RangeError('검색 결과 limit은 1 이상의 정수여야 합니다.');
  }
  assertTags(tags);

  const stages = [
    { scope: 'same_zone', matches: (item) => item.siteId === siteId && item.zoneId === zoneId },
    { scope: 'same_site', matches: (item) => item.siteId === siteId },
    { scope: 'tag_similarity', matches: () => true },
  ];

  const attempts = [];
  for (const stage of stages) {
    attempts.push(stage.scope);
    const results = incidents
      .filter(stage.matches)
      .map((incident) => {
        assertTags(incident.tags);
        return { ...incident, relevance: tagScore(tags, incident.tags) };
      })
      .sort((left, right) => right.relevance - left.relevance)
      .slice(0, limit);

    if (results.length) return { scope: stage.scope, attempts, results };
  }

  return { scope: 'none', attempts, results: [] };
}
