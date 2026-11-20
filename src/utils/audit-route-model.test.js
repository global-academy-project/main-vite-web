import test from 'node:test';
import assert from 'node:assert/strict';
import { auditCardView, auditReportGenerating, auditRouteReportId } from './audit-route-model.js';

const routeRun = (overrides = {}) => ({
  status: 'DONE', auditReportId: 41,
  result: { runStatus: 'DONE', route: { target: 'AUDIT_REPORT', dateFrom: '2026-10-01', dateTo: '2026-10-31' } },
  ...overrides,
});

test('감사 분기 카드는 DONE·route=AUDIT_REPORT·보고서 번호가 있을 때만', () => {
  assert.equal(auditRouteReportId(routeRun()), 41);
  assert.equal(auditRouteReportId(routeRun({ auditReportId: null })), null);   // 권한·기간 거절: 답변 메시지만
  assert.equal(auditRouteReportId(routeRun({ status: 'WAITING_INPUT' })), null); // 기간 되묻기
  assert.equal(auditRouteReportId(routeRun({ result: { runStatus: 'DONE', saved: { workId: 3 } } })), null); // 작업 등록
  assert.equal(auditRouteReportId(routeRun({ result: { runStatus: 'DONE', route: { target: 'OTHER' } } })), null);
  assert.equal(auditRouteReportId(routeRun({ auditReportId: 0 })), null);
  assert.equal(auditRouteReportId(null), null);
});

test('감사 분기 카드 모양: 요약 중은 중지, 끝나면 이동, 상태 이름은 서버 statusLabel (내부 코드는 안 보임)', () => {
  const generating = auditCardView({ report: { status: 'GENERATING', statusLabel: '요약 중' } });
  assert.deepEqual([generating.label, generating.canStop, generating.canOpen], ['요약 중', true, false]);
  assert.equal(auditReportGenerating({ status: 'GENERATING' }), true);

  for (const [status, statusLabel] of [['DRAFT', '초안'], ['REVIEW_REQUIRED', '검토 필요'], ['FAILED', '요약 실패']]) {
    const view = auditCardView({ report: { status, statusLabel } });
    assert.equal(view.label, statusLabel);
    assert.equal(view.canOpen, true);
    assert.equal(view.canStop, false);
    assert.doesNotMatch(`${view.label} ${view.note}`, /GENERATING|DRAFT|REVIEW_REQUIRED|FAILED|AUDIT_REPORT/);
  }
  assert.match(auditCardView({ report: { status: 'FAILED', statusLabel: '요약 실패' } }).note, /다시 요약/);

  const stopped = auditCardView({ report: { status: 'GENERATING', statusLabel: '요약 중' }, stopped: true });
  assert.deepEqual([stopped.canOpen, stopped.canStop], [false, false]);
  assert.equal(auditCardView({ missing: true }).canOpen, false);
  assert.equal(auditCardView({}), null);   // 아직 불러오는 중
});
