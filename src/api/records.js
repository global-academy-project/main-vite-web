import { api } from './client';

export function getRecordDetail(recordType, recordId) {
  return api(`/api/v1/records/${recordType}/${recordId}`);
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

export function getDailySafetyLogs(siteId) {
  return api(`/api/v1/sites/${siteId}/daily-safety-logs`);
}

export function createDailySafetyLogDraft(siteId, request) {
  return api(`/api/v1/sites/${siteId}/daily-safety-logs/draft`, { method: 'POST', body: request });
}

export function submitDailySafetyLog(logId) {
  return api(`/api/v1/daily-safety-logs/${logId}/submit`, { method: 'POST' });
}
