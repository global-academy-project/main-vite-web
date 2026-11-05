import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAgentConversation } from '../../hooks/use-agent-conversation.js';
import { jobRecordPath } from '../../utils/job-forms.js';
import Icon from '../ui/icon.jsx';
import DraftCard from './draft-card.jsx';

const TABS = [
  { key: 'WORK_REGISTER', label: '작업 등록', placeholder: '예: 오늘 오후 2시 3번 탱크 내부 청소, 4명', hint: '작업 장소·종류·시간·인원을 말하듯이 적어 주세요.',
    suggestions: ['오늘 오후 2시부터 3번 탱크 내부 청소, 4명', '내일 오전 B동 2층 배관 용접, 2명', '본관 지붕 방수 보수 고소작업 3명'] },
  { key: 'RECORD_QUERY', label: '기록 질문', placeholder: '예: 지난달 측정값이 빠진 화기 허가서 알려 줘', hint: '기록 질문은 조회만 하고 기록을 바꾸지 않습니다.',
    suggestions: ['이번 주 승인 대기 중인 허가서 알려 줘', '지난달 TBM을 안 한 작업은?', '최근 판정에서 차단된 허가서 보여 줘'] },
];

/**
 * 홈 AI 도우미. 탭마다 대화를 따로 가진다(서버는 대화 종류를 섞으면 409).
 * 두 대화 훅을 모두 살려 둬서 탭을 오가도 대화가 남는다. 현장이 바뀌면 둘 다 새 대화.
 */
export default function AssistantPanel({ siteId, siteName, zones, onDraftSaved, onDraftChanged }) {
  const [tab, setTab] = useState('WORK_REGISTER');
  const work = useAgentConversation({ siteId, taskType: 'WORK_REGISTER' });
  const record = useAgentConversation({ siteId, taskType: 'RECORD_QUERY' });
  const conversation = tab === 'WORK_REGISTER' ? work : record;
  const meta = TABS.find((item) => item.key === tab);

  // 작업 등록 초안이 저장되면 오른쪽 오늘 작업 목록을 다시 부른다
  const savedWorkId = work.run?.status === 'DONE' ? work.run.result?.saved?.workId : null;
  useEffect(() => { if (savedWorkId) onDraftSaved?.(savedWorkId); }, [savedWorkId, onDraftSaved]);

  return (
    <section className="home-panel home-assistant" aria-labelledby="home-ai-title">
      <header className="home-panel__head home-assistant__head">
        <h2 id="home-ai-title" className="sr-only">AI 도우미</h2>
        <div className="home-assistant__tabs" role="tablist" aria-label="대화 종류">
          {TABS.map((item) => (
            <button key={item.key} type="button" role="tab" id={`ai-tab-${item.key}`} aria-controls="ai-thread" aria-selected={tab === item.key} className={`home-assistant__tab${tab === item.key ? ' is-active' : ''}`} onClick={() => setTab(item.key)}>
              {item.label}
              {(item.key === 'WORK_REGISTER' ? work : record).processing && <span className="home-assistant__busy" aria-label="처리 중" />}
            </button>
          ))}
        </div>
        <div className="home-panel__actions">
          <Link className="home-panel__link" to="/job/workspace">단계별로 만들기</Link>
          <button type="button" className="ui-btn ui-btn--ghost home-assistant__new" onClick={conversation.reset} disabled={conversation.processing}>새 대화</button>
        </div>
      </header>
      <Thread id="ai-thread" conversation={conversation} records={tab === 'RECORD_QUERY'} siteId={siteId} zones={zones} hint={meta.hint} suggestions={meta.suggestions} siteName={siteName} onDraftChanged={onDraftChanged} />
      <Composer key={tab} conversation={conversation} placeholder={meta.placeholder} siteName={siteName} />
    </section>
  );
}

function Thread({ id, conversation, records, siteId, zones, hint, suggestions, siteName, onDraftChanged }) {
  const end = useRef(null);
  const { messages, pendingText, processing, run, error, uncertain } = conversation;
  useEffect(() => { end.current?.scrollIntoView?.({ block: 'end' }); }, [messages.length, pendingText, processing, run?.status]);

  return (
    <div id={id} className="home-thread" role="tabpanel" aria-live="polite">
      {!messages.length && !pendingText && (
        <div className="home-thread__intro">
          <Icon name="info" size={18} />
          <div>
            <p><strong>{siteName ?? '현장'}</strong> 기준으로 처리합니다. {hint}</p>
            <div className="home-suggest" aria-label="이런 말로 시작해 보세요">
              {suggestions.map((text) => <button key={text} type="button" className="home-suggest__chip" disabled={conversation.locked} onClick={() => conversation.send(text)}>{text}</button>)}
            </div>
          </div>
        </div>
      )}
      {messages.map((item) => (
        <p key={item.messageId} className={`bubble bubble--${item.role === 'USER' ? 'me' : 'ai'}`}>{item.content}</p>
      ))}
      {pendingText && !messages.some((item) => item.role === 'USER' && item.content === pendingText) && <p className="bubble bubble--me">{pendingText}</p>}
      {processing && <p className="bubble bubble--ai bubble--typing" role="status"><span /><span /><span /><span className="sr-only">AI가 처리하고 있습니다</span></p>}
      {run?.status === 'WAITING_INPUT' && run.result?.ask?.message && !messages.some((item) => item.content === run.result.ask.message) && <p className="bubble bubble--ai">{run.result.ask.message}</p>}
      {!records && run?.status === 'DONE' && run.result?.saved && <DraftCard key={run.runId} result={run.result} siteId={siteId} zones={zones} onChanged={onDraftChanged} />}
      {records && run?.status === 'DONE' && <RecordAnswer result={run.result} />}
      {run?.status === 'FAILED' && <p className="bubble bubble--error" role="alert"><Icon name="alert" size={14} />AI 처리에 실패했습니다. {run.errorMessage}</p>}
      {error && run?.status !== 'FAILED' && (
        <div className="bubble bubble--error" role="alert">
          <Icon name="alert" size={14} />{error}
          {conversation.execution && !processing && <button type="button" className="ui-btn ui-btn--ghost" onClick={conversation.retry}>다시 조회</button>}
        </div>
      )}
      {uncertain && (
        <div className="bubble bubble--error" role="alert">
          전송 결과를 확인하지 못해 추가 전송을 멈췄습니다. 서버에 실행이 생겼을 수 있습니다.
          <button type="button" className="ui-btn ui-btn--ghost" onClick={() => { if (window.confirm('서버에 실행이 생성됐는지 확인했습니까? 다시 보내면 중복 실행이 될 수 있습니다.')) conversation.unlock(); }}>확인 후 잠금 해제</button>
        </div>
      )}
      <span ref={end} />
    </div>
  );
}

function RecordAnswer({ result }) {
  return (
    <article className="bubble bubble--ai record-answer">
      <p style={{ whiteSpace: 'pre-wrap' }}>{result.answer}</p>
      {result.evidence?.length > 0 && (
        <ul className="record-answer__evidence">
          {result.evidence.map((item, index) => {
            const path = jobRecordPath(item.type, item.id);
            const label = item.label || `${item.type} #${item.id}`;
            return <li key={`${item.type}-${item.id}-${index}`}>{path ? <Link to={path}>{label}</Link> : label}</li>;
          })}
        </ul>
      )}
      {result.queries?.length > 0 && <p className="draft-muted">조회 {result.queries.map((query) => `${query.queryType} ${query.total ?? ''}건`).join(' · ')}</p>}
    </article>
  );
}

function Composer({ conversation, placeholder, siteName }) {
  const [text, setText] = useState('');
  const length = text.trim().length;
  const tooLong = length > 2000;
  const submit = async (event) => {
    event.preventDefault();
    if (await conversation.send(text)) setText('');
  };
  return (
    <form className="home-composer" onSubmit={submit}>
      <label htmlFor="home-composer" className="sr-only">메시지</label>
      <textarea
        id="home-composer" rows={1} value={text} placeholder={placeholder} maxLength={2100} disabled={conversation.locked}
        aria-describedby="home-composer-help" aria-invalid={tooLong || undefined}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); event.currentTarget.form.requestSubmit(); } }}
      />
      <button type="submit" className="ui-btn ui-btn--primary home-composer__send" disabled={conversation.locked || !length || tooLong} aria-label="보내기">
        <Icon name="send" size={18} /><span className="home-composer__send-text">보내기</span>
      </button>
      <span id="home-composer-help" className={`home-composer__help${tooLong ? ' is-error' : ''}`}>{tooLong ? `2000자까지 보낼 수 있습니다 (${length}자)` : `1~2000자 · ${siteName ?? '선택한 현장'} 기준 · Enter 보내기, Shift+Enter 줄바꿈`}</span>
    </form>
  );
}
