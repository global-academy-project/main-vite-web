import test from 'node:test';
import assert from 'node:assert/strict';
import { completeTbmBody, localDate, riskAssessmentBody, riskLevelNotice, tbmHeldAt, tbmContentBody } from './job-forms.js';

const item = {
  workStep: ' 용접 ', hazard: ' 불티 ', controls: ' 소화기 ', accidentType: 'FIRE',
  frequency: '4', severity: '3', riskLevel: 'MEDIUM', residualFrequency: '', residualSeverity: '',
};
const form = { siteId: 1, workId: '31', assessDate: '2026-11-02', items: [item] };

test('risk creation requires IDs, and updates omit formData to preserve agent evidence', () => {
  const created = riskAssessmentBody(form);
  assert.deepEqual(created, {
    siteId: 1, workId: 31, assessmentType: 'DAILY', assessDate: '2026-11-02', formData: { source: 'WEB' },
    items: [{
      seq: 1, workStep: '용접', hazard: '불티', controls: '소화기', accidentType: 'FIRE',
      frequency: 4, severity: 3, riskLevel: 'MEDIUM', residualFrequency: null, residualSeverity: null,
    }],
  });
  const updated = riskAssessmentBody({ ...form, risk: { lockVersion: 7, formData: '{"evidence":["rule"]}' } });
  assert.deepEqual(updated, { assessDate: form.assessDate, items: created.items, lockVersion: 7 });
  assert.equal(Object.hasOwn(updated, 'formData'), false);
  for (const value of [0, '1e2', '../31']) assert.throws(() => riskAssessmentBody({ ...form, workId: value }), /ID/);
});

test('risk items require nonblank text, integer bounds and paired residual scores', () => {
  for (const field of ['workStep', 'hazard', 'controls']) {
    assert.throws(() => riskAssessmentBody({ ...form, items: [{ ...item, [field]: ' ' }] }), /입력/);
  }
  for (const field of ['frequency', 'severity']) {
    for (const value of ['', '0', '6', '1.5']) {
      assert.throws(() => riskAssessmentBody({ ...form, items: [{ ...item, [field]: value }] }), /1~5/);
    }
  }
  assert.throws(() => riskAssessmentBody({ ...form, items: [{ ...item, residualFrequency: '2' }] }), /둘 다/);
  assert.throws(() => riskAssessmentBody({ ...form, items: [] }), /하나 이상/);
  assert.throws(() => riskAssessmentBody({ ...form, assessDate: '' }), /평가일/);
  const saved = riskAssessmentBody({ ...form, items: [{ ...item, residualFrequency: '1', residualSeverity: '5' }] });
  assert.equal(saved.items[0].residualFrequency, 1);
  assert.equal(saved.items[0].residualSeverity, 5);
});

test('risk grade notification follows the server response, not an optimistic local grade', () => {
  const requested = riskAssessmentBody(form);
  assert.match(riskLevelNotice(requested, { items: [{ riskLevel: 'HIGH', computedLevel: 'HIGH' }] }), /1번.*HIGH/);
  assert.equal(riskLevelNotice(requested, { items: [{ riskLevel: 'MEDIUM', computedLevel: 'LOW' }] }), '');
});

test('past-date TBMs use their own date and completion uses the latest version and optional actual count', () => {
  const now = new Date(2026, 10, 2, 10, 36);
  const record = { tbmDate: '2026-10-30', lockVersion: 4 };
  assert.equal(localDate(now), '2026-11-02');
  assert.equal(tbmHeldAt(record, now), '2026-10-30T10:36');
  assert.equal(tbmHeldAt({ ...record, heldAt: '2026-10-30T09:00' }, now), '2026-10-30T09:00');
  assert.deepEqual(completeTbmBody(record, '2026-10-30T10:36', ''), {
    heldAt: '2026-10-30T10:36', lockVersion: 4,
  });
  assert.equal(completeTbmBody(record, '2026-10-30T10:36', '0').attendeeCount, 0);
  assert.equal(completeTbmBody(record, '2026-10-30T10:36', '20').attendeeCount, 20);
  assert.throws(() => completeTbmBody(record, '2026-11-02T10:36', '1'), /날짜/);
  for (const count of ['-1', '1.5', 'NaN']) assert.throws(() => completeTbmBody(record, '2026-10-30T10:36', count), /정수/);
});

test('TBM content payload preserves attendees, metadata and the latest version on full edits', () => {
  const form = {
    date: '2026-11-02', leaderName: ' 진행자 ', workIds: '31, 32, 31', points: ' 가스 측정 \n\n 소화기 확인 ',
    healthCheck: ' 이상 없음 ', teamId: '4', zoneId: '7', attendees: [{ workerId: 5, healthOk: true }],
  };
  assert.deepEqual(tbmContentBody(form, { lockVersion: 9 }), {
    tbmDate: '2026-11-02', leaderName: '진행자', workIds: [31, 32], points: ['가스 측정', '소화기 확인'],
    healthCheck: '이상 없음', teamId: 4, zoneId: 7, attendees: form.attendees, lockVersion: 9,
  });
  assert.equal(Object.hasOwn(tbmContentBody(form), 'lockVersion'), false);
  assert.equal(tbmContentBody({ ...form, teamId: '', zoneId: '' }).teamId, null);
  for (const invalid of [
    { date: '' }, { workIds: '1e2' }, { workIds: '../31' }, { teamId: '-1' },
    { points: 'x'.repeat(301) }, { points: Array(31).fill('point').join('\n') },
    { workIds: Array.from({ length: 51 }, (_, i) => String(i + 1)).join(',') },
    { leaderName: 'x'.repeat(51) }, { healthCheck: 'x'.repeat(501) },
  ]) assert.throws(() => tbmContentBody({ ...form, ...invalid }));
});
