import test from 'node:test';
import assert from 'node:assert/strict';
import { changedPreferences, emailBody, passwordBody, profileBody, profileForm, sameProfile } from './profile-model.js';

test('profile body follows server rules', () => {
  const form = profileForm({ name: '김안전', phone: null, department: '안전팀', jobTitle: '대리' });
  assert.deepEqual(form, { name: '김안전', phone: '', department: '안전팀', jobTitle: '대리' });
  assert.deepEqual(profileBody({ ...form, phone: '01012345678' }).body, { name: '김안전', phone: '01012345678', department: '안전팀', jobTitle: '대리' });
  assert.ok(profileBody({ ...form, phone: '010-1234-5678' }).errors.phone);
  assert.ok(profileBody({ ...form, name: 'Kim' }).errors.name);
  assert.ok(profileBody({ ...form, name: ' ' }).errors.name);
  assert.ok(profileBody({ ...form, phone: '1234' }).errors.phone);
  assert.equal(profileBody({ ...form, phone: '' }).body.phone, '');
  assert.ok(sameProfile(form, { ...form, name: '김안전 ' }));
  assert.ok(!sameProfile(form, { ...form, jobTitle: '과장' }));
});

test('password and email bodies', () => {
  assert.deepEqual(passwordBody({ currentPassword: 'Old-1234', newPassword: 'New-5678!', confirm: 'New-5678!' }).body, { currentPassword: 'Old-1234', newPassword: 'New-5678!' });
  assert.ok(passwordBody({ currentPassword: '', newPassword: 'short', confirm: 'x' }).errors.currentPassword);
  assert.ok(passwordBody({ currentPassword: 'a', newPassword: 'short', confirm: 'short' }).errors.newPassword);
  assert.ok(passwordBody({ currentPassword: 'Same-1234', newPassword: 'Same-1234', confirm: 'Same-1234' }).errors.newPassword);
  assert.ok(passwordBody({ currentPassword: 'a', newPassword: 'New-5678!', confirm: 'New-5678?' }).errors.confirm);
  assert.deepEqual(emailBody({ newEmail: ' b@x.com ', currentPassword: 'p' }, 'a@x.com').body, { newEmail: 'b@x.com', currentPassword: 'p' });
  assert.ok(emailBody({ newEmail: 'A@x.com', currentPassword: 'p' }, 'a@x.com').errors.newEmail);
  assert.ok(emailBody({ newEmail: 'nope', currentPassword: '' }, 'a@x.com').errors.currentPassword);
});

test('changed notification preferences', () => {
  const saved = [{ type: 'DEADLINE', webEnabled: true, smsEnabled: false, mandatory: false }, { type: 'BLOCKED', webEnabled: true, smsEnabled: false, mandatory: true }];
  assert.deepEqual(changedPreferences(saved, saved), []);
  assert.deepEqual(changedPreferences(saved, [{ ...saved[0], smsEnabled: true }, saved[1]]).map((entry) => entry.type), ['DEADLINE']);
});
