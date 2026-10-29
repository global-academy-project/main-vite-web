import { api } from './client.js';
import { jobId } from './jobs.js';

const runStatuses = ['PROCESSING', 'WAITING_INPUT', 'DONE', 'FAILED'];
const positiveId = (value) => Number.isSafeInteger(value) && value > 0;

export async function startWorkRegister({ siteId, message, conversationId, permitId }) {
  const text = typeof message === 'string' ? message.trim() : '';
  if (!text || text.length > 2000) throw new Error('메시지는 1~2000자로 입력하세요.');
  const body = {
    siteId: jobId(siteId), message: text,
    ...(conversationId != null ? { conversationId: jobId(conversationId) } : {}),
    ...(permitId != null ? { permitId: jobId(permitId) } : {}),
  };
  const started = await api('/api/v1/agent/work-register', { method: 'POST', body });
  if (!positiveId(started?.runId) || !positiveId(started.conversationId)
    || !runStatuses.includes(started.status)
    || (body.conversationId && body.conversationId !== started.conversationId)) {
    throw new Error('에이전트 실행 시작 응답 형식이 올바르지 않습니다.');
  }
  return started;
}

export async function getAgentRun(runId, { conversationId, taskType = 'WORK_REGISTER' } = {}) {
  const id = jobId(runId);
  const expectedConversation = conversationId == null ? null : jobId(conversationId);
  const data = await api(`/api/v1/agent/runs/${id}`);
  if (!data || data.runId !== id || !positiveId(data.conversationId) || data.taskType !== taskType
    || !runStatuses.includes(data.status)
    || (expectedConversation && expectedConversation !== data.conversationId)
    || !Array.isArray(data.steps) || !Array.isArray(data.citations)
    || (['DONE', 'WAITING_INPUT'].includes(data.status)
      && (!data.result || data.result.runStatus !== data.status))) {
    throw new Error('에이전트 실행 응답 형식이 올바르지 않습니다.');
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
