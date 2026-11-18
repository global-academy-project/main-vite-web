import { api } from './client.js';
import { jobId, jobWrite } from './jobs.js';

// 개선조치 (Spring /api/v1/sites/{siteId}/corrective-actions, /api/v1/corrective-actions/{id})
export const ACTION_STATUSES = Object.freeze(['OPEN', 'IN_PROGRESS', 'DONE', 'VERIFIED', 'CANCELED']);
export const ACTION_SOURCES = Object.freeze(['NEAR_MISS', 'INSPECTION', 'RULE_VIOLATION', 'AUDIT', 'OTHER']);

function requireAction(action, siteId) {
  if (!action || !Number.isSafeInteger(action.actionId) || action.actionId < 1
    || !Number.isSafeInteger(action.siteId) || typeof action.title !== 'string'
    || !ACTION_STATUSES.includes(action.status) || !ACTION_SOURCES.includes(action.sourceType)
    || !Number.isInteger(action.lockVersion) || typeof action.dueDate !== 'string') {
    throw new Error('개선조치 응답 형식이 올바르지 않습니다.');
  }
  if (siteId != null && action.siteId !== jobId(siteId)) {
    throw new Error('선택한 현장의 개선조치가 아닙니다.');
  }
  return action;
}

export async function listCorrectiveActions(siteId, { statuses = [], sourceType, sourceId } = {}) {
  const site = jobId(siteId);
  const query = new URLSearchParams();
  statuses.forEach((status) => query.append('status', status));
  if (sourceType) query.set('sourceType', sourceType);
  if (sourceId != null) query.set('sourceId', String(jobId(sourceId)));
  const text = query.toString();
  const list = await api(`/api/v1/sites/${site}/corrective-actions${text ? `?${text}` : ''}`);
  if (!Array.isArray(list)) throw new Error('개선조치 목록 응답 형식이 올바르지 않습니다.');
  return list.map((action) => requireAction(action, site));
}

export async function getCorrectiveAssignees(siteId) {
  const list = await api(`/api/v1/sites/${jobId(siteId)}/corrective-actions/assignees`);
  if (!Array.isArray(list) || !list.every((person) => person && Number.isSafeInteger(person.userId))) {
    throw new Error('담당자 목록 응답 형식이 올바르지 않습니다.');
  }
  return list;
}

export async function getCorrectiveAction(id, siteId) {
  return requireAction(await api(`/api/v1/corrective-actions/${jobId(id)}`), siteId);
}

export async function createCorrectiveAction(siteId, body) {
  const site = jobId(siteId);
  return jobWrite(async () => requireAction(
    await api(`/api/v1/sites/${site}/corrective-actions`, { method: 'POST', body }), site,
  ));
}

export async function updateCorrectiveAction(id, body, siteId) {
  const actionId = jobId(id);
  return jobWrite(async () => requireAction(
    await api(`/api/v1/corrective-actions/${actionId}`, { method: 'PUT', body }), siteId,
  ));
}

const STEPS = Object.freeze(['start', 'complete', 'verify', 'reopen', 'cancel']);

/** 상태 바꾸기: start·complete(note 필수)·verify·reopen(note: 사유)·cancel */
export async function stepCorrectiveAction(id, step, { lockVersion, note } = {}, siteId) {
  if (!STEPS.includes(step)) throw new Error('모르는 개선조치 단계입니다.');
  const actionId = jobId(id);
  return jobWrite(async () => requireAction(
    await api(`/api/v1/corrective-actions/${actionId}/${step}`, { method: 'POST', body: { lockVersion, note: note ?? null } }), siteId,
  ));
}
