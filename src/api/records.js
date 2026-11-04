import { api } from './client.js';

export function getRecordDetail(recordType, recordId) {
  const paths = {
    PERMIT: 'permits', RISK: 'risk-assessments', TBM: 'tbm', WORK: 'works', APPROVAL: 'approvals',
  };
  const resource = paths[String(recordType || '').toUpperCase()];
  if (!resource || !recordId) throw new Error('기록 종류 또는 기록 ID가 올바르지 않습니다.');
  return api(`/api/v1/${resource}/${recordId}`);
}

// API: POST /api/v1/agent/record-query
// CALLED_BY: 기록 질문 탭(백엔드 배포 전에는 호출하지 않음)
// TODO: BACKEND CONTRACT REQUIRED: 현재 main-ai-model에서 라우트를 확인할 수 없음.
export function startRecordQuery({ siteId, message, conversationId }) {
  if (!siteId || !message?.trim()) throw new Error('현장과 질문을 입력하세요.');
  return api('/api/v1/agent/record-query', {
    method: 'POST',
    body: {
      siteId,
      message: message.trim(),
      ...(conversationId ? { conversationId } : {}),
    },
  });
}

// API: GET /api/v1/agent/runs/{runId}
// CALLED_BY: 기록 질문 polling
// TODO: BACKEND CONTRACT REQUIRED: 현재 main-ai-model에서 라우트를 확인할 수 없음.
export function getRecordQueryRun(runId) {
  if (!runId) throw new Error('실행 ID가 없습니다.');
  return api(`/api/v1/agent/runs/${runId}`);
}

export function getDailySafetyLogs(siteId, { from, to } = {}) {
  if (!siteId) throw new Error('현장을 선택하세요.');
  const params = new URLSearchParams();
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  const query = params.size ? `?${params}` : '';
  return api(`/api/v1/sites/${siteId}/daily-safety-logs${query}`);
}

export function createDailySafetyLogDraft(siteId, request) {
  if (!siteId || !request?.date) throw new Error('현장과 일지 날짜를 입력하세요.');
  return api(`/api/v1/sites/${siteId}/daily-safety-logs/draft`, { method: 'POST', body: request });
}

export function getDailySafetyLog(logId) {
  if (!logId) throw new Error('안전일지 ID가 없습니다.');
  return api(`/api/v1/daily-safety-logs/${logId}`);
}

export function updateDailySafetyLog(logId, { lockVersion, summary }) {
  if (!logId || !Number.isSafeInteger(lockVersion) || !summary?.trim()) {
    throw new Error('안전일지 버전과 요약을 확인하세요.');
  }
  return api(`/api/v1/daily-safety-logs/${logId}`, {
    method: 'PUT', body: { lockVersion, summary: summary.trim() },
  });
}

export function submitDailySafetyLog(logId, lockVersion) {
  if (!logId || !Number.isSafeInteger(lockVersion)) throw new Error('안전일지 버전을 확인하세요.');
  return api(`/api/v1/daily-safety-logs/${logId}/submit`, { method: 'POST', body: { lockVersion } });
}
