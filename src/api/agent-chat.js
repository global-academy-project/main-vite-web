import { api } from './client';

const CHAT_PATH = '/api/v1/agent/work-register';
const RUN_PATH = (runId) => `/api/v1/agent/runs/${runId}`;

// api()가 { success, data } 봉투를 벗겨 주는지 확인하지 못해, 둘 다 받는다.
const unwrap = (res) => (res && typeof res === 'object' && 'data' in res && res.data != null ? res.data : res);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// 1) 메시지 전송 -> 202 { conversationId, runId }
export async function sendAgentChat({ message, conversationId = null, permitId = null, siteId = 1 }) {
  const text = String(message ?? '').trim();
  if (!text || text.length > 2000) throw new Error('질문은 1~2000자로 입력해 주세요.');
  const res = await api(CHAT_PATH, {
    method: 'POST',
    body: { siteId, conversationId, permitId, message: text },
    skipRefresh: true,
  });
  return unwrap(res);
}

// 2) 실행 결과 조회
export async function getAgentRun(runId) {
  const res = await api(RUN_PATH(runId), { method: 'GET' });
  return unwrap(res);
}

// 3) 전송 -> 폴링. PROCESSING이 끝나면 { conversationId, run }을 돌려준다.
//    서버 처리 제한이 120초라 기다리는 시간은 130초로 둔다.
export async function sendAndWait(args, { intervalMs = 1500, timeoutMs = 130000 } = {}) {
  const sent = await sendAgentChat(args);
  const { conversationId, runId } = sent ?? {};
  if (!runId) throw new Error('실행 번호를 받지 못했습니다.');
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    await sleep(intervalMs);
    const run = await getAgentRun(runId);
    if (run?.status && run.status !== 'PROCESSING') return { conversationId, run };
  }
  throw new Error('AI 응답 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요.');
}
