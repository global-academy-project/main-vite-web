import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import SafetyPageLayout from '../../components/safety-page-layout';
import PageHeader from '../../components/ui/page-header.jsx';
import { Composer, Thread } from '../../components/home/assistant-panel.jsx';
import { Badge } from '../../components/home/panel.jsx';
import Icon from '../../components/ui/icon.jsx';
import Sheet from '../../components/ui/sheet.jsx';
import StatusView, { Skeleton } from '../../components/ui/status-view.jsx';
import { useConversationList } from '../../hooks/use-conversation-list.js';
import { useBreakpoint } from '../../hooks/use-breakpoint.js';
import { dayBucket, relativeTime } from '../../utils/notification-model.js';
import { useAgentConversation } from '../../hooks/use-agent-conversation.js';
import { getAgentMessages, getAgentRun } from '../../api/agents';
import { jobRecordPath } from '../../utils/job-forms.js';
import { conversationTitle, groupConversations, RECORD_TYPE_LABELS, RUN_STATUS_LABELS, groupEvidence } from '../../utils/record-query-model.js';
import '../../styles/home.css';
import '../../styles/work.css';
import '../../styles/records.css';

const SUGGESTIONS = ['이번 주 승인 대기 중인 허가서 알려 줘', '지난달 TBM을 안 한 작업은?', '최근 판정에서 차단된 허가서 보여 줘', '이번 달 아차사고 중 중상 이상은?'];

// ROUTE: /records/search
// FLOW: 기록 조회는 Spring 의 기록 질문 실행 API(RECORD_QUERY)를 거쳐 AI 서버와 내부 기록 도구를 호출한다. 조회만 하고 기록을 바꾸지 않는다.
export default function RecordSearch() {
  return <SafetyPageLayout title="기록 검색">{(site) => <RecordQuery site={site} />}</SafetyPageLayout>;
}

/**
 * 기록 검색 = 기록 질문 대화. 왼쪽 대화(홈 AI 도우미의 대화·입력 부품을 그대로), 오른쪽 마지막 답의 근거 기록과 조회 조건.
 * 현장이 바뀌면 새 대화가 된다(대화 훅이 siteId 로 나뉜다).
 */
function RecordQuery({ site }) {
  const siteId = site.currentSite?.siteId ?? site.currentSite?.id;
  const siteName = site.currentSite?.name;
  const conversation = useAgentConversation({ siteId, taskType: 'RECORD_QUERY' });
  const [historyTab, setHistoryTab] = useState('RECORD_QUERY');
  const [viewing, setViewing] = useState(null);
  // 지금 왼쪽에 다시 연 지난 대화 (새로 시작한 대화면 null)
  const [opened, setOpened] = useState(null);
  const history = useConversationList({ siteId, taskType: 'RECORD_QUERY' });
  // 작업 등록 대화 목록은 그 탭을 처음 열 때 받는다
  const [workTabSeen, setWorkTabSeen] = useState(false);
  const workHistory = useConversationList({ siteId: workTabSeen ? siteId : null, taskType: 'WORK_REGISTER' });
  const shown = historyTab === 'RECORD_QUERY' ? history : workHistory;
  const breakpoint = useBreakpoint();
  const [historyOpen, setHistoryOpen] = useState(false);
  const result = conversation.run?.status === 'DONE' ? conversation.run.result : null;
  const groups = groupEvidence(result?.evidence);

  // 답이 끝날 때마다 지난 대화 목록을 다시 받는다 (새 대화가 목록 맨 위에 생긴다)
  const finishedRun = conversation.run && conversation.run.status !== 'PROCESSING' ? conversation.run.runId : null;
  const { reload } = history;
  useEffect(() => { if (finishedRun) reload(); }, [finishedRun, reload]);

  const openConversation = async (item) => {
    if (historyTab === 'WORK_REGISTER') { setViewing(item); return; }
    if (await conversation.resume({ conversationId: item.conversationId, lastRunId: item.lastRunId })) { setOpened(item); setHistoryOpen(false); }
  };
  const startNew = () => { conversation.reset(); setOpened(null); };
  const resumedNow = opened && opened.conversationId === conversation.conversationId ? opened : null;
  const historyList = (
    <>
      <div className="home-seg rec-history__tabs" role="tablist" aria-label="대화 종류">
        {[['RECORD_QUERY', '기록 질문'], ['WORK_REGISTER', '작업 등록']].map(([key, label]) => (
          <button key={key} type="button" role="tab" aria-selected={historyTab === key} className={`home-seg__btn${historyTab === key ? ' is-active' : ''}`}
            onClick={() => { setHistoryTab(key); if (key === 'WORK_REGISTER') setWorkTabSeen(true); }}>{label}</button>
        ))}
      </div>
      {historyTab === 'WORK_REGISTER' && <p className="rec-history__note">작업 등록 대화는 읽기만 합니다. 이어서 등록하려면 홈 AI 도우미의 작업 등록 탭을 쓰세요.</p>}
      <ConversationList history={shown} activeId={historyTab === 'RECORD_QUERY' ? conversation.conversationId : viewing?.conversationId}
        disabled={historyTab === 'RECORD_QUERY' && (conversation.processing || conversation.resuming)} onOpen={openConversation}
        empty={historyTab === 'RECORD_QUERY' ? '아직 지난 기록 질문이 없습니다. 질문하면 여기에 남아 나중에 다시 열 수 있습니다.' : '아직 작업 등록 대화가 없습니다. 홈 AI 도우미에서 작업을 등록하면 여기에 남습니다.'} />
    </>
  );

  return (
    <div className="work-list rec-page">
      <PageHeader title="기록 검색" description="안전 기록을 말로 물어보면 조회 결과와 근거 기록을 보여 줍니다. 기록을 바꾸지 않습니다." context={site}
        actions={<>
          {breakpoint !== 'desktop' && <button type="button" className="ui-btn ui-btn--ghost" onClick={() => setHistoryOpen(true)}><Icon name="records" size={16} />지난 대화</button>}
          <button type="button" className="ui-btn ui-btn--ghost" disabled={conversation.processing || conversation.resuming || !conversation.messages.length} onClick={startNew}>새 대화</button>
        </>} />

      {!siteId ? <StatusView kind="empty" title="기록을 조회하려면 먼저 현장을 선택하세요" /> : (
        <div className="rec-query">
          <section className="home-panel home-assistant rec-query__chat" aria-labelledby="rec-query-title">
            <header className="home-panel__head">
              <h2 id="rec-query-title" className="home-panel__title">
                기록 질문
                {resumedNow ? <Badge tone="info">지난 대화</Badge> : conversation.messages.length > 0 ? <Badge tone="done">새 대화</Badge> : null}
              </h2>
              {conversation.processing && <span className="home-assistant__busy" aria-label="처리 중" />}
            </header>
            {resumedNow && (
              <div className="rec-chat-ctx" role="note">
                <Icon name="clock" size={16} />
                <span className="rec-chat-ctx__text">
                  <strong>{conversationTitle(resumedNow)}</strong>
                  <span>지난 대화 · 마지막 {relativeTime(resumedNow.lastMessageAt)} · 메시지 {resumedNow.messageCount}개 — 여기서 질문하면 이 대화에 이어집니다.</span>
                </span>
                <button type="button" className="ui-btn ui-btn--ghost" disabled={conversation.processing} onClick={startNew}>새 대화로</button>
              </div>
            )}
            <Thread id="rec-query-thread" conversation={conversation} records siteId={siteId} hint="기록 질문은 조회만 하고 기록을 바꾸지 않습니다." suggestions={SUGGESTIONS} siteName={siteName} />
            <Composer conversation={conversation} placeholder="예: 지난달 TBM을 하지 않은 작업은?" siteName={siteName} />
          </section>

          <aside className="rec-query__side" aria-label="근거 기록">
            <section className="home-panel" aria-labelledby="rec-evidence-title">
              <header className="home-panel__head">
                <h2 id="rec-evidence-title" className="home-panel__title">근거 기록{result && <span className="home-panel__count">{result.evidence?.length ?? 0}</span>}</h2>
              </header>
              <div className="home-panel__body">
                {!result ? <p className="rec-pad rec-help">답을 받으면 그 답의 근거가 된 기록이 여기에 모입니다. 누르면 그 기록 화면으로 갑니다.</p>
                  : !groups.length ? <StatusView kind="empty" compact title="근거로 연결된 기록이 없습니다" />
                    : groups.map((group) => (
                      <div key={group.type} className="rec-evi">
                        <h3 className="rec-evi__title">{group.label}<span className="home-panel__count">{group.items.length}</span></h3>
                        <ul className="rec-evi__list">
                          {group.items.map((item, index) => {
                            const path = jobRecordPath(item.type, item.id);
                            const label = item.label || `${RECORD_TYPE_LABELS[item.type] ?? item.type} #${item.id}`;
                            return (
                              <li key={`${item.type}-${item.id}-${index}`}>
                                {path
                                  ? <Link className="rec-evi__item" to={path}><span>{label}</span><Icon name="send" size={14} /></Link>
                                  : <span className="rec-evi__item is-plain"><span>{label}</span><span className="rec-evi__note">이 화면에서 열 수 없는 기록</span></span>}
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    ))}
              </div>
            </section>
            {breakpoint === 'desktop' && (
              <section className="home-panel" aria-labelledby="rec-history-title">
                <header className="home-panel__head"><h2 id="rec-history-title" className="home-panel__title">지난 대화{shown.items.length > 0 && <span className="home-panel__count">{shown.items.length}</span>}</h2></header>
                <div className="home-panel__body rec-history__body">{historyList}</div>
              </section>
            )}
            {result?.queries?.length > 0 && (
              <section className="home-panel" aria-labelledby="rec-queries-title">
                <header className="home-panel__head"><h2 id="rec-queries-title" className="home-panel__title">조회한 범위</h2></header>
                <ul className="rec-queries">
                  {result.queries.map((query, index) => (
                    <li key={`${query.queryType}-${index}`}><Badge tone="info">{RECORD_TYPE_LABELS[query.queryType] ?? query.queryType}</Badge><span>{query.total ?? 0}건</span></li>
                  ))}
                </ul>
              </section>
            )}
          </aside>
        </div>
      )}
      <Sheet open={Boolean(viewing)} onClose={() => setViewing(null)} wide title={viewing ? conversationTitle(viewing) : '작업 등록 대화'} subtitle="작업 등록 대화 · 읽기 전용">
        {viewing && <WorkConversation key={viewing.conversationId} item={viewing} siteId={siteId} />}
      </Sheet>
      <Sheet open={historyOpen && breakpoint !== 'desktop' && !viewing} onClose={() => setHistoryOpen(false)} title="지난 대화" subtitle={siteName}>
        {historyList}
      </Sheet>
    </div>
  );
}

/** 내 지난 대화 (최근 순). 누르면 왼쪽 대화창에 다시 열리고 이어서 질문할 수 있다 */
function ConversationList({ history, activeId, disabled, onOpen, empty }) {
  if (history.loading) return <div className="home-panel__pad"><Skeleton lines={4} /></div>;
  if (history.unavailable) return <p className="rec-pad rec-help">{history.error}</p>;
  if (history.error) return <StatusView kind="error" compact message={history.error} onRetry={history.reload} />;
  if (!history.items.length) return <p className="rec-pad rec-help">{empty}</p>;
  return groupConversations(history.items, new Date(), dayBucket).map((group) => (
    <section key={group.label} className="rec-history__group" aria-label={group.label}>
      <h3 className="rec-history__day">{group.label}</h3>
      <ul className="rec-history">
      {group.items.map((item) => {
        const active = item.conversationId === activeId;
        return (
          <li key={item.conversationId}>
            <button type="button" className={`rec-history__item${active ? ' is-active' : ''}`} aria-current={active || undefined} disabled={disabled} onClick={() => onOpen(item)}>
              <span className="rec-history__title">{active && <span className="rec-history__now">지금 열림</span>}{conversationTitle(item)}</span>
              <span className="rec-history__meta">
                {relativeTime(item.lastMessageAt)}
                {item.messageCount != null && ` · 메시지 ${item.messageCount}`}
                {RUN_STATUS_LABELS[item.lastRunStatus] && <span className={`rec-history__state is-${item.lastRunStatus.toLowerCase()}`}>{RUN_STATUS_LABELS[item.lastRunStatus]}</span>}
              </span>
            </button>
          </li>
        );
      })}
      </ul>
    </section>
  ));
}

/** 작업 등록 대화 읽기: 메시지 기록 + 그 대화로 만든 작업(마지막 실행 결과) */
function WorkConversation({ item, siteId }) {
  const [state, setState] = useState({ status: 'loading', messages: [], run: null, error: '' });
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const messages = await getAgentMessages(item.conversationId);
        let run = null;
        if (item.lastRunId) {
          try { run = await getAgentRun(item.lastRunId, { conversationId: item.conversationId, siteId, taskType: 'WORK_REGISTER' }); } catch { run = null; }
        }
        if (active) setState({ status: 'ready', messages, run, error: '' });
      } catch (requestError) {
        if (active) setState({ status: 'error', messages: [], run: null, error: requestError.message || '대화를 불러오지 못했습니다.' });
      }
    })();
    return () => { active = false; };
  }, [item.conversationId, item.lastRunId, siteId]);

  if (state.status === 'loading') return <Skeleton lines={6} />;
  if (state.status === 'error') return <StatusView kind="error" compact message={state.error} />;
  const workId = state.run?.result?.saved?.workId ?? state.run?.workId ?? null;
  const first = state.messages[0]?.createdAt;
  return (
    <div className="rec-transcript">
      <dl className="rec-facts">
        <div><dt>대화 종류</dt><dd>작업 등록 대화</dd></div>
        <div><dt>시작</dt><dd>{first ? relativeTime(first) : '-'}</dd></div>
        <div><dt>마지막 메시지</dt><dd>{relativeTime(item.lastMessageAt) || '-'}</dd></div>
        <div><dt>메시지</dt><dd>{item.messageCount ?? state.messages.length}개</dd></div>
      </dl>
      {workId && (
        <div className="rec-transcript__work">
          <span><Icon name="work" size={16} />이 대화로 만든 작업 <strong>#{workId}</strong></span>
          <Link className="ui-btn ui-btn--primary" to={`/job/workspace?workId=${workId}`}>작업 허브 열기</Link>
        </div>
      )}
      {!state.messages.length && <p className="rec-help">메시지가 없습니다.</p>}
      <div className="home-thread rec-transcript__thread">
        {state.messages.map((message) => (
          <div key={message.messageId} className={`rec-msg rec-msg--${message.role === 'USER' ? 'me' : 'ai'}`}>
            <p className={`bubble bubble--${message.role === 'USER' ? 'me' : 'ai'}`}>{message.content}</p>
            {message.createdAt && <time className="rec-msg__time" dateTime={message.createdAt}>{message.role === 'USER' ? '나' : 'AI'} · {relativeTime(message.createdAt)}</time>}
          </div>
        ))}
      </div>
    </div>
  );
}
