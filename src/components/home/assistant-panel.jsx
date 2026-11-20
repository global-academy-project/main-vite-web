import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAgentConversation } from '../../hooks/use-agent-conversation.js';
import { jobRecordPath } from '../../utils/job-forms.js';
import { RECORD_TYPE_LABELS } from '../../utils/record-query-model.js';
import Icon from '../ui/icon.jsx';
import DraftCard from './draft-card.jsx';
import AuditRouteCard from './audit-route-card.jsx';
import { FoldButton } from './panel.jsx';
import { confirmAction } from '../ui/confirm-store.js';
import { useVoiceInput } from '../../hooks/use-voice-input.js';
import { appendText, clock } from '../../utils/voice-model.js';
import { auditRouteReportId } from '../../utils/audit-route-model.js';

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
export default function AssistantPanel({ siteId, siteName, zones, onDraftSaved, onDraftChanged, grip, onFold, collapse }) {
  const open = !collapse || collapse.open;
  const [tab, setTab] = useState('WORK_REGISTER');
  const work = useAgentConversation({ siteId, taskType: 'WORK_REGISTER' });
  const record = useAgentConversation({ siteId, taskType: 'RECORD_QUERY' });
  const conversation = tab === 'WORK_REGISTER' ? work : record;
  const meta = TABS.find((item) => item.key === tab);
  // 작업 등록 초안이 저장되면 오른쪽 오늘 작업 목록을 다시 부른다
  const savedWorkId = work.run?.status === 'DONE' ? work.run.result?.saved?.workId : null;
  useEffect(() => { if (savedWorkId) onDraftSaved?.(savedWorkId); }, [savedWorkId, onDraftSaved]);

  return (
    <section className={`home-panel home-assistant${open ? '' : ' is-collapsed'}`} aria-labelledby="home-ai-title">
      <header className="home-panel__head home-assistant__head">
        {grip}
        {/* 11/16: "AI 도우미" 제목 자리에 대화 종류 탭을 둔다 (세로 공간 확보). 제목은 화면 읽기용으로만 */}
        <h2 id="home-ai-title" className="sr-only">AI 도우미</h2>
        <div className="home-assistant__tabs" role="tablist" aria-label="대화 종류">
          {TABS.map((item) => (
            <button key={item.key} type="button" role="tab" id={`ai-tab-${item.key}`} aria-controls="ai-thread" aria-selected={tab === item.key} className={`home-assistant__tab${tab === item.key ? ' is-active' : ''}`} onClick={() => { setTab(item.key); if (collapse && !collapse.open) collapse.toggle(); }}>
              {item.label}
              {(item.key === 'WORK_REGISTER' ? work : record).processing && <span className="home-assistant__busy" aria-label="처리 중" />}
            </button>
          ))}
        </div>
        <div className="home-panel__actions">
          <Link className="home-panel__link" to="/job/workspace">단계별로 만들기</Link>
          <button type="button" className="ui-btn ui-btn--ghost home-assistant__new" onClick={conversation.reset} disabled={conversation.processing}>새 대화</button>
        </div>
        {/* 접기 버튼: 머리 바깥쪽 끝. 접힌 막대의 펼치기 버튼과 같은 자리·같은 아이콘 (메뉴 접기와 같은 방식) */}
        {collapse && <FoldButton open={open} label="AI 도우미" controls="home-ai-body" onToggle={collapse.toggle} />}
        {onFold && <button type="button" className="ui-icon-btn home-assistant__fold" aria-label="AI 도우미 접기" title="AI 도우미 접기" onClick={onFold}><Icon name="panelRight" size={18} /></button>}
      </header>
      {/* 모바일에서 접어도 대화·진행 중 처리는 그대로 (숨기기만) */}
      <div id="home-ai-body" className="home-assistant__body" hidden={!open}>
      <Thread id="ai-thread" conversation={conversation} records={tab === 'RECORD_QUERY'} siteId={siteId} zones={zones} hint={meta.hint} suggestions={meta.suggestions} siteName={siteName} onDraftChanged={onDraftChanged} />
      <Composer key={tab} conversation={conversation} placeholder={meta.placeholder} siteName={siteName} voice />
      </div>
    </section>
  );
}

export function Thread({ id, conversation, records, siteId, zones, hint, suggestions, siteName, onDraftChanged }) {
  const end = useRef(null);
  const { messages, pendingText, processing, run, error, uncertain } = conversation;
  // 작업 등록 대화의 감사 분기: 서버가 감사 대응 보고서를 만들었거나 연결했을 때만 카드 (거절이면 답변 메시지만)
  const auditReportId = records ? null : auditRouteReportId(run);
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
      {auditReportId && <AuditRouteCard key={run.runId} siteId={siteId} reportId={auditReportId} />}
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
          <button type="button" className="ui-btn ui-btn--ghost" onClick={async () => { if (await confirmAction({ title: '중복 실행이 될 수 있습니다', message: '서버에 실행이 생성됐는지 확인했습니까? 다시 보내면 중복 실행이 될 수 있습니다.', confirmLabel: '잠금 해제', tone: 'warn' })) conversation.unlock(); }}>확인 후 잠금 해제</button>
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
      {result.queries?.length > 0 && <p className="draft-muted">조회 {result.queries.map((query) => `${RECORD_TYPE_LABELS[query.queryType] ?? query.queryType} ${query.total ?? ''}건`).join(' · ')}</p>}
    </article>
  );
}

/** voice: 말로 입력 버튼(서버 음성 입력이 켜져 있고 브라우저가 녹음할 수 있을 때만 보인다). 받아 적은 글은 입력칸 뒤에 붙고 바로 보내지 않는다 */
export function Composer({ conversation, placeholder, siteName, voice: withVoice = false }) {
  const [text, setText] = useState('');
  const [voiceError, setVoiceError] = useState('');
  const areaRef = useRef(null);
  const voice = useVoiceInput({
    onText: (spoken) => { setVoiceError(''); setText((current) => appendText(current, spoken, 2000)); areaRef.current?.focus(); },
    onError: setVoiceError,
  });
  const recording = voice.state === 'recording';
  const showMic = withVoice && voice.available;
  const length = text.trim().length;
  const tooLong = length > 2000;
    // 입력칸 높이: 위쪽 손잡이를 위로 끌면 커진다 (키보드 ↑↓, 두 번 누르면 원래대로)
  const [height, setHeight] = useState(null);
  const clamp = (value) => Math.max(48, Math.min(Math.min(window.innerHeight * 0.5, 360), value));
  const startDrag = (event) => {
    const area = areaRef.current;
    if (!area) return;
    event.preventDefault();
    const startY = event.clientY;
    const startHeight = area.offsetHeight;
    const move = (moveEvent) => setHeight(clamp(startHeight + (startY - moveEvent.clientY)));
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };
  const nudge = (event) => {
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
    event.preventDefault();
    setHeight(clamp((areaRef.current?.offsetHeight ?? 48) + (event.key === 'ArrowUp' ? 24 : -24)));
  };
  const submit = async (event) => {
    event.preventDefault();
      if (await conversation.send(text)) { setText(''); setHeight(null); }
  };
  return (
    <form className="home-composer" onSubmit={submit}>
      <label htmlFor="home-composer" className="sr-only">메시지</label>
      <button type="button" className="home-composer__grip" aria-label="입력칸 높이 조절 (위·아래 화살표, 두 번 누르면 원래대로)"
        onPointerDown={startDrag} onKeyDown={nudge} onDoubleClick={() => setHeight(null)} />
      <textarea
        ref={areaRef} style={height ? { height } : undefined}
        id="home-composer" rows={1} value={text} placeholder={placeholder} maxLength={2100} disabled={conversation.locked}
        aria-describedby="home-composer-help" aria-invalid={tooLong || undefined}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); event.currentTarget.form.requestSubmit(); } }}
      />
      {showMic && (
        <button type="button" className={`ui-icon-btn home-composer__mic${recording ? ' is-recording' : ''}`}
          disabled={conversation.locked || voice.state === 'sending'} aria-pressed={recording}
          aria-label={recording ? '녹음 멈추기' : voice.state === 'sending' ? '받아 적는 중' : '말로 입력'} title={recording ? '녹음 멈추기' : '말로 입력'}
          onClick={() => { setVoiceError(''); if (recording) voice.stop(); else void voice.start(); }}>
          <Icon name={recording ? 'stop' : voice.state === 'sending' ? 'spinner' : 'mic'} size={18} />
        </button>
      )}
      <button type="submit" className="ui-btn ui-btn--primary home-composer__send" disabled={conversation.locked || !length || tooLong} aria-label="보내기">
        <Icon name="send" size={18} /><span className="home-composer__send-text">보내기</span>
      </button>
      <span id="home-composer-help" className={`home-composer__help${tooLong || voiceError ? ' is-error' : ''}`} role={voiceError ? 'alert' : undefined}>
        {voiceError || (recording ? `녹음 중 ${clock(voice.elapsed)} / ${clock(voice.maxSeconds)} · 다 말하면 ■ 를 누르세요` : voice.state === 'sending' ? '받아 적는 중…'
          : tooLong ? `2000자까지 보낼 수 있습니다 (${length}자)` : `1~2000자 · ${siteName ?? '선택한 현장'} 기준 · Enter 보내기, Shift+Enter 줄바꿈`)}
      </span>
    </form>
  );
}
