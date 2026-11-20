import test from 'node:test';
import assert from 'node:assert/strict';
import { statEntries, defaultAuditPeriod, reviewNotice, verificationBadge } from './audit-report-model.js';

test('감사 대응 보고서 집계 표시: 비율은 %, 빈 값은 -, 목록·객체는 뺀다', () => {
  assert.deepEqual(statEntries({ works: 4, rate: 75.0, approvedRate: null, nested: { a: 1 }, list: [1] }),
    [['works', '4'], ['rate', '75%'], ['approvedRate', '-']]);
  assert.deepEqual(statEntries(null), []);
  assert.deepEqual(statEntries([1, 2]), []);
});

test('만들기 기본 기간은 브라우저 날짜로 이번 달 1일 ~ 오늘 (한국 시간 오전에도 UTC 로 하루 밀리지 않는다)', () => {
  assert.deepEqual(defaultAuditPeriod(new Date(2026, 10, 1, 0, 30)), { dateFrom: '2026-11-01', dateTo: '2026-11-01' });
  assert.deepEqual(defaultAuditPeriod(new Date(2026, 10, 20, 8, 59)), { dateFrom: '2026-11-01', dateTo: '2026-11-20' });
  assert.deepEqual(defaultAuditPeriod(new Date(2026, 0, 5, 23, 59)), { dateFrom: '2026-01-01', dateTo: '2026-01-05' });
});

test('검토 필요 안내: 예전 수치 불일치(FAIL)만 불일치 안내, 구성기 응답은 확인 요청, 다른 상태는 없음', () => {
  assert.match(reviewNotice({ status: 'REVIEW_REQUIRED', overallVerification: 'FAIL' }), /불일치/);
  const composed = reviewNotice({ status: 'REVIEW_REQUIRED', overallVerification: null });
  assert.doesNotMatch(composed, /불일치/);
  assert.match(composed, /확인/);
  assert.equal(reviewNotice({ status: 'DRAFT', overallVerification: 'PASS' }), null);
  assert.equal(reviewNotice(null), null);
});

test('항목 검증 배지는 검증 결과가 있을 때만 (구성기 응답은 배지 없음)', () => {
  assert.deepEqual(verificationBadge({ verification: { status: 'MATCH' } }), { className: 'match', label: '수치 일치' });
  assert.deepEqual(verificationBadge({ verification: { status: 'MISMATCH' } }), { className: 'mismatch', label: '불일치' });
  assert.equal(verificationBadge({ verification: null }), null);
  assert.equal(verificationBadge({}), null);
});
