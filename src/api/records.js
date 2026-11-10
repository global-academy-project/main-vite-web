import { api } from './client.js';

// 문서 보기 (GET /previews/{type}/{id}). 저장하지 않는 미리보기이고 승인함 상세와 같은 응답이다.
export const PREVIEW_TYPES = Object.freeze(['PERMIT', 'RISK', 'TBM', 'INSPECTION', 'DAILY_LOG']);

export async function getDocumentPreview(targetType, targetId) {
  const type = String(targetType || '').toUpperCase();
  const id = Number(targetId);
  if (!PREVIEW_TYPES.includes(type) || !Number.isSafeInteger(id) || id < 1) throw new Error('문서 종류 또는 번호가 올바르지 않습니다.');
  const data = await api(`/api/v1/previews/${type}/${id}`);
  if (!data || data.targetType !== type || data.targetId !== id || typeof data.status !== 'string'
    || typeof data.official !== 'boolean' || !data.content || typeof data.content !== 'object') {
    throw new Error('문서 미리보기 응답 형식이 올바르지 않습니다.');
  }
  return data;
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

export function updateDailySafetyLog(logId, { lockVersion, summary, content }) {
  if (!logId || !Number.isSafeInteger(lockVersion) || !summary?.trim()) {
    throw new Error('안전일지 버전과 요약을 확인하세요.');
  }
  return api(`/api/v1/daily-safety-logs/${logId}`, {
    method: 'PUT',
    body: {
      lockVersion,
      summary: summary.trim(),
      ...(content ? { content } : {}),
    },
  });
}

export function submitDailySafetyLog(logId, lockVersion) {
  if (!logId || !Number.isSafeInteger(lockVersion)) throw new Error('안전일지 버전을 확인하세요.');
  return api(`/api/v1/daily-safety-logs/${logId}/submit`, { method: 'POST', body: { lockVersion } });
}
