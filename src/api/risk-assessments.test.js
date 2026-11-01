import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createRiskAssessment, getRiskAssessment, getWorkRiskAssessment, submitRiskAssessment,
  updateRiskAssessment,
} from './risk-assessments.js';

const risk = {
  riskAssessmentId: 40, siteId: 1, workId: 31, status: 'DRAFT', lockVersion: 0,
  assessDate: '2026-11-02', items: [],
};

test('risk assessment API uses documented routes and validates the selected site', async (t) => {
  const requests = [];
  let responseData = risk;
  t.mock.method(globalThis, 'fetch', async (path, options) => {
    requests.push({
      path, method: options.method,
      body: options.body ? JSON.parse(options.body) : undefined,
    });
    return new Response(JSON.stringify({ success: true, data: responseData }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  });
  const storage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true, value: { getItem: () => 'test-only-token' },
  });
  t.after(() => {
    if (storage) Object.defineProperty(globalThis, 'localStorage', storage);
    else delete globalThis.localStorage;
  });

  await getRiskAssessment(40, 1);
  assert.deepEqual(requests.at(-1), {
    path: '/api/v1/risk-assessments/40', method: 'GET', body: undefined,
  });
  await getWorkRiskAssessment(31, 1);
  assert.equal(requests.at(-1).path, '/api/v1/works/31/risk-assessment');

  const createBody = {
    siteId: 1, workId: 31, assessmentType: 'DAILY', assessDate: '2026-11-02',
    formData: '{"source":"WEB"}', items: [],
  };
  await createRiskAssessment(createBody, 1);
  assert.equal(requests.at(-1).path, '/api/v1/risk-assessments');
  assert.equal(requests.at(-1).method, 'POST');
  assert.deepEqual(requests.at(-1).body, createBody);

  await updateRiskAssessment(40, { assessDate: '2026-11-03', lockVersion: 0, items: [] }, 1);
  assert.equal(requests.at(-1).path, '/api/v1/risk-assessments/40');
  assert.equal(requests.at(-1).method, 'PUT');
  await submitRiskAssessment(40, 1);
  assert.equal(requests.at(-1).path, '/api/v1/risk-assessments/40/submit');
  assert.equal(requests.at(-1).method, 'POST');

  responseData = { ...risk, siteId: 2 };
  await assert.rejects(getRiskAssessment(40, 1), /현장/);
});
