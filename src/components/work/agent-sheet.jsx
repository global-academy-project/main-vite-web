import { useState } from 'react';
import { Link } from 'react-router-dom';
import { getPermit, jobId } from '../../api/jobs';
import { jobRecordPath } from '../../utils/job-forms.js';
import { PERMIT_STATUS_LABELS } from '../../utils/home-model.js';
import { RECORD_TYPE_LABELS } from '../../utils/record-query-model.js';
import { Composer, Thread } from '../home/assistant-panel.jsx';
import { Badge } from '../home/panel.jsx';
import Icon from '../ui/icon.jsx';

const TABS = [
  { key: 'WORK_REGISTER', label: '작업 등록', placeholder: '작업 장소·종류·시간·인원과 실제 측정값을 알려 주세요.', hint: '완료되면 서버가 작업·서류 초안을 "작성 중"으로 저장합니다. 승인이나 작업 허가가 아닙니다.',
    suggestions: ['오늘 오후 2시부터 3번 탱크 내부 청소, 4명', '내일 오전 B동 2층 배관 용접, 2명'] },
  { key: 'RECORD_QUERY', label: '기록 질문', placeholder: '예: 지난달 화기작업 중 측정값이 빠진 허가서 알려 줘', hint: '기록 질문은 조회만 하고 기록을 바꾸지 않습니다. 작업 등록과 따로 저장됩니다.',
    suggestions: ['이번 주 승인 대기 중인 허가서 알려 줘', '지난달 TBM을 안 한 작업은?'] },
];
const EDITABLE_PERMIT = ['DRAFT', 'CHECKING', 'BLOCKED'];
const RUN_LABELS = { PROCESSING: '처리 중', WAITING_INPUT: '추가 정보 필요', DONE: '완료', FAILED: '실패' };

/**
 * 작업 목록의 "AI 대화" 시트. 홈 AI 도우미와 같은 대화 모양(Thread·Composer)에 두 가지를 더했다.
 *  - 작업 등록: 기존 허가서 연결 (같은 현장·수정 가능한 상태인지 GET /permits/{id} 로 먼저 확인)
 *  - 실행 번호로 다시 조회 (자동 조회가 멈췄거나 다른 기기에서 보낸 실행)
 *  - 실행 상세: 작업 분류·AI 승인 요청 검토·규칙 검토·초안 검증·안내·초안 원문·실행 단계·근거
 * 대화 훅(work, record)은 부르는 화면이 들고 있어서 시트를 닫았다 열어도 대화가 남는다.
 */
export default function AgentSheet({ siteId, siteName, work, record, tab, setTab }) {
  const conversation = tab === 'WORK_REGISTER' ? work : record;
  const meta = TABS.find((item) => item.key === tab);
  const records = tab === 'RECORD_QUERY';
  const [permitText, setPermitText] = useState('');
  const [permit, setPermit] = useState({ state: 'none', message: '' }); // none | checking | ok | error
  const [runText, setRunText] = useState('');

  const checkPermit = async () => {
    const value = permitText.trim();
    if (records || !value) return undefined;
    let id;
    try { id = jobId(value); } catch { setPermit({ state: 'error', message: '허가서 번호는 숫자로 입력하세요.' }); return false; }
    setPermit({ state: 'checking', message: '' });
    try {
      const found = await getPermit(id, siteId);
      if (!EDITABLE_PERMIT.includes(found.status)) {
        setPermit({ state: 'error', message: `허가서 #${id}은(는) ${PERMIT_STATUS_LABELS[found.status] ?? found.status} 상태라 AI 판정에 연결할 수 없습니다. 작성 중·판정 중·판정 차단인 허가서만 됩니다.` });
        return false;
      }
      setPermit({ state: 'ok', message: `허가서 ${found.permitNo || `#${id}`} · ${PERMIT_STATUS_LABELS[found.status] ?? found.status} — AI의 규칙 판정이 이 허가서에 저장될 수 있습니다.` });
      return id;
    } catch (error) {
      setPermit({ state: 'error', message: error.message || '허가서를 확인하지 못했습니다.' });
      return false;
    }
  };

  // Composer·추천 문장이 부르는 send 에 허가서 확인을 끼워 넣는다
  const withPermit = {
    ...conversation,
    locked: conversation.locked || permit.state === 'checking',
    send: async (text) => {
      const permitId = await checkPermit();
      if (permitId === false) return false;
      return conversation.send(text, { permitId });
    },
  };

  return (
    <div className="agent-sheet">
      <div className="home-assistant__tabs agent-sheet__tabs" role="tablist" aria-label="대화 종류">
        {TABS.map((item) => {
          const busy = (item.key === 'WORK_REGISTER' ? work : record).processing;
          return (
            <button key={item.key} type="button" role="tab" aria-selected={tab === item.key} aria-controls="agent-thread" className={`home-assistant__tab${tab === item.key ? ' is-active' : ''}`} onClick={() => setTab(item.key)}>
              {item.label}{busy && <span className="home-assistant__busy" aria-label="처리 중" />}
            </button>
          );
        })}
      </div>

      <div className="agent-sheet__tools">
        {!records && (
          <div className="agent-sheet__tool">
            <label className="risk-field">
              <span className="risk-field__label">연결할 허가서 <span className="rec-help">선택</span></span>
              <input inputMode="numeric" value={permitText} placeholder="허가서 번호" disabled={conversation.locked}
                onChange={(event) => { setPermitText(event.target.value.replace(/\D/g, '')); setPermit({ state: 'none', message: '' }); }}
                onBlur={() => { if (permitText) void checkPermit(); }} />
            </label>
            {permit.message && <p className={`agent-sheet__note${permit.state === 'error' ? ' is-error' : ''}`}>{permit.message}</p>}
          </div>
        )}
        <form className="agent-sheet__tool agent-sheet__lookup" onSubmit={async (event) => {
          event.preventDefault();
          if (!/^\d+$/.test(runText)) return;
          if (await conversation.lookup(Number(runText))) setRunText('');
        }}>
          <label className="risk-field">
            <span className="risk-field__label">실행 번호로 다시 조회</span>
            <input inputMode="numeric" value={runText} placeholder="실행 번호" disabled={conversation.processing || conversation.resuming} onChange={(event) => setRunText(event.target.value.replace(/\D/g, ''))} />
          </label>
          <button type="submit" className="ui-btn ui-btn--ghost" disabled={!runText || conversation.processing || conversation.resuming}>조회</button>
        </form>
        <div className="agent-sheet__status">
          {conversation.execution && <span className="rec-help">실행 #{conversation.execution.runId}{conversation.conversationId ? ` · 대화 #${conversation.conversationId}` : ''}</span>}
          {conversation.run && <Badge tone={conversation.run.status === 'FAILED' ? 'block' : conversation.run.status === 'DONE' ? 'done' : 'wait'}>{RUN_LABELS[conversation.run.status]}</Badge>}
          <button type="button" className="ui-btn ui-btn--ghost" disabled={conversation.processing} onClick={() => { conversation.reset(); setPermitText(''); setPermit({ state: 'none', message: '' }); }}>새 대화</button>
        </div>
      </div>

      <Thread id="agent-thread" conversation={withPermit} records={records} siteId={siteId} hint={meta.hint} suggestions={meta.suggestions} siteName={siteName} />
      {conversation.run?.result && <RunDetails run={conversation.run} records={records} />}
      <Composer key={tab} conversation={withPermit} placeholder={meta.placeholder} siteName={siteName} />
    </div>
  );
}

function RunDetails({ run, records }) {
  const result = run.result;
  const steps = run.steps?.length ? run.steps : result.steps ?? [];
  const citations = run.citations?.length ? run.citations : result.citations ?? [];
  return (
    <details className="agent-details">
      <summary>실행 상세 <span className="rec-help">분류·규칙 검토·근거·실행 단계</span></summary>
      <div className="agent-details__body">
        {result.saved?.workDateAssumed && <p className="rec-note rec-note--block"><Icon name="alert" size={16} />작업 날짜가 없어 서버의 오늘 날짜로 저장했습니다. 작업일을 확인하세요.</p>}
        {result.saved?.notes?.map((note, index) => <p key={index} className="rec-help">{note}</p>)}

        {!records && result.classification && (
          <section><h3>작업 분류</h3>
            <dl className="rec-facts">
              <div><dt>작업 유형</dt><dd>{result.classification.workTypes?.join(', ') || '미분류'}</dd></div>
              <div><dt>필요 허가</dt><dd>{result.classification.requiredPermits?.join(', ') || '없음'}</dd></div>
              <div><dt>고위험</dt><dd>{result.classification.highRisk == null ? '미확인' : result.classification.highRisk ? '고위험' : '일반'}</dd></div>
            </dl>
          </section>
        )}
        {!records && result.approvalGate && (
          <section><h3>AI 승인 요청 검토 <Badge tone={result.approvalGate.canRequest ? 'done' : 'warn'}>{result.approvalGate.canRequest ? '요건 충족' : '요건 미충족'}</Badge></h3>
            {result.approvalGate.reasons?.length > 0 && <ul>{result.approvalGate.reasons.map((reason, index) => <li key={index}>{reason}</li>)}</ul>}
            <p className="rec-help">승인이나 작업 시작 허가가 아닙니다. 실제 허가서는 작업허가 화면에서 서버 판정 후 승인 요청합니다.</p>
          </section>
        )}
        {!records && result.ruleCheck && (
          <section><h3>규칙 검토 <Badge tone={result.ruleCheck.blocked ? 'block' : 'done'}>{result.ruleCheck.blocked ? '차단 사유 있음' : '차단 사유 없음'}</Badge></h3>
            <ul className="agent-details__rules">{result.ruleCheck.evaluations?.map((item, index) => (
              <li key={index}><strong>{item.title}</strong> <span className="rec-help">{item.status}</span><p>{item.message}</p>{item.basis && <p className="rec-help">근거: {item.basis}</p>}</li>
            ))}</ul>
            {result.ruleCheck.notes?.map((note, index) => <p key={`n${index}`} className="rec-help">{note}</p>)}
            {result.ruleCheck.conflicts?.map((note, index) => <p key={`c${index}`} className="agent-sheet__note is-error">충돌: {note}</p>)}
          </section>
        )}
        {!records && result.verification?.length > 0 && (
          <section><h3>초안 검증 문제</h3><ul>{result.verification.map((item, index) => <li key={index}><code>{item.code}</code> {item.message}</li>)}</ul></section>
        )}
        {!records && result.guidance?.length > 0 && (
          <section><h3>안내</h3><ul>{result.guidance.map((item, index) => <li key={index}><strong>{item.title}</strong> · {item.why}</li>)}</ul></section>
        )}
        {records && result.queries?.length > 0 && (
          <section><h3>조회 조건</h3>
            {result.queries.map((query, index) => (
              <div key={index} className="agent-details__query">
                <strong>{RECORD_TYPE_LABELS[query.queryType] ?? query.queryType}</strong> <span className="rec-help">{query.total ?? '?'}건{query.truncated ? ' · 일부만 받음' : ''}</span>
                <pre>{JSON.stringify(query.conditions, null, 2)}</pre>
              </div>
            ))}
          </section>
        )}
        {citations.length > 0 && (
          <section><h3>근거</h3><ul>{citations.map((item, index) => {
            const match = item.sourceType === 'RECORD' ? /^(WORK|PERMIT|RISK|TBM|APPROVAL):(\d+)$/.exec(item.locator ?? '') : null;
            const path = match ? jobRecordPath(match[1], Number(match[2])) : null;
            return (
              <li key={index}><strong>{item.title || item.locator || item.source || item.refId}</strong>
                {item.snippet && <p className="rec-help">{item.snippet}</p>}
                {path && <Link to={path}>근거 기록 열기</Link>}
                {/^https?:\/\//i.test(item.url ?? '') && <> <a href={item.url} target="_blank" rel="noopener noreferrer">원문</a></>}
              </li>
            );
          })}</ul></section>
        )}
        {steps.length > 0 && (
          <section><h3>실행 단계</h3><ol className="agent-details__steps">{steps.map((item, index) => (
            <li key={item.seq ?? index}>{item.kind || item.type} · {item.name || item.toolName || ''} <span className="rec-help">{item.status}{(item.elapsedMs ?? item.latencyMs) != null ? ` · ${item.elapsedMs ?? item.latencyMs}ms` : ''}</span></li>
          ))}</ol></section>
        )}
        {!records && result.drafts && (
          <details className="agent-details__raw"><summary>AI 초안 원문</summary>
            <p className="rec-help">실제 저장 여부와 문서 번호는 대화 안의 초안 카드를 확인하세요.</p>
            <pre>{JSON.stringify(result.drafts, null, 2)}</pre>
          </details>
        )}
      </div>
    </details>
  );
}
