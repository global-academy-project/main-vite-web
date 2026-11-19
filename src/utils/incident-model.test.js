import test from 'node:test';
import assert from 'node:assert/strict';
import {
  accidentTypes, EMPTY_INCIDENT_FILTERS, filterIncidents, hasIncidentFilters, incidentStats, severityOf, shortOccurred, tagLabel, tagState, validateIncidentForm,
} from './incident-model.js';

const now = new Date(2026, 10, 5, 15, 0);
const list = [
  { nearMissId: 1, zoneId: 3, title: '맨홀 주변 미끄러짐', description: '기름 유출', occurredAt: '2026-11-05T09:10:00', status: 'TAGGED', tags: [{ axis: 'SEVERITY', value: 'NEAR_MISS' }, { axis: 'ACCIDENT_TYPE', value: 'TRIP' }] },
  { nearMissId: 2, zoneId: 4, title: '용접 불티 비산', description: '가연물 근처', occurredAt: '2026-11-01T14:00:00', status: 'REPORTED', tags: [] },
  { nearMissId: 3, zoneId: 3, title: '사다리 흔들림', description: '고정 불량', occurredAt: '2026-10-20T08:00:00', status: 'REVIEWED', tags: [{ axis: 'SEVERITY', value: 'SERIOUS' }] },
];

test('태그 이름은 서버 코드표 → 기본 이름 → 코드 순', () => {
  assert.equal(tagLabel({ axis: 'ACCIDENT_TYPE', value: 'TRIP' }, [{ axis: 'ACCIDENT_TYPE', code: 'TRIP', label: '넘어짐(코드표)' }]), '넘어짐(코드표)');
  assert.equal(tagLabel({ axis: 'ACCIDENT_TYPE', value: 'TRIP' }), '넘어짐');
  assert.equal(tagLabel({ axis: 'HAZARD', value: 'NEW_CODE' }), 'NEW_CODE');
  assert.deepEqual(severityOf(list[2]), { label: '중상', tone: 'block' });
  assert.equal(severityOf(list[1]), null);
  assert.deepEqual(accidentTypes(list[0]), ['넘어짐']);
});

test('건수: 전체 · 최근 7일 · 확정 전', () => {
  assert.deepEqual(incidentStats(list, now), { total: 3, week: 2, unconfirmed: 1 });
  const suggested = { ...list[1], nearMissId: 4, tags: [{ axis: 'SEVERITY', value: 'NEAR_MISS', source: 'AI' }] };
  assert.equal(incidentStats([...list, suggested], now).unconfirmed, 2);   // AI 제안만 있으면 아직 확정 전
});

test('태그 상태: 사람이 저장했으면 확정됨, 보고 직후 제안 태그가 있으면 제안됨, 없으면 미확인', () => {
  assert.equal(tagState(list[0]), 'CONFIRMED');
  assert.equal(tagState(list[2]), 'CONFIRMED');
  assert.equal(tagState(list[1]), 'NONE');
  assert.equal(tagState({ status: 'REPORTED', tags: [{ axis: 'SEVERITY', value: 'NEAR_MISS', source: 'AI' }] }), 'SUGGESTED');
  assert.equal(tagState({ status: 'TAGGED', tags: [] }), 'CONFIRMED');
});

test('조건: 구역 · 기간 · 검색어 · 카드(이번 주, 확정 전)', () => {
  const ids = (filters) => filterIncidents(list, { ...EMPTY_INCIDENT_FILTERS, ...filters }, now).map((item) => item.nearMissId);
  assert.deepEqual(ids({}), [1, 2, 3]);
  assert.deepEqual(ids({ zoneId: '3' }), [1, 3]);
  assert.deepEqual(ids({ from: '2026-11-01', to: '2026-11-04' }), [2]);
  assert.deepEqual(ids({ keyword: '가연물' }), [2]);
  assert.deepEqual(ids({ view: 'week' }), [1, 2]);
  assert.deepEqual(ids({ view: 'unconfirmed' }), [2]);
  assert.equal(hasIncidentFilters(EMPTY_INCIDENT_FILTERS), false);
  assert.equal(hasIncidentFilters({ ...EMPTY_INCIDENT_FILTERS, keyword: ' ' }), false);
  assert.equal(hasIncidentFilters({ ...EMPTY_INCIDENT_FILTERS, view: 'week' }), true);
});

test('발생 일시 짧게, 새 보고 입력 검사', () => {
  assert.equal(shortOccurred('2026-11-05T09:10:00'), '11/5 09:10');
  const empty = { title: '', occurredAt: '', description: '', immediateAction: '', workId: '' };
  assert.deepEqual(Object.keys(validateIncidentForm(empty)).sort(), ['description', 'occurredAt', 'title']);
  assert.deepEqual(validateIncidentForm({ title: '가', occurredAt: '2026-11-05T09:00', description: '나', immediateAction: '', workId: '0' }), { workId: '관련 작업 ID는 정확한 양의 정수로 입력하세요.' });
  assert.deepEqual(validateIncidentForm({ title: '가', occurredAt: '2026-11-05T09:00', description: '나', immediateAction: '', workId: '12' }), {});
});
