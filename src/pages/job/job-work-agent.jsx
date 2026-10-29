import { useEffect, useRef, useState } from 'react';
import { api } from '../../api/client';
import { getPermit, jobId } from '../../api/jobs';

const statuses = {
  PROCESSING: '처리 중', WAITING_INPUT: '추가 정보 필요', DONE: '초안 처리 완료', FAILED: '실행 실패',
};

function requireRun(data, execution) {
  if (!data || data.runId !== execution.runId || !Number.isSafeInteger(data.conversationId)
    || data.conversationId < 1 || data.taskType !== 'WORK_REGISTER'
    || !Object.hasOwn(statuses, data.status)
    || (execution.conversationId && execution.conversationId !== data.conversationId)
    || !Array.isArray(data.steps) || !Array.isArray(data.citations)
    || (['DONE', 'WAITING_INPUT'].includes(data.status)
      && (!data.result || data.result.runStatus !== data.status))) {
    throw new Error('에이전트 실행 응답 형식이 올바르지 않습니다.');
  }
  return data;
}

function AgentResult({ result }) {
  return (
    <div className="job-example">
      {result.ask?.message && <p className="job-review-notice">{result.ask.message}</p>}
      {result.classification && <details open>
        <summary>작업 분류</summary>
        <p>작업 유형: {result.classification.workTypes?.join(', ') || '미분류'}</p>
        <p>필요 허가: {result.classification.requiredPermits?.join(', ') || '제공되지 않음'}</p>
        <p>고위험 여부: {result.classification.highRisk == null ? '미확인' : result.classification.highRisk ? '고위험' : '일반'}</p>
      </details>}
      {result.approvalGate && <section aria-label="AI 승인 요청 검토">
        <h3>AI 승인 요청 검토: {result.approvalGate.canRequest ? '요건 충족' : '요건 미충족'}</h3>
        <ul>{result.approvalGate.reasons?.map((reason, index) => <li key={index}>{reason}</li>)}</ul>
        <p className="job-help">이 결과는 승인이나 작업 시작 허가가 아닙니다. 실제 허가서는 작업허가 화면에서 서버 판정 후 승인 요청해야 합니다.</p>
      </section>}
      {result.ruleCheck && <details open><summary>규칙 검토</summary>
        <p>{result.ruleCheck.blocked ? '차단 사유 있음' : '차단 사유 없음 (최종 안전 승인 아님)'}</p>
        <ul>{result.ruleCheck.evaluations?.map((item, index) => <li key={index}>
          <strong>{item.status} · {item.title}</strong><p>{item.message}</p><p>근거: {item.basis}</p>
        </li>)}</ul>
        {result.ruleCheck.notes?.map((note, index) => <p key={index}>{note}</p>)}
        {result.ruleCheck.conflicts?.map((note, index) => <p key={index}>충돌: {note}</p>)}
      </details>}
      {result.verification?.length > 0 && <section aria-label="초안 검증 문제"><h3>초안 검증 문제</h3>
        <ul>{result.verification.map((item, index) => <li key={index}>{item.code} · {item.message}</li>)}</ul>
      </section>}
      {result.guidance?.map((item, index) => <p key={index}><strong>{item.title}</strong> · {item.why}</p>)}
      {result.drafts ? <details><summary>생성된 서류 초안 (미저장)</summary>
        <p className="job-help">위험성평가·허가·점검표·TBM 초안입니다. 업무 테이블에 자동 등록되지 않습니다.</p>
        <pre className="table-scroll">{JSON.stringify(result.drafts, null, 2)}</pre>
      </details> : <p className="job-help">제공된 서류 초안이 없습니다. mock 모드에서도 초안이 비어 있을 수 있습니다.</p>}
      {result.citations?.length > 0 && <details><summary>AI 응답 근거</summary>
        <ul>{result.citations.map((item, index) => <li key={index}>
          <strong>{item.source || item.refId}</strong><p>{item.snippet}</p>
        </li>)}</ul>
      </details>}
    </div>
  );
}

export default function JobWorkAgent({ siteId, disabled }) {
  const [message, setMessage] = useState('');
  const [permitId, setPermitId] = useState('');
  const [lookupId, setLookupId] = useState('');
  const [execution, setExecution] = useState(null);
  const [run, setRun] = useState(null);
  const [messages, setMessages] = useState([]);
  const [polling, setPolling] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef(false);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    if (!execution || !polling || disabled) return;
    let cancelled = false;
    let timer;
    let attempts = 0;
    const poll = async () => {
      try {
        const saved = requireRun(await api(`/api/v1/agent/runs/${execution.runId}`), execution);
        if (cancelled) return;
        setRun(saved);
        if (saved.status === 'PROCESSING') {
          attempts += 1;
          if (attempts >= 80) {
            throw new Error('자동 조회를 중지했습니다. 서버 실행은 취소되지 않았습니다. 실행 상태 다시 조회로 확인하세요.');
          }
          timer = setTimeout(poll, 1500);
          return;
        }
        if (saved.status === 'FAILED') setError(saved.errorMessage || '에이전트 실행에 실패했습니다.');
        const history = await api(`/api/v1/agent/conversations/${saved.conversationId}/messages`);
        if (!Array.isArray(history) || !history.every((item) => Number.isSafeInteger(item.messageId)
          && typeof item.content === 'string' && ['USER', 'ASSISTANT'].includes(item.role))) {
          throw new Error('대화 메시지 응답 형식이 올바르지 않습니다.');
        }
        if (!cancelled) { setMessages(history); setPolling(false); }
      } catch (requestError) {
        if (!cancelled) {
          setError(`${requestError.message || '실행 조회에 실패했습니다.'} 실행 #${execution.runId}의 상태를 다시 조회하세요.`);
          setPolling(false);
        }
      }
    };
    void poll();
    return () => { cancelled = true; clearTimeout(timer); };
  }, [execution, polling, disabled]);

  const send = async (event) => {
    event.preventDefault();
    if (pending.current || disabled || polling || (execution && !run) || run?.status === 'PROCESSING') return;
    pending.current = true;
    setBusy(true);
    setError('');
    try {
      const text = message.trim();
      if (!text || text.length > 2000) throw new Error('메시지는 1~2000자로 입력하세요.');
      const targetPermitId = permitId.trim() ? jobId(permitId) : undefined;
      if (targetPermitId) await getPermit(targetPermitId, siteId);
      const started = await api('/api/v1/agent/work-register', {
        method: 'POST',
        body: { siteId, message: text, ...(run ? { conversationId: run.conversationId } : {}),
          ...(targetPermitId ? { permitId: targetPermitId } : {}) },
      });
      if (!Number.isSafeInteger(started?.runId) || started.runId < 1
        || !Number.isSafeInteger(started.conversationId) || started.conversationId < 1
        || !Object.hasOwn(statuses, started.status)) {
        throw new Error('에이전트 실행 시작 응답 형식이 올바르지 않습니다.');
      }
      if (mounted.current) {
        setExecution({ runId: started.runId, conversationId: started.conversationId });
        setRun(null);
        setLookupId(String(started.runId));
        setMessage('');
        setPolling(true);
      }
    } catch (requestError) {
      if (mounted.current) setError(`${requestError.message || '메시지 전송에 실패했습니다.'} 전송 후 응답을 받지 못했다면 서버에 실행이 생성됐을 수 있으므로 중복 전송에 주의하세요.`);
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
  };
  const locked = disabled || busy || polling;
  return (
    <section className="panel job-form" aria-labelledby="job-agent-title">
      <div className="job-section-heading"><div><span className="job-eyebrow">AI WORK ASSISTANT</span>
        <h2 id="job-agent-title">AI 작업 등록 대화</h2></div>
        <span className="job-status-badge">{polling ? '상태 조회 중' : run ? statuses[run.status] : '새 대화'}</span>
      </div>
      <p className="job-help">Spring 서버를 통해 AI 처리를 요청합니다. 모델 제공자와 네트워크 모드는 서버 설정을 따릅니다. 개인정보·기밀은 입력하지 마세요. 대화·실행 기록은 저장되지만 작업·서류 초안은 자동 등록되지 않습니다.</p>
      {error && <p className="dashboard-error" role="alert">{error}</p>}
      {execution && <p role="status">실행 #{execution.runId}{run && <> · 대화 #{run.conversationId} · {statuses[run.status]}</>}</p>}
      <form onSubmit={send}>
        <fieldset disabled={locked || (execution && !run) || run?.status === 'PROCESSING'}>
          <legend>작업 내용 전달</legend>
          <label>연결할 기존 허가서 ID (선택)<input inputMode="numeric" value={permitId} onChange={(event) => setPermitId(event.target.value)} /></label>
          <p className="job-help">기존 허가서를 연결하면 AI의 규칙 판정이 해당 허가서에 저장될 수 있습니다. 같은 현장의 허가서인지 먼저 확인합니다.</p>
          <label>AI 작업 메시지<textarea required maxLength={2000} rows={3} value={message}
            placeholder="작업 장소·종류·시간·인원과 실제 측정값을 알려 주세요."
            onChange={(event) => setMessage(event.target.value)} /></label>
          <div className="job-form-actions"><button type="submit">{busy ? '전송 중...' : run ? '대화 이어 보내기' : '작업 대화 시작'}</button></div>
        </fieldset>
        <button type="button" className="job-secondary-button" disabled={locked || run?.status === 'PROCESSING'} onClick={() => {
          setExecution(null); setRun(null); setMessages([]); setMessage(''); setPermitId(''); setLookupId(''); setError('');
        }}>새 대화</button>
      </form>
      <form className="job-lookup" onSubmit={(event) => {
        event.preventDefault();
        try {
          const id = jobId(lookupId);
          setExecution({ runId: id }); setRun(null); setMessages([]); setPermitId(''); setError(''); setPolling(true);
        } catch (requestError) { setError(requestError.message); }
      }}>
        <fieldset disabled={locked}><legend>기존 실행 조회</legend>
          <label>AI 실행 ID<input required inputMode="numeric" value={lookupId} onChange={(event) => setLookupId(event.target.value)} /></label>
          <button type="submit">실행 상태 다시 조회</button>
        </fieldset>
      </form>
      {messages.length > 0 && <section aria-label="작업 대화 기록"><h3>대화 기록</h3>
        {messages.map((item) => <article key={item.messageId}><strong>{item.role === 'USER' ? '사용자' : 'AI'}</strong>
          <p>{item.content}</p></article>)}
      </section>}
      {run?.result && <AgentResult result={run.result} />}
      {run?.steps.length > 0 && <details><summary>실행 단계</summary><ol>
        {run.steps.map((item) => <li key={item.seq}>{item.type} {item.toolName} · {item.status}{item.latencyMs != null && <> · {item.latencyMs}ms</>}</li>)}
      </ol></details>}
      {run?.citations.length > 0 && <details><summary>서버에 저장된 근거</summary><ul>
        {run.citations.map((item, index) => <li key={index}><strong>{item.title || item.locator}</strong>
          <p>{item.snippet}</p>{/^https?:\/\//i.test(item.url ?? '') && <a href={item.url} target="_blank" rel="noopener noreferrer">근거 원문</a>}</li>)}
      </ul></details>}
    </section>
  );
}
