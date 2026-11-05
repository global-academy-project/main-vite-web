import { useState } from 'react';
import SafetyPageLayout from '../../components/safety-page-layout';
import { useAgentConversation } from '../../hooks/use-agent-conversation.js';
import { jobRecordPath } from '../../utils/job-forms.js';
import '../../style/records.css';

// ROUTE: /records/search
// FLOW: 기록 조회는 Spring의 기록질문 실행 API를 거쳐 AI 서버와 내부 기록 도구를 호출한다.
export default function RecordSearch() {
  return <SafetyPageLayout title="기록 질문">{(site) => (
    <RecordQueryPanel siteId={site.currentSite?.siteId ?? site.currentSite?.id} siteName={site.currentSite?.name} />
  )}</SafetyPageLayout>;
}

function RecordQueryPanel({ siteId, siteName }) {
  const conversation = useAgentConversation({ siteId, taskType: 'RECORD_QUERY' });
  const [text, setText] = useState('');
  const submit = async (event) => {
    event.preventDefault();
    if (await conversation.send(text)) setText('');
  };

  return <section className="panel records-question" aria-labelledby="record-query-title">
      <h1 id="record-query-title">기록 질문</h1>
      <p className="job-help">{siteName ?? '선택한 현장'}의 안전 기록을 질문하면 조회 결과와 근거를 보여줍니다.</p>
      <div className="records-question__thread" aria-live="polite">
        {conversation.messages.map((item) => <p key={item.messageId} className={`bubble bubble--${item.role === 'USER' ? 'me' : 'ai'}`}>{item.content}</p>)}
        {conversation.pendingText && <p className="bubble bubble--me">{conversation.pendingText}</p>}
        {conversation.processing && <p className="bubble bubble--ai" role="status">기록을 조회하고 있습니다…</p>}
        {conversation.run?.status === 'WAITING_INPUT' && conversation.run.result?.ask?.message && <p className="bubble bubble--ai">{conversation.run.result.ask.message}</p>}
        {conversation.run?.status === 'DONE' && <RecordAnswer result={conversation.run.result} />}
        {conversation.run?.status === 'FAILED' && <p className="dashboard-error" role="alert">AI 처리에 실패했습니다. {conversation.run.errorMessage}</p>}
        {conversation.error && conversation.run?.status !== 'FAILED' && <p className="dashboard-error" role="alert">{conversation.error}</p>}
      </div>
      <form className="records-question__form" onSubmit={submit}>
        <label htmlFor="record-query-input">질문</label>
        <textarea id="record-query-input" value={text} maxLength={2000} disabled={conversation.locked} onChange={(event) => setText(event.target.value)} placeholder="예: 지난달 TBM을 하지 않은 작업은?" />
        <button className="primary-button" type="submit" disabled={conversation.locked || !text.trim()}>조회하기</button>
      </form>
      {!siteId && <p className="dashboard-error" role="status">기록을 조회하려면 먼저 현장을 선택하세요.</p>}
    </section>
}

function RecordAnswer({ result }) {
  return <article className="bubble bubble--ai record-answer">
    <p style={{ whiteSpace: 'pre-wrap' }}>{result?.answer || '조회 결과가 없습니다.'}</p>
    {result?.evidence?.length > 0 && <ul className="record-answer__evidence">
      {result.evidence.map((item, index) => {
        const path = jobRecordPath(item.type, item.id);
        const label = item.label || `${item.type} #${item.id}`;
        return <li key={`${item.type}-${item.id}-${index}`}>{path ? <a href={path}>{label}</a> : label}</li>;
      })}
    </ul>}
    {result?.queries?.length > 0 && <p className="job-help">조회 {result.queries.map((query) => `${query.queryType} ${query.total ?? 0}건`).join(' · ')}</p>}
  </article>;
}
