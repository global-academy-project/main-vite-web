import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { getAgentMessages, getAgentRun, startRecordQuery, startWorkRegister } from '../../api/agents';
import { getPermit, jobId } from '../../api/jobs';
import { jobRecordPath } from '../../utils/job-forms';

const statuses = {
  PROCESSING: '처리 중', WAITING_INPUT: '추가 정보 필요', DONE: '초안 처리 완료', FAILED: '실행 실패',
};

function AgentResult({ result }) {
  const saved = result.saved;
  return (
    <div className="job-example">
      {saved && <section aria-label="서버에 저장된 AI 초안">
        <h3>작성 중 초안이 서버에 저장되었습니다</h3>
        <p className="job-help">승인된 문서가 아닙니다. 각 화면에서 최신 내용을 조회하고 검토하세요.</p>
        {saved.workDateAssumed && <p role="alert">작업 날짜가 없어 서버의 오늘 날짜로 저장했습니다. 작업일을 확인하세요.</p>}
        <ul>
          <li><Link to={jobRecordPath('WORK', saved.workId)}>작업 #{saved.workId}</Link></li>
          {saved.riskAssessmentId && <li><Link to={jobRecordPath('RISK', saved.riskAssessmentId)}>위험성평가 #{saved.riskAssessmentId}</Link></li>}
          {saved.permits.map((permit) => <li key={permit.permitId}>
            <Link to={jobRecordPath('PERMIT', permit.permitId)}>허가서 {permit.permitNo || `#${permit.permitId}`} · {permit.permitType}</Link>
          </li>)}
          {saved.tbmId && <li><Link to={jobRecordPath('TBM', saved.tbmId)}>TBM #{saved.tbmId}</Link></li>}
        </ul>
        {saved.notes.map((note, index) => <p key={index}>{note}</p>)}
      </section>}
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
      {result.drafts ? <details><summary>AI가 생성한 서류 초안 원문</summary>
        <p className="job-help">실제 저장 여부와 문서 ID는 위 서버 저장 결과를 확인하세요. 지원하지 않는 초안은 저장되지 않을 수 있습니다.</p>
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

function RecordQueryResult({ result }) {
  return <section className="job-example" aria-label="기록 질문 결과">
    {result.ask?.message && <p className="job-review-notice">{result.ask.message}</p>}
    {result.answer && <><h3>기록 질문 답변</h3><p style={{ whiteSpace: 'pre-wrap' }}>{result.answer}</p></>}
    {result.queries?.length > 0 && <details open><summary>조회 조건 및 건수</summary>
      {result.queries.map((query, index) => <section key={index}>
        <h4>{query.queryType}</h4>
        <pre className="table-scroll">{JSON.stringify(query.conditions, null, 2)}</pre>
        <p>조회 건수: {query.total ?? '미제공'}{query.truncated && ' · 일부 결과만 반환됨'}</p>
      </section>)}
    </details>}
    <p className="job-help">근거 링크는 서버가 현장 소속과 존재 여부를 확인한 기록만 표시합니다. 업무 기록은 변경하지 않습니다.</p>
  </section>;
}


export default function JobWorkAgent({
  siteId,
  disabled,
  taskType = 'WORK_REGISTER',
  persistedState = null,
  onPersistedStateChange = null,
}) {
  const records = taskType === 'RECORD_QUERY';
  const statusLabels = { ...statuses, DONE: records ? '답변 완료' : statuses.DONE };
  const title = records ? 'AI 기록 질문' : 'AI 작업 등록 대화';
  const titleId = records ? 'job-record-agent-title' : 'job-agent-title';
  const [message, setMessage] = useState(() => persistedState?.message ?? '');
  const [permitId, setPermitId] = useState('');
  const [lookupId, setLookupId] = useState(() => persistedState?.lookupId ?? '');
  const [execution, setExecution] = useState(() => persistedState?.execution ?? null);
  const [run, setRun] = useState(() => persistedState?.run ?? null);
  const [messages, setMessages] = useState(() => persistedState?.messages ?? []);
  const [polling, setPolling] = useState(() => persistedState?.polling ?? false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(() => persistedState?.error ?? '');
  const [creationUncertain, setCreationUncertain] = useState(false);
  const pending = useRef(false);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    if (!records || !onPersistedStateChange) return;
    onPersistedStateChange({ message, execution, run, messages, polling, lookupId, error });
  }, [records, onPersistedStateChange, message, execution, run, messages, polling, lookupId, error]);

  useEffect(() => {
    if (!execution || !polling || disabled) return;
    let cancelled = false;
    let timer;
    let attempts = 0;
    const poll = async () => {
      try {
        const saved = await getAgentRun(execution.runId, { conversationId: execution.conversationId, siteId, taskType });
        if (cancelled) return;
        setRun(saved); setCreationUncertain(false);
        if (saved.status === 'PROCESSING') {
          attempts += 1;
          if (attempts >= 80) {
            throw new Error('자동 조회를 중지했습니다. 서버 실행은 취소되지 않았습니다. 실행 상태 다시 조회로 확인하세요.');
          }
          timer = setTimeout(poll, 1500);
          return;
        }
        if (saved.status === 'FAILED') setError(saved.errorMessage || '에이전트 실행에 실패했습니다.');
        const history = await getAgentMessages(saved.conversationId);
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
  }, [execution, polling, disabled, siteId, taskType]);

  const send = async (event) => {
    event.preventDefault();
    if (pending.current || disabled || creationUncertain || polling || (execution && !run) || run?.status === 'PROCESSING') return;
    pending.current = true;
    setBusy(true);
    setError('');
    try {
      const text = message.trim();
      if (!text || text.length > 2000) throw new Error('메시지는 1~2000자로 입력하세요.');
      const targetPermitId = !records && permitId.trim() ? jobId(permitId) : undefined;
      if (targetPermitId) {
        const permit = await getPermit(targetPermitId, siteId);
        if (!['DRAFT', 'CHECKING', 'BLOCKED'].includes(permit.status)) {
          throw new Error('승인 요청된 허가서는 AI 판정에 연결할 수 없습니다. 수정 가능한 허가서를 선택하세요.');
        }
      }
      const started = await (records ? startRecordQuery : startWorkRegister)({
        siteId, message: text, conversationId: run?.conversationId, permitId: targetPermitId,
      });
      if (mounted.current) {
        setExecution({ runId: started.runId, conversationId: started.conversationId });
        setRun(null);
        setLookupId(String(started.runId));
        setMessage('');
        setPolling(true);
      }
    } catch (requestError) {
      if (mounted.current) {
        if (requestError.code === 'WRITE_OUTCOME_UNKNOWN') setCreationUncertain(true);
        setError(requestError.message || '메시지 전송에 실패했습니다.');
      }
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
  };
  const locked = disabled || busy || polling;
  return (
    <section className="panel job-form" aria-labelledby={titleId}>
      <div className="job-section-heading"><div><span className="job-eyebrow">{records ? 'AI RECORD QUERY' : 'AI WORK ASSISTANT'}</span>
        <h2 id={titleId}>{title}</h2></div>
        <span className="job-status-badge">{polling ? '상태 조회 중' : run ? statusLabels[run.status] : '새 대화'}</span>
      </div>
      <p className="job-help">Spring 서버를 통해 AI 처리를 요청합니다. 모델 제공자와 네트워크 모드는 서버 설정을 따릅니다. 개인정보·기밀은 입력하지 마세요.
        {records ? ' 기록 질문은 조회 전용이며 작업 등록과 별도 대화로 저장됩니다. mock 답변은 실제 기록 조회 결과가 아니며, 실제 조회에는 AI 서버의 기록 질문 처리 지원이 필요합니다.'
          : ' 완료 시 서버가 지원하는 작업·서류 초안을 작성 중으로 저장합니다. 저장 결과에 표시된 문서 ID를 확인하세요.'}</p>
      {error && <p className="dashboard-error" role="alert">{error}</p>}
      {creationUncertain && <section role="alert">
        <p>전송 결과를 확인하지 못해 추가 전송을 중지했습니다. 서버에 실행이 생성됐을 수 있습니다. 실행 ID를 알면 아래에서 조회하세요.</p>
        <button type="button" disabled={locked} onClick={() => {
          if (window.confirm('서버 실행 생성 여부를 확인했습니까? 새 전송은 중복 실행을 만들 수 있습니다.')) {
            setCreationUncertain(false); setError('');
          }
        }}>생성 여부 확인 후 전송 잠금 해제</button>
      </section>}
      {execution && <p role="status">실행 #{execution.runId}{run && <> · 대화 #{run.conversationId} · {statusLabels[run.status]}</>}</p>}
      <form onSubmit={send}>
        <fieldset disabled={locked || creationUncertain || (execution && !run) || run?.status === 'PROCESSING'}>
          <legend>{records ? '현장 기록 질문' : '작업 내용 전달'}</legend>
          {!records && <>
          <label>연결할 기존 허가서 ID (선택)<input inputMode="numeric" value={permitId} onChange={(event) => setPermitId(event.target.value)} /></label>
          <p className="job-help">기존 허가서를 연결하면 AI의 규칙 판정이 해당 허가서에 저장될 수 있습니다. 같은 현장이고 수정 가능한 상태(DRAFT·CHECKING·BLOCKED)인지 먼저 확인합니다.</p>
          </>}
          <label>{records ? '기록 질문 메시지' : 'AI 작업 메시지'}<textarea required maxLength={2000} rows={3} value={message}
            placeholder={records ? '예: 지난달 화기작업 중 측정값이 누락된 허가서를 알려 주세요.' : '작업 장소·종류·시간·인원과 실제 측정값을 알려 주세요.'}
            onChange={(event) => setMessage(event.target.value)} /></label>
          <div className="job-form-actions"><button type="submit">{busy ? '전송 중...' : run ? '대화 이어 보내기' : records ? '기록 질문 시작' : '작업 대화 시작'}</button></div>
        </fieldset>
        <button type="button" className="job-secondary-button" disabled={locked || creationUncertain || run?.status === 'PROCESSING'} onClick={() => {
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
      {messages.length > 0 && <section aria-label={records ? '기록 질문 대화 기록' : '작업 대화 기록'}><h3>대화 기록</h3>
        {messages.map((item) => <article key={item.messageId}><strong>{item.role === 'USER' ? '사용자' : 'AI'}</strong>
          <p>{item.content}</p></article>)}
      </section>}
      {run?.result && (records ? <RecordQueryResult result={run.result} /> : <AgentResult result={run.result} />)}
      {run?.steps.length > 0 && <details><summary>실행 단계</summary><ol>
        {run.steps.map((item) => <li key={item.seq}>{item.type} {item.toolName} · {item.status}{item.latencyMs != null && <> · {item.latencyMs}ms</>}</li>)}
      </ol></details>}
      {run?.citations.length > 0 && <details><summary>서버에 저장된 근거</summary><ul>
        {run.citations.map((item, index) => {
          const match = item.sourceType === 'RECORD' ? /^(WORK|PERMIT|RISK|TBM|APPROVAL):(\d+)$/.exec(item.locator ?? '') : null;
          const path = match ? jobRecordPath(match[1], Number(match[2])) : null;
          return <li key={index}><strong>{item.title || item.locator}</strong>
            <p>{item.snippet}</p>{path ? <Link to={path}>근거 기록 조회</Link>
              : item.sourceType === 'RECORD' && <span>기록 상세 화면 미지원 · {item.locator}</span>}
            {/^https?:\/\//i.test(item.url ?? '') && <a href={item.url} target="_blank" rel="noopener noreferrer">근거 원문</a>}</li>;
        })}
      </ul></details>}
    </section>
  );
}
