import test from 'node:test';
import assert from 'node:assert/strict';
import { digitsOnly, koreanOnly, nameError, passwordChecks, signupBody, validEmail, validPassword, validPhone } from './auth-validation.js';

test('password rules and live checks', () => {
  assert.ok(validPassword('Safe-1234'));
  assert.ok(!validPassword('safe1234'));
  assert.deepEqual(passwordChecks('abc1').map((check) => check.ok), [false, true, true, false]);
  assert.ok(passwordChecks('Abcdefg1!').every((check) => check.ok));
});

test('email and phone', () => {
  assert.ok(validEmail(' kim@example.com '));
  assert.ok(!validEmail('kim@example'));
  assert.equal(digitsOnly('010-1234 5678ab'), '01012345678');
  assert.equal(digitsOnly('0101234567890'), '01012345678');
  assert.ok(validPhone(''));
  assert.ok(validPhone('01012345678'));
  assert.ok(!validPhone('010-1234-5678'));
  assert.ok(!validPhone('1012345678'));
});

test('name is Korean only, 2~10 letters', () => {
  assert.equal(koreanOnly('김 안전 Kim1!'), '김안전');
  assert.equal(koreanOnly('김ㅇ'), '김ㅇ');
  assert.equal(koreanOnly('가나다라마바사아자차카'), '가나다라마바사아자차');
  assert.equal(nameError('김안전'), '');
  assert.ok(nameError('김'));
  assert.ok(nameError('김ㅇ'));
  assert.ok(nameError('Kim'));
  assert.ok(nameError(''));
});

test('signup body sends optional fields the server accepts', () => {
  const form = { email: ' kim@example.com ', name: '김안전', password: 'Safe-1234', passwordConfirm: 'Safe-1234', phone: '01012345678', department: ' 안전팀 ', jobTitle: '' };
  assert.deepEqual(signupBody(form).body, { email: 'kim@example.com', name: '김안전', password: 'Safe-1234', phone: '01012345678', department: '안전팀', jobTitle: null });
  const bad = signupBody({ ...form, email: 'x', name: 'Kim', password: 'short', passwordConfirm: 'other', phone: '123' }).errors;
  assert.deepEqual(Object.keys(bad).sort(), ['email', 'name', 'password', 'passwordConfirm', 'phone']);
  assert.match(signupBody({ ...form, phone: '010-1234-5678' }).errors.phone, /하이픈/);
});

test('phone parts 3-4-4 without a default', async () => {
  const { joinPhone, phonePartsError, splitPhone } = await import('./auth-validation.js');
  assert.deepEqual(splitPhone(''), ['', '', '']);
  assert.deepEqual(splitPhone('01012345678'), ['010', '1234', '5678']);
  assert.deepEqual(splitPhone('0311234567'), ['031', '123', '4567']);
  assert.equal(joinPhone(['010', '1234', '5678']), '01012345678');
  assert.equal(phonePartsError(['', '', '']), '');
  assert.equal(phonePartsError(['010', '1234', '5678']), '');
  assert.ok(phonePartsError(['010', '', '']));
  assert.ok(phonePartsError(['110', '1234', '5678']));
  assert.ok(phonePartsError(['010', '1234', '567']));
});
