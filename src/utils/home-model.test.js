import assert from 'node:assert/strict';
import test from 'node:test';
import { alertsOf, draftDocs, draftRemaining, nextAction, timeRange, todoTiles, todoTotal, typeCounts, workStages } from './home-model.js';

const work = (patch = {}) => ({
  workId: 5, siteId: 1, workDate: '2026-11-05', title: '3번 탱크 청소', workType: 'CONFINED', highRisk: true, status: 'DRAFT',
  permits: [], riskAssessment: null, tbm: null, ...patch,
});

test('할 일 칸: 9종 자리를 고정하고 서버 건수·기한 지남을 그대로 쓴다', () => {
  const tiles = todoTiles([{ type: 'PHOTO_MISSING', label: '사진 미첨부', count: 2, overdue: true, entries: [{ targetType: 'TBM', targetId: 9 }] }]);
  assert.equal(tiles.length, 9);
  const photo = tiles.find((tile) => tile.type === 'PHOTO_MISSING');
  assert.deepEqual([photo.count, photo.overdue, photo.path], [2, true, '/job/tbm?tbmId=9']);
  assert.equal(tiles.find((tile) => tile.type === 'TBM_MISSING').count, 0);
  assert.equal(todoTotal(tiles), 2);
});

test('단계: 평가 없음 → 지금 할 일은 위험성평가 작성', () => {
  const stages = workStages(work());
  assert.equal(stages.find((stage) => stage.key === 'risk').state, 'todo');
  assert.equal(nextAction(work()).label, '위험성평가 작성');
});

test('허가 차단이 있으면 단계는 문제, 지금 할 일은 차단 확인', () => {
  const blocked = work({ riskAssessment: { riskAssessmentId: 3, status: 'PENDING' }, permits: [{ permitId: 8, permitType: 'CONFINED', status: 'BLOCKED' }] });
  assert.equal(workStages(blocked).find((stage) => stage.key === 'permit').state, 'problem');
  assert.deepEqual(nextAction(blocked), { label: '허가 판정 차단 확인', tone: 'block', path: '/job/permits?permitId=8' });
});

test('일반 작업은 허가 단계를 해당 없음(완료)으로 본다', () => {
  const general = work({ workType: 'GENERAL', highRisk: false });
  const permit = workStages(general).find((stage) => stage.key === 'permit');
  assert.deepEqual([permit.state, permit.hint], ['done', '해당 없음']);
});

test('평가·허가 다 됐는데 TBM 없으면 TBM 작성, 모두 승인 대기면 승인 대기', () => {
  const ready = work({ riskAssessment: { riskAssessmentId: 3, status: 'PENDING' }, permits: [{ permitId: 8, status: 'PENDING' }] });
  assert.equal(nextAction(ready).label, 'TBM 작성');
  assert.equal(nextAction({ ...ready, tbm: { tbmId: 4, status: 'DONE' } }).label, '승인 대기');
});

test('종류별 건수는 0건 종류도 자리를 둔다', () => {
  assert.deepEqual(typeCounts([work(), work({ workType: 'HOT' }), work()]).map((item) => item.count), [0, 1, 2, 0]);
});

test('경고: 차단 작업 → 기한 지남 → 고위험 순, 같은 작업은 한 번만', () => {
  const blocked = work({ workId: 1, status: 'BLOCKED' });
  const risky = work({ workId: 2 });
  const alerts = alertsOf({ items: [{ type: 'APPROVAL_OVERDUE', label: '승인 지연', count: 1, overdue: true }] }, [blocked, risky]);
  assert.deepEqual(alerts.map((alert) => alert.key), ['block-1', 'due-APPROVAL_OVERDUE', 'risk-2']);
});

test('시간 표시와 초안 목록', () => {
  assert.equal(timeRange('2026-11-05T14:00:00', '2026-11-05T17:30:00'), '14:00~17:30');
  assert.equal(timeRange(null, null), '');
  const docs = draftDocs({ workId: 5, riskAssessmentId: 3, permits: [{ permitId: 8, permitType: 'CONFINED' }], tbmId: 4, notes: [] });
  assert.deepEqual(docs.map((doc) => doc.key), ['WORK', 'RISK', 'PERMIT-8', 'TBM']);
  assert.equal(draftRemaining(docs[2], { status: 'DRAFT', lastEvaluation: null }).label, '측정·판정');
  assert.equal(draftRemaining(docs[1], { status: 'PENDING' }).done, true);
});
