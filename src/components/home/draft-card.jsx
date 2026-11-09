import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../ui/icon.jsx';
import { DocPanel } from '../work/doc-panels.jsx';
import { docLoaders } from '../work/doc-loaders.js';
import { draftDocs, draftRemaining } from '../../utils/home-model.js';

/**
 * AI 작업 등록이 끝난(DONE) 뒤 대화 안에서 초안을 이어서 처리하는 카드.
 * 평소에는 한 줄 요약(문서별 칩 + 남은 일)으로 접혀 있고, 칩을 누르면 그 문서를 카드 안에 펼쳐 바로 처리한다.
 * 넓은 화면에서 이어 하려면 "작업 허브" 로 이동.
 * 쓰는 서버 값: run.result.saved (workId, riskAssessmentId, permits[], tbmId), run.result.approvalGate. 서버 변경 없음.
 */
export default function DraftCard({ result, siteId, zones, onChanged }) {
  const docs = useMemo(() => draftDocs(result.saved), [result.saved]);
  const [records, setRecords] = useState({});
  const [open, setOpen] = useState(null); // 펼친 문서 key, 없으면 접힘
  const cardRef = useRef(null);

  const load = useCallback(async (doc) => {
    try {
      const record = await docLoaders[doc.type](doc, siteId);
      setRecords((prev) => ({ ...prev, [doc.key]: { status: 'ready', data: record } }));
      return record;
    } catch (error) {
      setRecords((prev) => ({ ...prev, [doc.key]: { status: 'error', error: error.message } }));
      return null;
    }
  }, [siteId]);

  useEffect(() => { docs.forEach((doc) => { void load(doc); }); }, [docs, load]);

  // 펼치면 카드가 대화창 안에서 보이도록 끌어온다
  useEffect(() => {
    if (open) cardRef.current?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
  }, [open]);

  const remaining = docs.map((doc) => ({ doc, ...draftRemaining(doc, records[doc.key]?.data) }));
  const left = remaining.filter((item) => !item.done).length;
  const current = docs.find((doc) => doc.key === open) ?? null;
  const hub = result.saved?.workId ? `/job/workspace?workId=${result.saved.workId}` : null;

  // 처리하면 다음 남은 문서를 펼친다 (남은 게 없으면 접는다)
  const advance = async (doc) => {
    const fresh = await load(doc);
    onChanged?.();
    const after = docs.map((item) => ({ item, done: draftRemaining(item, item.key === doc.key ? fresh : records[item.key]?.data).done }));
    const next = after.find((entry) => !entry.done && entry.item.key !== doc.key);
    setOpen(next ? next.item.key : null);
  };

  if (!docs.length) return null;
  return (
    <article ref={cardRef} className={`draft-card${current ? ' is-open' : ''}`} aria-label="AI가 만든 초안">
      <header className="draft-card__head">
        <span className="draft-card__title"><Icon name="records" size={16} />초안 {docs.length}건</span>
        <span className="draft-card__left">{left ? <>남은 일 <strong>{left}</strong></> : <><Icon name="check" size={14} />모두 처리</>}</span>
        {hub && <Link className="draft-card__hub" to={hub}>작업 허브<Icon name="external" size={13} /></Link>}
      </header>
      {result.saved.workDateAssumed && <p className="draft-card__note"><Icon name="info" size={14} />작업 날짜가 없어 오늘로 저장했습니다. 작업일을 확인하세요.</p>}
      <div className="draft-card__chips" aria-label="초안 문서 (누르면 펼침)">
        {remaining.map(({ doc, done, label }) => (
          <button key={doc.key} type="button" aria-expanded={doc.key === open} aria-controls="draft-card-body"
            className={`draft-chip${doc.key === open ? ' is-active' : ''}${done ? ' is-done' : ''}`}
            onClick={() => setOpen((prev) => (prev === doc.key ? null : doc.key))}>
            {doc.label}
            <span className="draft-chip__state">{done ? <Icon name="check" size={12} strokeWidth={3} label="완료" /> : label}</span>
          </button>
        ))}
      </div>
      {current && (
        <div id="draft-card-body" className="draft-card__body">
          <DocPanel doc={current} entry={records[current.key]} siteId={siteId} zones={zones} gate={result.approvalGate} onReload={() => load(current)} onDone={() => advance(current)} />
          <button type="button" className="draft-card__fold" onClick={() => setOpen(null)}><Icon name="chevronUp" size={14} />접기</button>
        </div>
      )}
    </article>
  );
}
