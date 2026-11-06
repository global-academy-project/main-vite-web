import test from 'node:test';
import assert from 'node:assert/strict';
import { equipmentBody, equipmentForm, hhmm, matches, settingsBody, settingsForm, tabOf, teamBody, zoneBody } from './site-settings-model.js';

test('settings form and body follow server rules', () => {
  const form = settingsForm({ siteId: 1, tbmDeadline: '09:30:00', dailyLogDeadline: '18:00:00', approvalDueMinutes: 120, nearMissWarnDays: 30, industry: null, employeeCount: 40, address: '울산' });
  assert.equal(form.tbmDeadline, '09:30'); assert.equal(form.employeeCount, '40');
  assert.deepEqual(settingsBody(form).body, { tbmDeadline: '09:30', dailyLogDeadline: '18:00', approvalDueMinutes: 120, nearMissWarnDays: 30, industry: null, employeeCount: 40, address: '울산' });
  assert.ok(settingsBody({ ...form, tbmDeadline: '19:00' }).errors.dailyLogDeadline);
  assert.ok(settingsBody({ ...form, approvalDueMinutes: '4' }).errors.approvalDueMinutes);
  assert.ok(settingsBody({ ...form, nearMissWarnDays: '366' }).errors.nearMissWarnDays);
  assert.ok(settingsBody({ ...form, employeeCount: '-1' }).errors.employeeCount);
  assert.equal(settingsBody({ ...form, employeeCount: '' }).body.employeeCount, null);
  assert.equal(hhmm(null), '');
});

test('equipment, zone and team bodies', () => {
  const form = { ...equipmentForm(null), code: ' P-02 ', name: '펌프', equipmentType: 'gas_detector' };
  assert.deepEqual(equipmentBody(form).body, { code: 'P-02', name: '펌프', equipmentType: 'GAS_DETECTOR', zoneId: null, nextInspectionDate: null, active: null });
  assert.ok(equipmentBody({ ...form, equipmentType: '1PUMP' }).errors.equipmentType);
  const edit = equipmentForm({ equipmentId: 8, code: 'P', name: 'n', equipmentType: 'PUMP', zoneId: 3, nextInspectionDate: '2026-12-01', active: false });
  assert.deepEqual(equipmentBody(edit).body, { code: 'P', name: 'n', equipmentType: 'PUMP', zoneId: 3, nextInspectionDate: '2026-12-01', active: false });
  assert.equal(zoneBody({ code: 'Z1', name: '구역', zoneType: '', confined: true, hazardNote: '', active: true }).body.active, null);
  assert.ok(zoneBody({ code: '', name: '', zoneType: '', confined: false, hazardNote: '', active: true }).errors.code);
  assert.equal(teamBody({ name: '외주', teamType: 'EXTERNAL', businessNo: '123-45-67890', active: true }).body.businessNo, '1234567890');
  assert.ok(teamBody({ name: '외주', teamType: 'EXTERNAL', businessNo: '123', active: true }).errors.businessNo);
  assert.equal(teamBody({ name: '사내', teamType: 'INTERNAL', businessNo: '123', active: true }).body.businessNo, null);
});

test('tabs and search', () => {
  assert.equal(tabOf('equipment'), 'equipment');
  assert.equal(tabOf('nope'), 'site');
  assert.ok(matches({ name: '이송 펌프', code: 'P-02' }, 'p-0', ['name', 'code']));
  assert.ok(!matches({ name: '이송 펌프', code: 'P-02' }, '팬', ['name', 'code']));
  assert.ok(matches({ name: 'x' }, ' ', ['name']));
});
