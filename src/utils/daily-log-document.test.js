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
  });
});

test('reports required fields missing before printing', () => {
  assert.deepEqual(
    missingDailyLogDocumentFields({
      siteName: '김포 현장',
      workerName: '홍길동',
      workContent: '',
      safetyRules: '보호구 착용',
      riskFactors: '',
    }),
    ['작업내용', '위험요인'],
  );
});
