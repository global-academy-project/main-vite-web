import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useWorkSite, workTypes } from '../../api/workers';
import { createWork, getWork, requireWork, validatePeriod } from '../../api/jobs';
import JobPageLayout, { JobPageHeading } from '../../components/job-page-layout';
import { JobSiteSelector } from './job-work-form';
import JobWorkAgent from './job-work-agent';
import { getRecordQueryRun, startRecordQuery } from '../../api/records';
import { sendAgentChat } from '../../api/agent-chat';
import { useSearchParams } from 'react-router-dom';

function WorkWorkspace({ site, disabled }) {
  const [work, setWork] = useState(null);
  const [lookupId, setLookupId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [creationUncertain, setCreationUncertain] = useState(false);
  const pending = useRef(false);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const run = async (action, success, creating = false) => {
    if (pending.current || disabled) return;
    pending.current = true;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const saved = await action();
      if (mounted.current) {
        setWork(saved);
        setLookupId(String(saved.workId));
        setMessage(success);
        if (creating) setCreationUncertain(false);
      }
    } catch (requestError) {
      if (mounted.current) {
        if (creating && requestError.code === 'WRITE_OUTCOME_UNKNOWN') setCreationUncertain(true);
        setError(requestError.message || '작업 요청에 실패했습니다.');
      }
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
  };
  const create = (event) => {
    event.preventDefault();
    if (creationUncertain) return;
    const fields = Object.fromEntries(new FormData(event.currentTarget));
    void run(() => {
      if (fields.startAt && fields.endAt) validatePeriod(fields.startAt, fields.endAt);
      const workerCount = fields.workerCount ? Number(fields.workerCount) : null;
      if (workerCount !== null && (!Number.isSafeInteger(workerCount) || workerCount < 1)) {
        throw new Error('작업 인원은 1 이상의 정수로 입력하세요.');
      }
      if (!fields.title.trim()) throw new Error('작업명을 입력하세요.');
      return createWork({
        siteId: site.siteId, workDate: fields.workDate, title: fields.title.trim(),
        description: fields.description.trim() || null, workType: fields.workType,
        startAt: fields.startAt || null, endAt: fields.endAt || null, workerCount,
      });
    }, '작업을 서버에 저장했습니다. 작업 승인은 별도 절차입니다.', true);
  };

  return (
    <>
      {error && <p className="dashboard-error" role="alert">{error}</p>}
      {message && <p className="job-review-notice" role="status">{message}</p>}
      {creationUncertain && <section className="job-demo-notice" role="alert">
        <p>작업 생성 결과가 불확실하여 추가 등록을 중지했습니다. 작업 ID를 알면 먼저 조회하세요. 작업 목록 API가 없으므로 ID도 모르면 관리자에게 저장 여부를 확인해야 합니다.</p>
        <button type="button" disabled={busy || disabled} onClick={() => {
          if (window.confirm('관리자 또는 작업 ID 조회로 저장 여부를 확인했으며, 새 작업 등록을 진행하시겠습니까? 중복 작업이 생길 수 있습니다.')) {
            setCreationUncertain(false); setError('');
          }
        }}>반영 여부 확인 후 등록 잠금 해제</button>
      </section>}
      <div className="job-work-grid">
        <form className="panel job-form" onSubmit={create}>
          <div className="job-section-heading"><div><span className="job-eyebrow">NEW WORK</span><h2>작업 등록</h2><p className="job-help">작업 기본 정보를 저장하고 허가서 작성으로 이어갑니다.</p></div><span className="job-status-badge">서버 연결</span></div>
          <fieldset disabled={disabled || busy || creationUncertain}>
            <legend>{site.name}</legend>
            <div className="job-fields">
              <label>작업명<input name="title" required maxLength={200} placeholder="예: 저장탱크 주변 용접 작업" /></label>
              <label>작업일<input name="workDate" type="date" required /></label>
              <label>작업 유형<select name="workType">{Object.entries(workTypes).map(([code, label]) => <option key={code} value={code}>{label}</option>)}</select></label>
              <label>작업 인원<input name="workerCount" type="number" min="1" step="1" /></label>
              <label>시작 일시<input name="startAt" type="datetime-local" /></label>
              <label>종료 일시<input name="endAt" type="datetime-local" /></label>
              <label className="job-field-wide">작업 내용<textarea name="description" placeholder="작업 범위와 확인할 사항을 입력해 주세요." /></label>
            </div>
            <div className="job-form-actions"><span>저장 후 작업 ID가 발급됩니다.</span><button type="submit">{busy ? '처리 중...' : '작업 저장'}</button></div>
          </fieldset>
        </form>
        <div className="job-work-aside">
          <form className="panel job-form job-lookup" onSubmit={(event) => {
            event.preventDefault();
            void run(async () => requireWork(await getWork(lookupId), site.siteId), '서버의 작업을 조회했습니다.');
          }}>
            <span className="job-eyebrow">FIND WORK</span>
            <h2>작업 조회</h2>
            <fieldset disabled={disabled || busy}>
              <label>작업 ID<input value={lookupId} placeholder="저장한 작업 ID 입력" onChange={(event) => { setLookupId(event.target.value); setWork(null); setMessage(''); }} required inputMode="numeric" /></label>
              <button type="submit">조회</button>
            </fieldset>
            <p className="job-help">현재 서버에는 현장별 작업 목록·통계 API가 없습니다. 저장한 작업 ID로 다시 조회하세요.</p>
          </form>
          {work && <section className="panel job-example" aria-label="저장된 작업">
            <div className="job-section-heading"><span className="job-eyebrow">WORK #{work.workId}</span><span className="job-status-badge">{work.status}</span></div>
            <h2>{work.title}</h2>
            <p>{work.workDate} · {workTypes[work.workType]}</p>
            <p>{work.description || '작업 내용 없음'}</p>
            <p>{work.startAt || '시작 미지정'} ~ {work.endAt || '종료 미지정'} · 인원 {work.workerCount ?? '미지정'}</p>
            <Link className="job-link-button" to={`/job/permits?workId=${work.workId}`}>이 작업의 허가서 작성 <span aria-hidden="true">→</span></Link>
          </section>}
          {!work && <section className="job-empty-state" aria-label="작업 조회 안내"><span className="job-eyebrow">WORK DETAILS</span><h3>작업 정보를 이곳에서 확인하세요</h3><p className="job-help">새 작업을 저장하거나 기존 작업 ID를 조회하면 상세 정보와 허가서 작성 링크가 표시됩니다.</p></section>}
        </div>
      </div>
    </>
  );
}

export default function JobWorkspace() {
  const context = useWorkSite();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = ['work', 'records', 'chat'].includes(searchParams.get('tab')) ? searchParams.get('tab') : 'work';
  const [assistantTab, setAssistantTab] = useState(initialTab);

  const changeAssistantTab = (tab) => {
    setAssistantTab(tab);
    setSearchParams(tab === 'records' ? { tab: 'records' } : {}, { replace: true });
  };

  return (
    <JobPageLayout title="작업 등록·조회" user={context.account?.user} contentClassName="job-management">
      <JobPageHeading title="작업 등록·조회" description={`선택 현장: ${context.currentSite?.name ?? '현장 미선택'}`} />
      <JobSiteSelector context={context} />
      {context.currentSite && <section className="job-overview-workspace" aria-labelledby="job-workspace-title">
        <section className="panel" aria-label="AI 작업 및 기록 질문">
          <nav className="approval-tabs" aria-label="AI 도우미 탭">
            <button type="button" className={assistantTab === 'work' ? 'is-active' : ''} onClick={() => changeAssistantTab('work')}>작업 등록</button>
            <button type="button" className={assistantTab === 'records' ? 'is-active' : ''} onClick={() => changeAssistantTab('records')}>기록 질문</button>
            <button type="button" className={assistantTab === 'chat' ? 'is-active' : ''} onClick={() => changeAssistantTab('chat')}>AI 채팅</button>
          </nav>
          {assistantTab === 'work' ? <JobWorkAgent key={`agent-${context.currentSite.siteId}`} siteId={context.currentSite.siteId} disabled={context.selecting} /> : assistantTab === 'records' ? (
            <RecordQueryPanel siteId={context.currentSite.siteId} />
          ) : <ChatPanel />}
        </section>
        <div className="job-section-heading">
          <div><span className="job-eyebrow">WORK MANAGEMENT</span><h2 id="job-workspace-title">작업 등록·조회</h2><p className="job-help">위 현황과 별개로, 선택 현장의 개별 작업은 실제 서버에 저장하고 조회할 수 있습니다.</p></div>
        </div>
        <WorkWorkspace key={context.currentSite.siteId} site={context.currentSite} disabled={context.selecting} />
      </section>}
    </JobPageLayout>
  );
}

function ChatPanel() {
  const [messages, setMessages] = useState([]);
  const [question, setQuestion] = useState('');
  const [context, setContext] = useState({ pendingText: null, inProgress: null, slots: null });
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event) => {
    event.preventDefault();
    const message = question.trim();
    if (!message || sending) return;
    setQuestion(''); setError(''); setSending(true);
    setMessages((current) => [...current, { role: 'user', text: message }]);
    try {
      const response = await sendAgentChat({ message, ...context });
      setMessages((current) => [...current, { role: 'assistant', text: chatReply(response) }]);
      if (response.askKind === 'SCENARIO') setContext({ pendingText: response.pendingText, inProgress: null, slots: null });
      else if (response.askKind === 'SLOT') setContext({ pendingText: null, inProgress: response.inProgress, slots: response.result?.slots ?? null });
      else setContext({ pendingText: null, inProgress: null, slots: null });
    } catch (requestError) { setError(requestError.message || 'AI 답변을 받지 못했습니다.'); }
    finally { setSending(false); }
  };

  return <section className="chat-panel" aria-label="AI 채팅">
    <div className="chat-messages" aria-live="polite">
      {!messages.length && <p className="job-help">작업과 안전에 대해 질문해 보세요.</p>}
      {messages.map((message, index) => <div className={`chat-message chat-message-${message.role}`} key={`${message.role}-${index}`}><span>{message.role === 'user' ? '나' : 'AI'}</span><p>{message.text}</p></div>)}
      {sending && <div className="chat-message chat-message-assistant"><span>AI</span><p>답변을 작성하고 있습니다...</p></div>}
    </div>
    {error && <p className="dashboard-error" role="alert">{error}</p>}
    <form className="chat-composer" onSubmit={submit}><label className="sr-only" htmlFor="workspace-ai-chat">AI 채팅 입력</label><textarea id="workspace-ai-chat" rows={3} maxLength={2000} value={question} disabled={sending} onChange={(event) => setQuestion(event.target.value)} placeholder="궁금한 내용을 입력하세요" /><button type="submit" disabled={!question.trim() || sending}>{sending ? '답변 중...' : '보내기'}</button></form>
  </section>;
}

function chatReply(response) {
  if (response?.askMessage) return response.askMessage;
  if (response?.redirect) return `이 질문은 ${response.redirect} 화면에서 처리할 수 있습니다.`;
  const guidance = response?.result?.guidance;
  if (Array.isArray(guidance) && guidance.length) return guidance.map((item) => `${item.title}: ${item.why}`).join('\n');
  if (response?.result?.runStatus === 'DONE') return '질문 분석이 완료되었습니다.';
  return response?.label || '질문 처리가 완료되었습니다.';
}

function RecordQueryPanel({ siteId }) {
  const [question, setQuestion] = useState('');
  const [conversationId, setConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [runId, setRunId] = useState(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!runId) return undefined;
    let cancelled = false;
    let timer;
    const poll = async () => {
      try {
        const result = await getRecordQueryRun(runId);
        if (cancelled) return;
        const run = result?.result || result;
        if (run?.runStatus === 'DONE' || run?.runStatus === 'WAITING_INPUT' || run?.status === 'FAILED') {
          setMessages((current) => [...current, { role: 'assistant', run }]);
          setRunning(false); setRunId(null);
        } else timer = window.setTimeout(poll, 1200);
      } catch (requestError) {
        if (!cancelled) { setError(requestError.message || '기록 질문 결과를 불러오지 못했습니다.'); setRunning(false); setRunId(null); }
      }
    };
    void poll();
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [runId]);

  const submit = async (event) => {
    event.preventDefault();
    const message = question.trim();
    if (!message || running) return;
    setError(''); setQuestion(''); setRunning(true);
    setMessages((current) => [...current, { role: 'user', text: message }]);
    try {
      const started = await startRecordQuery({ siteId, message, conversationId });
      setConversationId(started.conversationId || conversationId);
      setRunId(started.runId);
    } catch (requestError) { setError(requestError.message || '기록 질문을 시작하지 못했습니다.'); setRunning(false); }
  };

  return <section className="job-form" aria-labelledby="record-query-title">
    <span className="job-eyebrow">RECORD QUERY</span><h2 id="record-query-title">기록 질문</h2>
    <p className="job-help">공식 기록만 조회하며, 답변과 근거 기록을 함께 보여줍니다.</p>
    <div className="record-query-messages" aria-live="polite">{messages.map((item, index) => item.role === 'user'
      ? <p key={index}><strong>나</strong> {item.text}</p>
      : <RecordQueryResult key={index} run={item.run} />)}{running && <p role="status">기록을 조회하고 있습니다...</p>}</div>
    <form onSubmit={submit}><label className="sr-only" htmlFor="record-query-input">기록 질문</label><input id="record-query-input" value={question} maxLength={2000} disabled={running} onChange={(event) => setQuestion(event.target.value)} placeholder="예: 지난달 승인된 화기작업허가를 보여줘" /><button type="submit" disabled={!question.trim() || running}>질문하기</button></form>
    {error && <p className="dashboard-error" role="alert">{error}</p>}
  </section>;
}

function RecordQueryResult({ run }) {
  if (run?.ask?.message) return <div className="record-query-result"><strong>추가 정보가 필요합니다.</strong><p>{run.ask.message}</p></div>;
  return <div className="record-query-result"><strong>AI 답변</strong><p>{run?.answer || '답변이 없습니다.'}</p>
    {Array.isArray(run?.queries) && run.queries.length > 0 && <details><summary>조회 조건</summary><pre>{JSON.stringify(run.queries, null, 2)}</pre></details>}
    {Array.isArray(run?.evidence) && run.evidence.length > 0 && <details><summary>근거 기록</summary><ul>{run.evidence.map((item) => <li key={`${item.type}-${item.id}`}>{item.type} #{item.id}</li>)}</ul></details>}
    {Array.isArray(run?.steps) && run.steps.length > 0 && <details><summary>진행 과정</summary><ul>{run.steps.map((step) => <li key={step.seq || step.name}>{step.name || step.kind} · {step.status}</li>)}</ul></details>}
  </div>;
}
