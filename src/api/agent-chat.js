import { api } from './client';

const CHAT_PATH = '/test/api/v1/test/agent-chat';

export function sendAgentChat({ message, pendingText, inProgress, slots, mode = 'GUIDE' }) {
  const text = String(message ?? '').trim();
  if (!text || text.length > 2000) throw new Error('질문은 1~2000자로 입력해 주세요.');
  return api(CHAT_PATH, {
    method: 'POST',
    body: {
      message: text,
      mode,
      ...(pendingText ? { pendingText } : {}),
      ...(inProgress ? { inProgress } : {}),
      ...(slots ? { slots } : {}),
    },
    skipRefresh: true,
  });
}
