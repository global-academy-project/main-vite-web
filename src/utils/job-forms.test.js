import test from 'node:test';
import assert from 'node:assert/strict';
import {
  completeTbmBody, jobRecordPath, localDate, riskAssessmentBody, riskLevelNotice, siteWorkerBody, tbmHeldAt, tbmContentBody, tbmPermissions,
} from './job-forms.js';

const item = {
  workStep: ' 용접 ', hazard: ' 불티 ', controls: ' 소화기 ', accidentType: 'FIRE',
  frequency: '4', severity: '3', riskLevel: 'MEDIUM', residualFrequency: '', residualSeverity: '',
};
const form = { siteId: 1, workId: '31', assessDate: '2026-11-02', items: [item] };

test('agent record links match existing document routes without inventing unsupported screens', () => {
  const expected = {
    WORK: '/job/workspace?workId=31', PERMIT: '/job/permits?permitId=31',
    RISK: '/job/risk-assessment?riskId=31', TBM: '/job/tbm?tbmId=31', APPROVAL: '/approvals/31',
    INSPECTION: '/job/dailey-checklist?inspectionId=31',
  };
  for (const [type, path] of Object.entries(expected)) assert.equal(jobRecordPath(type, 31), path);
  for (const type of ['DAILY_LOG', 'NEAR_MISS', 'CORRECTIVE_ACTION', undefined]) {
    assert.equal(jobRecordPath(type, 31), null);
  }
  for (const id of [0, -1, '31', 1.5, NaN, Number.MAX_SAFE_INTEGER + 1]) {
    assert.equal(jobRecordPath('WORK', id), null);
  }
});

test('worker form matches nullable server fields, full update version and input constraints', () => {
  const worker = { name: ' 작업자 ', phone: '', jobType: null, employmentType: 'DIRECT', teamId: '', assignedFrom: '' };
  assert.deepEqual(siteWorkerBody(worker), {
    name: '작업자', phone: null, jobType: null, employmentType: 'DIRECT', teamId: null, assignedFrom: null,
  });
  assert.deepEqual(siteWorkerBody({
    ...worker, workerId: 5, lockVersion: 3, teamId: '4', phone: '010-1234-5678', jobType: ' 배관공 ',
  }), {
    name: '작업자', phone: '010-1234-5678', jobType: '배관공', employmentType: 'DIRECT', teamId: 4, lockVersion: 3,
  });
  assert.equal(siteWorkerBody({ ...worker, name: 'x'.repeat(50), jobType: 'x'.repeat(50) }).name.length, 50);
  const edit = { ...worker, workerId: 5, lockVersion: 4 };
  assert.equal(Object.hasOwn(siteWorkerBody(edit), 'phone'), false);
  assert.equal(siteWorkerBody({ ...edit, clearPhone: true }).phone, '');
  assert.equal(siteWorkerBody({ ...edit, phone: '010-1234-5678' }).phone, '010-1234-5678');
  assert.equal(siteWorkerBody({ ...edit, clearPhone: true, phone: '010-1234-5678' }).phone, '');
  for (const invalid of [
    { name: ' ' }, { name: 'x'.repeat(51) }, { jobType: 'x'.repeat(51) },
    { phone: '123456789' }, { phone: '010-ABCD-5678' }, { phone: '0'.repeat(12) }, { teamId: '../4' },
  ]) assert.throws(() => siteWorkerBody({ ...worker, ...invalid }));
});

test('TBM pending approval locks all edits and status actions independently of TBM status', () => {
  for (const status of ['DRAFT', 'DONE', 'APPROVED']) {
    assert.deepEqual(tbmPermissions({ status, approvalStatus: 'PENDING' }), {
      pending: true, editable: false, canRequest: false,
    });
  }
  assert.deepEqual(tbmPermissions({ status: 'DRAFT', approvalStatus: 'REJECTED' }), {
    pending: false, editable: true, canRequest: false,
  });
  assert.deepEqual(tbmPermissions({ status: 'DONE', approvalStatus: 'CANCELED' }), {
    pending: false, editable: false, canRequest: true,
  });
  assert.deepEqual(tbmPermissions(null), { pending: false, editable: false, canRequest: false });
});
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
