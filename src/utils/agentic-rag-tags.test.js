import test from 'node:test';
import assert from 'node:assert/strict';
import { getTagEntries, toIncidentFilters } from './agentic-rag-tags.js';

test('five-axis API filters use canonical codes and deduplicate values', () => {
  const tags = [
    { axis: 'SEVERITY', value: 'NEAR_MISS' },
    { axis: 'ACCIDENT_TYPE', value: 'TRIP' },
    { axis: 'ACCIDENT_TYPE', value: 'TRIP' },
    { axis: 'HAZARD', value: 'ELECTRICAL' },
    { axis: 'WORK_TYPE', value: 'ELECTRICAL' },
    { axis: 'SUBSTANCE', value: '108-88-3' },
  ];
  assert.deepEqual(toIncidentFilters(tags), {
    severity: ['NEAR_MISS'], accidentType: ['TRIP'], hazard: ['ELECTRICAL'],
    workType: ['ELECTRICAL'], cas: ['108-88-3'],
  });
  assert.equal(getTagEntries(tags).find((entry) => entry.axis === 'SUBSTANCE').values[0].label, '108-88-3');
});

test('empty tags preserve the five-axis filter shape', () => {
  assert.deepEqual(toIncidentFilters([]), {
    severity: [], accidentType: [], hazard: [], workType: [], cas: [],
  });
});

test('invalid axis, localized values, CAS, and sources are rejected', () => {
  for (const tag of [
    { axis: 'ZONE', value: 'T-105' },
    { axis: 'ACCIDENT_TYPE', value: '넘어짐' },
    { axis: 'SUBSTANCE', value: 'toluene' },
    { axis: 'HAZARD', value: 'ELECTRIC' },
    { axis: 'ACCIDENT_TYPE', value: 'ELECTRICAL' },
    { axis: 'WORK_TYPE', value: 'GENERAL', source: 'SYSTEM' },
  ]) assert.throws(() => toIncidentFilters([tag]));
});

test('confidence must be a finite numeric value between zero and one', () => {
  for (const confidence of [NaN, Infinity, -0.1, 1.1, '0.9']) {
    assert.throws(() => toIncidentFilters([
      { axis: 'ACCIDENT_TYPE', value: 'TRIP', source: 'AI', confidence },
    ]), RangeError);
  }
  for (const confidence of [0, 1, null]) {
    assert.doesNotThrow(() => toIncidentFilters([
      { axis: 'ACCIDENT_TYPE', value: 'TRIP', source: 'AI', confidence },
    ]));
  }
});
