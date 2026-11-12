import test from 'node:test';
import assert from 'node:assert/strict';
import {
  missingDailyLogDocumentFields,
  normalizeDailyLogDocument,
} from './daily-log-document.js';

test('normalizes nested and snake_case safety-log fields for printing', () => {
  const document = normalizeDailyLogDocument({
    content: {
      worker_name: '홍길동',
      work_content: '배관 점검',
      safetyRules: ['보호구 착용', '가스 측정'],
      summary: '작업 전 안전조치를 확인했습니다.',
    },
  });

  assert.deepEqual(document, {
    siteName: '',
    workerName: '홍길동',
    birthDate: '',
    position: '',
    company: '',
    workType: '',
    healthStatus: '',
    specialNotes: '',
    workContent: '배관 점검',
    safetyRules: '보호구 착용\n가스 측정',
    riskFactors: '',
    aiSummary: '작업 전 안전조치를 확인했습니다.',
    evidence: '',
  });
});

test('normalizes the actual DailyLogResponse shape', () => {
  const document = normalizeDailyLogDocument({
    dailyLogId: 101,
    summary: '작업 3건, TBM 2건 실시',
    writerName: '홍길동',
    stats: {
      works: { total: 3 },
      permits: { total: 2 },
      tbm: { total: 2 },
      inspections: { total: 1 },
    },
    checks: [{ type: 'MEASUREMENT_MISSING', label: '가스측정값 누락', count: 1 }],
    evidence: [{ targetType: 'PERMIT', targetId: 5001, title: '화기작업허가', detail: 'APPROVED' }],
  });

  assert.equal(document.workerName, '홍길동');
  assert.equal(document.aiSummary, '작업 3건, TBM 2건 실시');
  assert.equal(document.workContent, '작업 3건\n작업허가 2건\nTBM 2건\n점검표 1건');
  assert.equal(document.riskFactors, '가스측정값 누락: 1건');
  assert.equal(document.evidence, '화기작업허가 · APPROVED');
  assert.equal(document.siteName, '');
  assert.equal(document.safetyRules, '');
});

test('normalizes PreviewResponse content shape', () => {
  const document = normalizeDailyLogDocument({
    targetType: 'DAILY_LOG',
    content: { writerName: '홍길동', summary: '요약', stats: {}, checks: [], evidence: [] },
  });

  assert.equal(document.workerName, '홍길동');
  assert.equal(document.aiSummary, '요약');
});

test('does not block printing when server fields are unavailable', () => {
  assert.deepEqual(
    missingDailyLogDocumentFields({
      siteName: '김포 현장',
      workerName: '홍길동',
      workContent: '',
      safetyRules: '보호구 착용',
      riskFactors: '',
    }),
    [],
  );
});
