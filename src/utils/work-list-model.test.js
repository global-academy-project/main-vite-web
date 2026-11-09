import assert from 'node:assert/strict';
import test from 'node:test';
import { backToHubPath, filterWorks, hubDocs, parseDocParam, sortWorks, withBack, workStage, workStats } from './work-list-model.js';

const w = (patch) => ({ workId: 1, workDate: '2026-11-05', title: '탱크 청소', workType: 'CONFINED', status: 'DRAFT', permits: [], riskAssessment: null, tbm: null, ...patch });
const list = [
  w({ workId: 1 }),
  w({ workId: 2, title: '배관 용접', workType: 'HOT', status: 'BLOCKED' }),
  w({ workId: 3, title: '정비', workType: 'GENERAL', status: 'DONE', riskAssessment: { riskAssessmentId: 9, status: 'APPROVED' }, tbm: { tbmId: 4, status: 'APPROVED' } }),
];

test('거르기: 종류·상태·검색·할 일 있음', () => {
  assert.deepEqual(filterWorks(list, { types: ['HOT', 'GENERAL'] }).map((x) => x.workId), [2, 3]);
  assert.deepEqual(filterWorks(list, { stage: 'BLOCKED' }).map((x) => x.workId), [2]);
  assert.deepEqual(filterWorks(list, { stage: 'TODO' }).map((x) => x.workId), [1]);
  assert.deepEqual(filterWorks(list, { query: '용접' }).map((x) => x.workId), [2]);
  assert.deepEqual(filterWorks(list, { actionOnly: true }).map((x) => x.workId), [1, 2]);
});

test('숫자 카드: 허가가 차단돼도 차단으로 센다', () => {
  const stats = workStats([...list, w({ workId: 4, permits: [{ permitId: 7, status: 'BLOCKED' }] })]);
  assert.equal(stats.find((s) => s.key === 'ALL').value, 4);
  assert.equal(stats.find((s) => s.key === 'BLOCKED').value, 2);
});

test('진행 칸: 문서 상태로 정하고 작업 하나는 한 칸에만', () => {
  const approved = { riskAssessment: { riskAssessmentId: 9, status: 'APPROVED' }, permits: [{ permitId: 7, status: 'APPROVED' }], tbm: { tbmId: 4, status: 'APPROVED' } };
  assert.equal(workStage(w(approved)), 'READY');
  assert.equal(workStage(w({ ...approved, riskAssessment: { riskAssessmentId: 9, status: 'PENDING' } })), 'WAIT');
  assert.equal(workStage(w({ ...approved, tbm: { tbmId: 4, status: 'DONE' } })), 'WAIT');
  // 승인 대기 문서가 있어도 쓸 게 남았으면 할 일 있음
  assert.equal(workStage(w({ ...approved, riskAssessment: { riskAssessmentId: 9, status: 'PENDING' }, tbm: null })), 'TODO');
  assert.equal(workStage(w({ ...approved, riskAssessment: { riskAssessmentId: 9, status: 'REJECTED' } })), 'TODO');
  assert.equal(workStage(w({ ...approved, permits: [{ permitId: 7, status: 'BLOCKED' }] })), 'BLOCKED');
  assert.equal(workStage(w({ status: 'CANCELED' })), null);
  const stats = workStats([w({}), w(approved), w({ ...approved, tbm: { tbmId: 4, status: 'DONE' } })]);
  assert.deepEqual(stats.map((stat) => [stat.key, stat.value]), [['ALL', 3], ['BLOCKED', 0], ['TODO', 1], ['WAIT', 1], ['READY', 1]]);
});

test('정렬: 최근 날짜 먼저, 같은 날은 시작 시각순', () => {
  const sorted = sortWorks([w({ workId: 1, workDate: '2026-11-04' }), w({ workId: 2, startAt: '2026-11-05T14:00' }), w({ workId: 3, startAt: '2026-11-05T09:00' })]);
  assert.deepEqual(sorted.map((x) => x.workId), [3, 2, 1]);
});

test('허브 문서: 없는 문서는 작성 링크, 일반 작업은 허가 칸 없음', () => {
  assert.deepEqual(hubDocs(list[0]).map((d) => d.key), ['RISK-new', 'PERMIT-new', 'TBM-new']);
  assert.deepEqual(hubDocs(list[2]).map((d) => d.key), ['RISK-9', 'TBM-4']);
  assert.equal(hubDocs(list[0])[1].createPath, '/job/permits?workId=1');
});

test('주소의 문서 값: 올바른 것만 받는다', () => {
  assert.deepEqual(parseDocParam('PERMIT-31'), { type: 'PERMIT', id: 31, key: 'PERMIT-31' });
  assert.equal(parseDocParam('PERMIT-0'), null);
  assert.equal(parseDocParam('X-3'), null);
  assert.equal(parseDocParam(null), null);
});

test('작업 허브에서 다른 화면으로 갈 때 back=작업번호 를 붙이고, 돌아갈 경로는 숫자만 받는다', () => {
  assert.equal(withBack('/job/risk-assessment?workId=7', 7), '/job/risk-assessment?workId=7&back=7');
  assert.equal(withBack('/job/permits', 7), '/job/permits?back=7');
  assert.equal(withBack(null, 7), null);
  assert.equal(withBack('/job/tbm?date=2026-11-05', undefined), '/job/tbm?date=2026-11-05');
  assert.equal(backToHubPath('7'), '/job/workspace?workId=7');
  assert.equal(backToHubPath('//evil.example'), null);
  assert.equal(backToHubPath(null), null);
});
