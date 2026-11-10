import assert from 'node:assert/strict';
import test from 'node:test';
import { checkChip, correctionBody, correctionForm, isStale, photoSummary, splitFiles, summaryText } from './tbm-photo-model.js';

const photo = (result, checkedTbmDate = '2026-11-03') => ({ attachmentId: 1, check: result ? { result, messages: [], checkedTbmDate } : null });

test('결과 칩: 서버 결과 그대로, 확인 전이면 회색', () => {
  assert.deepEqual(checkChip({ result: 'FAIL' }), { label: '맞지 않음', tone: 'block' });
  assert.deepEqual(checkChip({ result: 'UNSURE' }), { label: '확인 못 함', tone: 'warn' });
  assert.equal(checkChip(null).label, '확인 전');
});

test('요약: 맞지 않음·확인 못 함만 적고, 다 통과면 모두 확인됨', () => {
  const summary = photoSummary([photo('PASS'), photo('FAIL'), photo('UNSURE'), photo(null)]);
  assert.deepEqual(summary, { total: 4, pass: 1, fail: 1, unsure: 1, unchecked: 1 });
  assert.equal(summaryText(summary), '사진 4장 · 맞지 않음 1 · 확인 못 함 1');
  assert.equal(summaryText(photoSummary([photo('PASS'), photo('PASS')])), '사진 2장 · 모두 확인됨');
  assert.equal(summaryText(photoSummary([])), '사진 없음');
});

test('TBM 날짜가 바뀌면 다시 확인 필요', () => {
  assert.equal(isStale(photo('PASS'), '2026-11-03'), false);
  assert.equal(isStale(photo('PASS'), '2026-11-04'), true);
  assert.equal(isStale(photo(null), '2026-11-04'), false);
});

test('파일 고르기: 사진이 아니거나 너무 크면 빼고 이유를 알려 준다', () => {
  const { ok, rejected } = splitFiles([
    { name: 'a.jpg', type: 'image/jpeg', size: 10 },
    { name: 'b.heic', type: '', size: 10 },
    { name: 'c.pdf', type: 'application/pdf', size: 10 },
    { name: 'd.png', type: 'image/png', size: 30 },
  ], 20);
  assert.deepEqual(ok.map((file) => file.name), ['a.jpg', 'b.heic']);
  assert.equal(rejected.length, 2);
});

test('결과 고치기: 지금 값으로 시작, 사유 필수, 빈 칸은 모름, 날짜 정보 있는 사진은 당일 확인 안 보냄', () => {
  const noDate = { takenAt: null, check: { detectedPeople: 4, helmetMissing: null, dateConfirmed: false } };
  assert.deepEqual(correctionForm(noDate), { people: '4', helmetMissing: '', dateConfirmed: false, reason: '' });
  assert.equal(correctionBody({ people: '5', helmetMissing: '', dateConfirmed: true, reason: ' ' }, noDate).error, '고친 사유를 적어 주세요.');
  assert.deepEqual(correctionBody({ people: '5', helmetMissing: '', dateConfirmed: true, reason: '뒤쪽 1명 가려짐' }, noDate).body,
    { people: 5, helmetMissing: null, dateConfirmed: true, reason: '뒤쪽 1명 가려짐' });
  assert.equal(correctionBody({ people: '2', helmetMissing: '3', reason: 'x' }, noDate).error, '안전모 미착용 인원이 사진 속 인원보다 많습니다.');
  assert.equal(correctionBody({ people: '-1', helmetMissing: '', reason: 'x' }, noDate).error, '인원은 0~500 사이 숫자로 적어 주세요.');
  assert.equal(correctionBody({ people: '5', helmetMissing: '0', dateConfirmed: true, reason: 'x' }, { takenAt: '2026-11-03T08:00:00' }).body.dateConfirmed, null);
});
