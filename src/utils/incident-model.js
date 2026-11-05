// 아차사고 화면 계산 (React 없이 테스트할 수 있게 분리)
import { TAG_LABELS } from './agentic-rag-tags.js';

// 서버 상태값 → 화면 말. 모르는 값은 그대로 보인다.
export const INCIDENT_STATUS_LABELS = Object.freeze({ REPORTED: '접수', TAGGING: '태깅 중', TAGGED: '태그 완료', REVIEWED: '검토 완료' });

// 중대도 → 배지 색
const SEVERITY_TONES = Object.freeze({ FATAL: 'block', SERIOUS: 'block', MINOR: 'warn', NEAR_MISS: 'info' });

export const EMPTY_INCIDENT_FILTERS = Object.freeze({ zoneId: '', from: '', to: '', keyword: '', view: '' });

const pad = (value) => String(value).padStart(2, '0');
const dayOf = (value) => (typeof value === 'string' && value.length >= 10 ? value.slice(0, 10) : '');
const localDay = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

/** 태그 하나의 이름 (서버 코드표 → 기본 이름 → 코드 그대로) */
export function tagLabel(tag, codes = []) {
  return codes.find((code) => code.axis === tag.axis && code.code === tag.value)?.label ?? TAG_LABELS[tag.axis]?.[tag.value] ?? tag.value;
}

/** 중대도 태그 (없으면 null) → { label, tone } */
export function severityOf(incident, codes = []) {
  const tag = incident.tags?.find((item) => item.axis === 'SEVERITY');
  return tag ? { label: tagLabel(tag, codes), tone: SEVERITY_TONES[tag.value] ?? 'neutral' } : null;
}

/** 표에 보일 사고 유형 이름들 */
export const accidentTypes = (incident, codes = []) => (incident.tags ?? []).filter((tag) => tag.axis === 'ACCIDENT_TYPE').map((tag) => tagLabel(tag, codes));

/** 건수 카드: 전체 · 이번 주(최근 7일) · 태그 없음 */
export function incidentStats(incidents = [], now = new Date()) {
  const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
  const since = localDay(weekStart);
  return {
    total: incidents.length,
    week: incidents.filter((item) => dayOf(item.occurredAt) >= since).length,
    untagged: incidents.filter((item) => !item.tags?.length).length,
  };
}

/** 화면 안 조건 (서버 목록은 최근 50건이라 받은 목록 안에서만 고른다) */
export function filterIncidents(incidents = [], filters = EMPTY_INCIDENT_FILTERS, now = new Date()) {
  const keyword = filters.keyword?.trim().toLowerCase() ?? '';
  const since = filters.view === 'week' ? localDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6)) : '';
  return incidents.filter((item) => {
    const day = dayOf(item.occurredAt);
    if (filters.zoneId && String(item.zoneId ?? '') !== String(filters.zoneId)) return false;
    if (filters.from && day < filters.from) return false;
    if (filters.to && day > filters.to) return false;
    if (since && day < since) return false;
    if (filters.view === 'untagged' && item.tags?.length) return false;
    if (keyword && ![item.title, item.description, item.immediateAction].some((text) => text?.toLowerCase().includes(keyword))) return false;
    return true;
  });
}

export const hasIncidentFilters = (filters) => Boolean(filters.zoneId || filters.from || filters.to || filters.keyword?.trim() || filters.view);

/** 발생 일시 짧게: 11/05 14:20 */
export function shortOccurred(value) {
  if (typeof value !== 'string' || value.length < 16) return value ?? '';
  return `${Number(value.slice(5, 7))}/${Number(value.slice(8, 10))} ${value.slice(11, 16)}`;
}

/** 새 보고 입력 검사 (서버 규칙: 제목 200자, 상황 20000자, 조치 10000자, 관련 작업은 양의 정수) */
export function validateIncidentForm(form) {
  const errors = {};
  if (!form.title.trim()) errors.title = '보고 제목을 입력하세요.';
  else if (form.title.length > 200) errors.title = '보고 제목은 200자까지 입력할 수 있습니다.';
  if (!form.occurredAt) errors.occurredAt = '발생 일시를 입력하세요.';
  if (!form.description.trim()) errors.description = '발생 상황을 입력하세요.';
  else if (form.description.length > 20000) errors.description = '발생 상황은 20000자까지 입력할 수 있습니다.';
  if (form.immediateAction.length > 10000) errors.immediateAction = '즉시 조치는 10000자까지 입력할 수 있습니다.';
  if (form.workId && (!/^[1-9]\d*$/.test(form.workId) || !Number.isSafeInteger(Number(form.workId)))) errors.workId = '관련 작업 ID는 정확한 양의 정수로 입력하세요.';
  return errors;
}
