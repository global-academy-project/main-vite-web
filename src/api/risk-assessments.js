import { api } from './client.js';
import { jobId, jobWrite } from './jobs.js';

const riskStatuses = ['DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'SUPERSEDED'];

function requireRiskAssessment(risk, siteId) {
  if (!risk || !Number.isSafeInteger(risk.riskAssessmentId) || risk.riskAssessmentId < 1
    || !Number.isSafeInteger(risk.siteId) || !Number.isSafeInteger(risk.workId)
    || !riskStatuses.includes(risk.status) || !Number.isInteger(risk.lockVersion)
    || !Array.isArray(risk.items)) {
    throw new Error('위험성평가 응답 형식이 올바르지 않습니다.');
  }
  if (siteId != null && risk.siteId !== jobId(siteId)) {
    throw new Error('선택한 현장의 위험성평가가 아닙니다.');
  }
  return risk;
}

export async function getRiskAssessment(id, siteId) {
  return requireRiskAssessment(await api(`/api/v1/risk-assessments/${jobId(id)}`), siteId);
}

export async function getWorkRiskAssessment(workId, siteId) {
  return requireRiskAssessment(await api(`/api/v1/works/${jobId(workId)}/risk-assessment`), siteId);
}

export async function createRiskAssessment(body, siteId) {
  return jobWrite(async () => requireRiskAssessment(
    await api('/api/v1/risk-assessments', { method: 'POST', body }), siteId,
  ));
}

export async function updateRiskAssessment(id, body, siteId) {
  const riskId = jobId(id);
  return jobWrite(async () => requireRiskAssessment(
    await api(`/api/v1/risk-assessments/${riskId}`, { method: 'PUT', body }), siteId,
  ));
}

export async function submitRiskAssessment(id, siteId) {
  const riskId = jobId(id);
  return jobWrite(async () => requireRiskAssessment(
    await api(`/api/v1/risk-assessments/${riskId}/submit`, { method: 'POST' }), siteId,
  ));
}

export async function reviseRiskAssessment(id, siteId) {
  const riskId = jobId(id);
  return jobWrite(async () => requireRiskAssessment(
    await api(`/api/v1/risk-assessments/${riskId}/revise`, { method: 'POST' }), siteId,
  ));
}
