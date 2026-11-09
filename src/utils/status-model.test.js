import test from 'node:test';
import assert from 'node:assert/strict';
import { clockOf, deadlineRows, entryPath, rangeEnding, stageSegments, statusSegments, summaryBars, summaryTotals, teamRows } from './status-model.js';

test('status segments keep a fixed order and skip zero', () => {
  const segments = statusSegments({ DONE: 1, BLOCKED: 2, DRAFT: 0, APPROVED: 1 });
  assert.deepEqual(segments.map((segment) => segment.status), ['APPROVED', 'BLOCKED', 'DONE']);
  assert.equal(segments[1].label, '차단');
  assert.equal(segments[1].ratio, 0.5);
  assert.deepEqual(statusSegments({}), []);
});

test('entry paths and deadlines', () => {
  assert.equal(entryPath({ targetType: 'DAILY_LOG', targetId: null }, '2026-11-06'), '/job/daily-safety?date=2026-11-06');
  assert.equal(entryPath({ targetType: 'PERMIT', targetId: 5 }, '2026-11-06'), '/job/permits?permitId=5');
  assert.equal(entryPath({ targetType: 'CORRECTIVE_ACTION', targetId: 5 }, '2026-11-06'), null);
  assert.equal(clockOf('2026-11-06T09:30:00'), '09:30');
  assert.equal(clockOf(null), '');
  const rows = deadlineRows({ tbmDeadline: '2026-11-06T09:00:00', tbmPassed: true, dailyLogDeadline: '2026-11-06T18:00:00', dailyLogPassed: false, approvalDueMinutes: 120 });
  assert.deepEqual(rows.map((row) => [row.time, row.passed]), [['09:00', true], ['18:00', false], ['120분', false]]);
});

test('teams, summary bars, totals and range', () => {
  assert.deepEqual(teamRows([{ teamId: 1, works: 3, blocked: 0, incomplete: 1 }, { teamId: 2, works: 1, blocked: 1, incomplete: 2 }]).map((team) => team.teamId), [2, 1]);
  const { days, max } = summaryBars({ days: [{ date: '2026-11-05', works: 4, blocked: 1, incomplete: { TBM_MISSING: 2, PHOTO_MISSING: 3 } }] });
  assert.deepEqual(days[0], { date: '2026-11-05', label: '11/05', works: 4, blocked: 1, incomplete: 5 });
  assert.equal(max, 5);
  assert.equal(summaryBars(null).max, 1);
  assert.deepEqual(summaryTotals({ TBM_MISSING: 2, MEASUREMENT_MISSING: 1 }).map((row) => row.type), ['MEASUREMENT_MISSING', 'TBM_MISSING']);
  assert.deepEqual(rangeEnding('2026-11-06', 7), { from: '2026-10-31', to: '2026-11-06' });
});

test('진행 칸 막대: 작업 목록과 같은 기준, 0건 칸은 뺀다', () => {
  const approved = { riskAssessment: { riskAssessmentId: 1, status: 'APPROVED' }, permits: [], tbm: { tbmId: 2, status: 'APPROVED' } };
  const works = [
    { workId: 1, workType: 'GENERAL', status: 'DRAFT', permits: [], riskAssessment: null, tbm: null },
    { workId: 2, workType: 'GENERAL', status: 'DRAFT', ...approved },
    { workId: 3, workType: 'GENERAL', status: 'DRAFT', ...approved },
  ];
  assert.deepEqual(stageSegments(works).map((segment) => [segment.status, segment.count]), [['TODO', 1], ['READY', 2]]);
  assert.deepEqual(stageSegments([]), []);
});
