import { useCallback, useEffect, useMemo, useState } from 'react';
import Icon from '../ui/icon.jsx';
import { DocPanel } from '../work/doc-panels.jsx';
import { docLoaders } from '../work/doc-loaders.js';
import { draftDocs, draftRemaining } from '../../utils/home-model.js';

/**
 * AI 작업 등록이 끝난(DONE) 뒤 대화 안에서 초안을 끝까지 처리하는 카드.
 * 쓰는 서버 값: run.result.saved (workId, riskAssessmentId, permits[], tbmId), run.result.approvalGate.
 * 각 탭은 기존 api 함수(조회·저장·판정·승인 요청)를 그대로 부른다. 서버 변경 없음.
 */
export default function DraftCard({ result, siteId, zones, onChanged }) {
  const docs = useMemo(() => draftDocs(result.saved), [result.saved]);
  const [records, setRecords] = useState({});
  const [active, setActive] = useState(docs[0]?.key);

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

  const remaining = docs.map((doc) => ({ doc, ...draftRemaining(doc, records[doc.key]?.data) }));
  const left = remaining.filter((item) => !item.done).length;
  const current = docs.find((doc) => doc.key === active) ?? docs[0];

  // 처리하면 다음 남은 탭으로 이동
  const advance = async (doc) => {
    const fresh = await load(doc);
    onChanged?.();
    const after = docs.map((item) => ({ item, done: draftRemaining(item, item.key === doc.key ? fresh : records[item.key]?.data).done }));
    const next = after.find((entry) => !entry.done && entry.item.key !== doc.key);
    if (next) setActive(next.item.key);
  };

  if (!docs.length) return null;
  return (
    <article className="draft-card" aria-label="AI가 만든 초안">
      <header className="draft-card__head">
        <span className="draft-card__title"><Icon name="records" size={18} />초안 {docs.length}건을 만들었습니다</span>
        <span className="draft-card__left">{left ? <>남은 일 <strong>{left}</strong></> : <><Icon name="check" size={14} />모두 처리</>}</span>
      </header>
      {result.saved.workDateAssumed && <p className="draft-card__note"><Icon name="info" size={14} />작업 날짜가 없어 오늘로 저장했습니다. 작업일을 확인하세요.</p>}
      <div className="draft-card__tabs" role="tablist" aria-label="초안 문서">
        {remaining.map(({ doc, done, label }) => (
          <button key={doc.key} type="button" role="tab" aria-selected={doc.key === current.key} className={`draft-tab${doc.key === current.key ? ' is-active' : ''}`} onClick={() => setActive(doc.key)}>
            {doc.label}
            <span className={`draft-tab__state${done ? ' is-done' : ''}`}>{done ? <Icon name="check" size={12} strokeWidth={3} label="완료" /> : label}</span>
          </button>
        ))}
      </div>
      <div className="draft-card__body" role="tabpanel">
        <DocPanel doc={current} entry={records[current.key]} siteId={siteId} zones={zones} gate={result.approvalGate} onReload={() => load(current)} onDone={() => advance(current)} />
      </div>
    </article>
  );
}
