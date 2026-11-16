import assert from 'node:assert/strict';
import test from 'node:test';
import { citationKind, cleanSnippet, MAX_CITATIONS, parseDraftEvidence, SNIPPET_PREVIEW } from './risk-evidence.js';

// 11/16 화면에서 본 모양(첫 위험요인)을 따른다
const ACCIDENT = { kind: 'KB', docId: 'SIF:1285', refId: 'fa68c24d-dca5', source: '기타각종제조업 - 용접(용단) 절단·사상 또는 도장 작업 (2020)', snippet: `[재해개요] 2020년 5월경 00공장에서 재해자 2명이 ${'용접 불티가 톱밥에 옮겨 붙어 화재가 발생하였으며 '.repeat(4)}`, sourceType: 'SIF', kbCollection: 'kb_accidents' };
const LAW = { kind: 'KB', docId: 'LAW:3', refId: '7aa01cec', source: '산업안전보건기준에 관한 규칙 (제241조)', snippet: '제241조(화재위험작업 시의 준수사항) ① 사업주는 통풍이나 환기가 충분하지 않은 장소에서', sourceType: 'LAW', kbCollection: 'kb_guides' };
const MSDS = { kind: 'MSDS', docId: null, refId: '108-88-3', source: '한국산업안전보건공단 물질안전보건자료 조회 서비스', snippet: '톨루엔: 유해성·위험성 분류: 인화성 액체 : 구분2|피부 부식성/피부 자극성 : 구분2|생식독성 : 구분2' };
const ITEM = { seq: 1, hazard: '용접 중 불티·열원이 톨루엔 증기에 착화', source: 'rule', measures: ['작업 전·중 가연성가스 농도 측정', '작업 반경 내 가연물 제거'], severity: 4, citations: [ACCIDENT, LAW, MSDS] };

test('근거 종류 이름: 한글로, 모르는 값은 "근거"', () => {
  assert.equal(citationKind(ACCIDENT), '사고사례');
  assert.equal(citationKind(LAW), '법령·지침');
  assert.equal(citationKind(MSDS), '물질안전보건자료');
  assert.equal(citationKind({ kind: 'KB', kbCollection: 'kb_accidents' }), '사고사례');
  assert.equal(citationKind({ kind: 'KB', kbCollection: 'kb_guides' }), '법령·지침');
  assert.equal(citationKind({ kind: 'KB', sourceType: 'SIF' }), '사고사례');
  assert.equal(citationKind({ kind: 'KB', sourceType: 'LAW' }), '법령·지침');
  assert.equal(citationKind({ kind: 'KB', sourceType: 'MSDS' }), '물질안전보건자료');
  assert.equal(citationKind({ kind: 'X' }), '근거');
  assert.equal(citationKind({}), '근거');
});

test("본문 정리: '|' 구분을 ' · '로, 공백은 하나로", () => {
  assert.equal(cleanSnippet('인화성 액체 : 구분2|피부 부식성 : 구분2'), '인화성 액체 : 구분2 · 피부 부식성 : 구분2');
  assert.equal(cleanSnippet('  가   나\n다 '), '가 나 다');
  assert.equal(cleanSnippet(null), '');
  assert.equal(cleanSnippet(5), '');
});

test('위험요인·감소대책·근거를 화면용으로 바꾼다 (내부 값은 담지 않는다)', () => {
  const [item] = parseDraftEvidence(JSON.stringify({ items: [ITEM] }));
  assert.equal(item.seq, 1);
  assert.equal(item.hazard, '용접 중 불티·열원이 톨루엔 증기에 착화');
  assert.deepEqual(item.measures, ['작업 전·중 가연성가스 농도 측정', '작업 반경 내 가연물 제거']);
  assert.deepEqual(item.citations.map((c) => c.kind), ['사고사례', '법령·지침', '물질안전보건자료']);
  assert.equal(item.citations[0].title, ACCIDENT.source);
  assert.deepEqual(item.moreCitations, []);
  const shown = JSON.stringify(item);
  for (const hidden of ['SIF:1285', 'LAW:3', 'fa68c24d', 'kb_accidents', 'kb_guides', '"rule"', 'docId', 'refId', 'sourceType', 'kbCollection']) assert.equal(shown.includes(hidden), false, hidden);
});

test('긴 본문은 앞부분만 미리 보이고 전체는 text에 남는다', () => {
  const [item] = parseDraftEvidence({ items: [ITEM] });
  const [long, short, msds] = item.citations;
  assert.equal(long.long, true);
  assert.ok(long.preview.endsWith('…') && long.preview.length <= SNIPPET_PREVIEW + 1);
  assert.equal(long.text, cleanSnippet(ACCIDENT.snippet));
  assert.equal(short.long, false);
  assert.equal(short.preview, short.text);
  assert.equal(msds.text.includes('|'), false);
  assert.equal(msds.text, '톨루엔: 유해성·위험성 분류: 인화성 액체 : 구분2 · 피부 부식성/피부 자극성 : 구분2 · 생식독성 : 구분2');
});

test('본문이 미리보기 길이와 같으면 펼치기를 만들지 않는다', () => {
  const exact = 'ㄱ'.repeat(SNIPPET_PREVIEW);
  assert.equal(parseDraftEvidence({ items: [{ hazard: 'a', citations: [{ snippet: exact }] }] })[0].citations[0].long, false);
  assert.equal(parseDraftEvidence({ items: [{ hazard: 'a', citations: [{ snippet: `${exact}ㄴ` }] }] })[0].citations[0].long, true);
});

test(`근거는 위험요인마다 ${MAX_CITATIONS}개까지 바로 보이고 나머지는 moreCitations`, () => {
  const many = Array.from({ length: 5 }, (_, i) => ({ source: `출처${i}`, snippet: `내용${i}` }));
  const [item] = parseDraftEvidence({ items: [{ hazard: 'a', citations: many }] });
  assert.deepEqual(item.citations.map((c) => c.title), ['출처0', '출처1', '출처2']);
  assert.deepEqual(item.moreCitations.map((c) => c.title), ['출처3', '출처4']);
});

test('formData는 문자열 JSON이든 객체든 읽는다', () => {
  assert.deepEqual(parseDraftEvidence(JSON.stringify({ items: [ITEM] })), parseDraftEvidence({ items: [ITEM] }));
});

test('읽을 수 없으면 null (화면이 원문을 그대로 보여 준다)', () => {
  for (const value of [null, undefined, '', '{}', '[]', 'not json', '{"evidence":["rule"]}', '{"items":"x"}', { items: [] }, { items: [null, 3, 'x'] }, { items: [{}] }, [], 7]) assert.equal(parseDraftEvidence(value), null, JSON.stringify(value));
});

test('내용이 없는 항목은 빼고, 번호가 없으면 순서로 채운다', () => {
  const items = parseDraftEvidence({ items: [{}, { hazard: '둘째' }, { seq: 'x', measures: ['대책'] }, { seq: 9, hazard: '넷째' }] });
  assert.deepEqual(items.map((i) => [i.seq, i.hazard]), [[2, '둘째'], [3, ''], [9, '넷째']]);
});

test('대책은 목록이나 문자열, 빈 값은 뺀다. 근거의 객체가 아닌 값은 건너뛴다', () => {
  const [a, b] = parseDraftEvidence({ items: [{ hazard: 'a', measures: ['  하나  ', '', null, 3, '둘'], citations: [null, 'x', { source: '출처', snippet: '내용' }] }, { hazard: 'b', measures: '문자열 대책' }] });
  assert.deepEqual(a.measures, ['하나', '둘']);
  assert.deepEqual(a.citations.map((c) => c.title), ['출처']);
  assert.equal(parseDraftEvidence({ items: [{ hazard: 'a', citations: [[1, 2], ['x']] }] })[0].citations.length, 0);  // 배열은 근거가 아니다
  assert.deepEqual(b.measures, ['문자열 대책']);
});

test('출처가 없으면 title은 빈 문자열, title 값이 있으면 그것을 쓴다', () => {
  const [item] = parseDraftEvidence({ items: [{ hazard: 'a', citations: [{ snippet: '내용' }, { title: '제목', snippet: '내용' }] }] });
  assert.deepEqual(item.citations.map((c) => c.title), ['', '제목']);
});

test('원본 formData를 바꾸지 않는다', () => {
  const value = { items: [JSON.parse(JSON.stringify(ITEM))] };
  const before = JSON.stringify(value);
  parseDraftEvidence(value);
  assert.equal(JSON.stringify(value), before);
});
