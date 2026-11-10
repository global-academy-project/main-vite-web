import assert from 'node:assert/strict';
import test from 'node:test';
import { appendText, clock, micError, pickMimeType } from './voice-model.js';

test('받아 적은 글은 입력칸 글 뒤에 띄어 붙이고, 최대 길이에서 자른다', () => {
  assert.equal(appendText('', ' 산소 20.9 '), '산소 20.9');
  assert.equal(appendText('산소 20.9  ', '황화수소 3'), '산소 20.9 황화수소 3');
  assert.equal(appendText('산소 20.9', '   '), '산소 20.9');
  assert.equal(appendText('abc', 'defg', 5), 'abc d');
});

test('녹음 형식: 되는 것 중 앞의 것, 없으면 브라우저 기본', () => {
  assert.equal(pickMimeType((type) => type === 'audio/mp4'), 'audio/mp4');
  assert.equal(pickMimeType((type) => type.startsWith('audio/webm')), 'audio/webm;codecs=opus');
  assert.equal(pickMimeType(), '');
});

test('마이크 오류 안내와 시간 표시', () => {
  assert.match(micError(null, false), /https/);
  assert.match(micError({ name: 'NotAllowedError' }), /허용/);
  assert.equal(clock(7), '0:07');
  assert.equal(clock(65), '1:05');
});
