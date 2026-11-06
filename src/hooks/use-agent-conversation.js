import { useCallback, useEffect, useRef, useState } from 'react';
import { getAgentMessages, getAgentRun, startRecordQuery, startWorkRegister } from '../api/agents';

const POLL_MS = 1500;
const POLL_LIMIT = 80;

// 마지막 대화를 기억해 두는 곳 (현장·대화 종류별). 다른 화면에 갔다 와도, 새로고침해도 같은 탭에서는 이어서 볼 수 있게.
// 이 브라우저 탭에서만 남고(sessionStorage), 읽기·쓰기가 막힌 환경이면 그냥 기억하지 않는다.
const storeKey = (siteId, taskType) => `agent-conversation:${siteId}:${taskType}`;
export function readLastConversation(siteId, taskType) {
  if (!siteId) return null;
  try {
    const value = JSON.parse(window.sessionStorage.getItem(storeKey(siteId, taskType)) ?? 'null');
    return Number.isSafeInteger(value?.conversationId) && value.conversationId > 0 ? value : null;
  } catch { return null; }
}
function writeLastConversation(siteId, taskType, value) {
  if (!siteId) return;
  try {
    if (value) window.sessionStorage.setItem(storeKey(siteId, taskType), JSON.stringify(value));
    else window.sessionStorage.removeItem(storeKey(siteId, taskType));
  } catch { /* 기억 못 해도 대화는 된다 */ }
}

/**
 * AI 대화 하나 (taskType 마다 따로: WORK_REGISTER / RECORD_QUERY). 서버는 대화 종류를 섞으면 409 이므로
 * 탭마다 이 훅을 하나씩 쓴다. 홈 AI 도우미와 작업 목록 "AI 대화" 시트가 같이 쓴다.
 *  - 보낸 뒤 runId 로 1.5초마다 상태 조회, 80번 넘으면 자동 조회 중지(서버 실행은 취소되지 않음)
 *  - PROCESSING 이 끝나면 대화 기록을 다시 받는다
 *  - 전송 결과를 알 수 없으면(WRITE_OUTCOME_UNKNOWN) 중복 실행을 막으려고 전송을 잠근다
 *  - 현장이 바뀌면 새 대화
 */
export function useAgentConversation({ siteId, taskType = 'WORK_REGISTER' }) {
  const records = taskType === 'RECORD_QUERY';
  const [execution, setExecution] = useState(null);
  const [run, setRun] = useState(null);
  const [messages, setMessages] = useState([]);
  const [pendingText, setPendingText] = useState('');
  const [polling, setPolling] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [uncertain, setUncertain] = useState(false);
  const sending = useRef(false);
  const mounted = useRef(true);
  const [site, setSite] = useState(siteId);
  // 지난 대화를 다시 열었을 때 이어 보낼 대화 번호 (마지막 실행을 못 받아도 이어서 보낼 수 있게)
  const [resumed, setResumed] = useState(null);
  const [resuming, setResuming] = useState(false);

  useEffect(() => {
    // StrictMode 는 개발 중 effect 를 두 번 돌리므로 마운트할 때마다 다시 true 로 둔다
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  // 현장이 바뀌면 새 대화 (렌더 중에 비교해서 바로 비운다)
  if (site !== siteId) {
    setSite(siteId);
    setExecution(null); setRun(null); setMessages([]); setPendingText(''); setPolling(false); setError(''); setUncertain(false); setResumed(null);
  }

  useEffect(() => {
    if (!execution || !polling || !siteId) return undefined;
    let cancelled = false;
    let timer;
    let attempts = 0;
    const poll = async () => {
      try {
        const saved = await getAgentRun(execution.runId, { conversationId: execution.conversationId, siteId, taskType });
        if (cancelled) return;
        setRun(saved);
        setUncertain(false);
        if (saved.status === 'PROCESSING') {
          attempts += 1;
          if (attempts >= POLL_LIMIT) throw new Error('자동 조회를 중지했습니다. 서버 실행은 취소되지 않았습니다. 잠시 뒤 다시 조회하세요.');
          timer = setTimeout(poll, POLL_MS);
          return;
        }
        if (saved.status === 'FAILED') setError(saved.errorMessage || 'AI 처리에 실패했습니다.');
        const history = await getAgentMessages(saved.conversationId);
        if (!cancelled) { setMessages(history); setPendingText(''); setPolling(false); }
      } catch (requestError) {
        if (!cancelled) {
          setError(`${requestError.message || '실행 조회에 실패했습니다.'} (실행 #${execution.runId})`);
          setPolling(false);
        }
      }
    };
    void poll();
    return () => { cancelled = true; clearTimeout(timer); };
  }, [execution, polling, siteId, taskType]);

  // 화면에 들어오면(또는 현장이 바뀌면) 이 현장·종류의 마지막 대화를 다시 연다.
  // 서버에서 대화 기록과 마지막 실행을 받아 오고, 실행이 아직 처리 중이면 자동 조회를 이어 간다. 못 받으면 조용히 잊는다.
  useEffect(() => {
    const last = readLastConversation(siteId, taskType);
    if (!last) return undefined;
    let active = true;
    Promise.all([
      getAgentMessages(last.conversationId),
      last.runId ? getAgentRun(last.runId, { conversationId: last.conversationId, siteId, taskType }).catch(() => null) : null,
    ]).then(([history, lastRun]) => {
      if (!active) return;
      setMessages(history); setResumed(last.conversationId); setRun(lastRun);
      setExecution(lastRun ? { runId: lastRun.runId, conversationId: last.conversationId } : null);
      setPolling(lastRun?.status === 'PROCESSING');
    }).catch(() => { if (active) writeLastConversation(siteId, taskType, null); });
    return () => { active = false; };
  }, [siteId, taskType]);

  const processing = polling || run?.status === 'PROCESSING' || Boolean(execution && !run && !error);
  const locked = !siteId || busy || processing || uncertain || resuming;
  // 이어 보낼 대화 번호 (React Compiler 가 의존값을 정확히 추적하도록 변수로 꺼낸다)
  const conversationId = run?.conversationId ?? resumed;
  const lastRunId = execution?.runId ?? null;
  useEffect(() => {
    if (conversationId) writeLastConversation(siteId, taskType, { conversationId, runId: lastRunId });
  }, [siteId, taskType, conversationId, lastRunId]);

  const send = useCallback(async (rawText, { permitId } = {}) => {
    const text = String(rawText ?? '').trim();
    if (sending.current || locked) return false;
    if (!text || text.length > 2000) { setError('메시지는 1~2000자로 입력하세요.'); return false; }
    sending.current = true;
    setBusy(true);
    setError('');
    setPendingText(text);
    try {
      const started = await (records ? startRecordQuery : startWorkRegister)({
        siteId, message: text, conversationId, ...(records ? {} : { permitId }),
      });
      if (mounted.current) {
        setExecution({ runId: started.runId, conversationId: started.conversationId });
        setRun(null);
        setPolling(true);
      }
      return true;
    } catch (requestError) {
      if (mounted.current) {
        if (requestError.code === 'WRITE_OUTCOME_UNKNOWN') setUncertain(true);
        setError(requestError.message || '메시지 전송에 실패했습니다.');
        setPendingText('');
      }
      return false;
    } finally {
      sending.current = false;
      if (mounted.current) setBusy(false);
    }
  }, [locked, records, conversationId, siteId]);

  const reset = useCallback(() => {
    if (processing) return;
    writeLastConversation(siteId, taskType, null);
    setExecution(null); setRun(null); setMessages([]); setPendingText(''); setError(''); setUncertain(false); setResumed(null);
  }, [processing, siteId, taskType]);

  /**
   * 지난 대화 다시 열기: 메시지 기록을 받고, 마지막 실행이 있으면 그 결과(근거 기록)도 받는다.
   * 이어서 보내면 같은 대화 번호로 간다. 마지막 실행이 아직 처리 중이면 자동 조회를 이어 간다.
   */
  const resume = useCallback(async ({ conversationId: target, lastRunId }) => {
    if (processing || sending.current || !target) return false;
    setResuming(true); setError(''); setUncertain(false); setPendingText('');
    try {
      const history = await getAgentMessages(target);
      let last = null;
      if (lastRunId) {
        try { last = await getAgentRun(lastRunId, { conversationId: target, siteId, taskType }); } catch { last = null; }
      }
      if (!mounted.current) return false;
      setMessages(history); setResumed(target); setRun(last);
      setExecution(last ? { runId: last.runId, conversationId: target } : null);
      setPolling(last?.status === 'PROCESSING');
      return true;
    } catch (requestError) {
      if (mounted.current) setError(requestError.message || '지난 대화를 불러오지 못했습니다.');
      return false;
    } finally {
      if (mounted.current) setResuming(false);
    }
  }, [processing, siteId, taskType]);

  /**
   * 실행 번호로 다시 조회: 그 실행의 대화를 열고(기록·결과), 아직 처리 중이면 자동 조회를 이어 간다.
   * 다른 종류(작업 등록 ↔ 기록 질문)나 다른 현장의 실행이면 getAgentRun 검사에서 막힌다.
   */
  const lookup = useCallback(async (runId) => {
    if (processing || sending.current) return false;
    setResuming(true); setError('');
    try {
      const found = await getAgentRun(runId, { siteId, taskType });
      if (!mounted.current) return false;
      setResuming(false);
      return await resume({ conversationId: found.conversationId, lastRunId: found.runId });
    } catch (requestError) {
      if (mounted.current) { setError(`${requestError.message || '실행을 찾지 못했습니다.'} (실행 #${runId})`); setResuming(false); }
      return false;
    }
  }, [processing, siteId, taskType, resume]);

  /** 서버에 실행이 생겼는지 확인한 뒤 잠금을 푼다 (중복 실행 주의) */
  const unlock = useCallback(() => { setUncertain(false); setError(''); }, []);

  /** 같은 실행을 다시 조회 (자동 조회가 멈췄을 때) */
  const retry = useCallback(() => {
    if (!execution) return;
    setError(''); setPolling(true);
  }, [execution]);

  return { run, messages, pendingText, processing, busy, error, uncertain, locked, send, reset, unlock, retry, execution, resume, lookup, resuming, conversationId };
}
