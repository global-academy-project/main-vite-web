import { api } from './client.js';
import { jobId, jobWrite } from './jobs.js';

const runStatuses = ['PROCESSING', 'WAITING_INPUT', 'DONE', 'FAILED'];
const positiveId = (value) => Number.isSafeInteger(value) && value > 0;

async function startAgent(path, { siteId, message, conversationId, permitId }) {
  const text = typeof message === 'string' ? message.trim() : '';
  if (!text || text.length > 2000) throw new Error('메시지는 1~2000자로 입력하세요.');
  const body = {
    siteId: jobId(siteId), message: text,
    ...(conversationId != null ? { conversationId: jobId(conversationId) } : {}),
    ...(permitId != null ? { permitId: jobId(permitId) } : {}),
  };
  return jobWrite(async () => {
    const started = await api(path, { method: 'POST', body });
    if (!positiveId(started?.runId) || !positiveId(started.conversationId)
      || !runStatuses.includes(started.status)
      || (body.conversationId && body.conversationId !== started.conversationId)) {
      throw new Error('에이전트 실행 시작 응답 형식이 올바르지 않습니다.');
    }
    return started;
  });
}

export const startWorkRegister = (input) => startAgent('/api/v1/agent/work-register', input);
export const startRecordQuery = ({ siteId, message, conversationId }) =>
  startAgent('/api/v1/agent/record-query', { siteId, message, conversationId });

export async function getAgentRun(runId, { conversationId, siteId, taskType = 'WORK_REGISTER' } = {}) {
  const id = jobId(runId);
  const expectedConversation = conversationId == null ? null : jobId(conversationId);
  const expectedSite = siteId == null ? null : jobId(siteId);
  const data = await api(`/api/v1/agent/runs/${id}`);
  if (!data || data.runId !== id || !positiveId(data.conversationId) || data.taskType !== taskType
    || !runStatuses.includes(data.status)
    || (expectedConversation && expectedConversation !== data.conversationId)
    || (expectedSite && expectedSite !== data.siteId)
    || !Array.isArray(data.steps) || !Array.isArray(data.citations)
    || (['DONE', 'WAITING_INPUT'].includes(data.status)
      && (!data.result || data.result.runStatus !== data.status))) {
    throw new Error('에이전트 실행 응답 형식이 올바르지 않습니다.');
  }
  if (taskType === 'RECORD_QUERY' && data.result
    && ((data.status === 'DONE' && (typeof data.result.answer !== 'string' || !data.result.answer.trim()))
      || (data.result.queries != null && (!Array.isArray(data.result.queries)
        || !data.result.queries.every((query) => query && typeof query.queryType === 'string'))))) {
    throw new Error('기록 질문 답변 응답 형식이 올바르지 않습니다.');
  }
  const saved = data.result?.saved;
  if (saved && (!positiveId(saved.workId) || saved.workId !== data.workId
    || (saved.riskAssessmentId != null && !positiveId(saved.riskAssessmentId))
    || (saved.tbmId != null && !positiveId(saved.tbmId))
    || !Array.isArray(saved.permits) || !saved.permits.every((permit) => positiveId(permit?.permitId))
    || !Array.isArray(saved.notes))) {
    throw new Error('에이전트 초안 저장 응답 형식이 올바르지 않습니다.');
  }
  return data;
}

export async function getAgentMessages(conversationId) {
  const history = await api(`/api/v1/agent/conversations/${jobId(conversationId)}/messages`);
  if (!Array.isArray(history) || !history.every((item) => item && positiveId(item.messageId)
    && typeof item.content === 'string' && ['USER', 'ASSISTANT'].includes(item.role))) {
    throw new Error('대화 메시지 응답 형식이 올바르지 않습니다.');
  }
  return history;
}

/**
 * 내 지난 대화 목록 (현장 · 대화 종류별, 최근 순). 서버: GET /api/v1/agent/conversations — 읽기 전용, 본인 대화만.
 * [{ conversationId, siteId, taskType, title, messageCount, lastMessageAt, lastRunId, lastRunStatus }]
 */
export async function getAgentConversations({ siteId, taskType, limit = 30 }) {
  const query = new URLSearchParams({ siteId: String(jobId(siteId)), taskType, limit: String(Math.min(Math.max(Number(limit) || 30, 1), 50)) });
  const list = await api(`/api/v1/agent/conversations?${query}`);
  if (!Array.isArray(list) || !list.every((item) => item && positiveId(item.conversationId) && item.taskType === taskType
    && (item.lastRunId == null || positiveId(item.lastRunId)))) {
    throw new Error('지난 대화 목록 응답 형식이 올바르지 않습니다.');
  }
  return list;
}
