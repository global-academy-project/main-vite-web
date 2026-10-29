import { useEffect, useMemo, useState } from 'react';
import { askRecordQuestion, createAuditReportDraft, searchRecords } from '../../api/records';
import EvidencePanel from '../../components/records/evidence-panel';
import RecordResultList from '../../components/records/record-result-list';
import SafetyPageLayout from '../../components/safety-page-layout';
import '../../style/records.css';

const questions = ['지난달 가스측정 값 없이 승인된 화기작업이 있었나?', '이번 달 승인 대기 작업은 몇 건인가?', '반려 후 재승인된 작업은 무엇인가?', '미완료 개선조치가 있는 작업을 보여줘.', '점검 결과가 NG인 작업은 무엇인가?', 'TBM이 누락된 작업은 무엇인가?'];
const iso = (date) => date.toISOString().slice(0, 10);

function Search({ site }) {
  const today = useMemo(() => new Date(), []);
  const monthStart = useMemo(() => new Date(today.getFullYear(), today.getMonth(), 1), [today]);
  const [filters, setFilters] = useState({ from: iso(monthStart), to: iso(today), recordType: '', workType: '', status: '', keyword: '' });
  const [question, setQuestion] = useState(questions[0]);
  const [records, setRecords] = useState([]);
  const [answer, setAnswer] = useState(null);
  const [draft, setDraft] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const siteId = site.currentSite?.siteId;

  const runSearch = async () => {
    if (!siteId) return;
    setLoading(true); setError(''); setAnswer(null);
    try { setRecords(await searchRecords(siteId, filters)); } catch (e) { setError(e.message); } finally { setLoading(false); }
  };
  useEffect(() => {
    if (!siteId) return undefined;
    let cancelled = false;
    searchRecords(siteId, filters).then((data) => {
      if (!cancelled) { setRecords(data); setError(''); }
    }).catch((requestError) => {
      if (!cancelled) setError(requestError.message);
    });
    return () => { cancelled = true; };
    // Initial site load only. Filter changes are applied by the explicit search button.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteId]);

  const ask = async (event) => {
    event.preventDefault(); setLoading(true); setError(''); setDraft(null);
    try { const result = await askRecordQuestion(siteId, { question, ...filters }); setAnswer(result); setRecords(result.records || []); } catch (e) { setError(e.message); } finally { setLoading(false); }
  };
  const audit = async () => {
    setLoading(true); setError('');
    try { setDraft(await createAuditReportDraft(siteId, { from: filters.from, to: filters.to })); } catch (e) { setError(e.message); } finally { setLoading(false); }
  };
  const set = (key) => (e) => setFilters((value) => ({ ...value, [key]: e.target.value }));

  return <>
    <div className="page-heading records-heading"><div><h1>기록 조회·감사</h1><p>정해진 조회 도구로 안전 기록을 검색하고 근거를 확인합니다.</p></div><select value={siteId || ''} onChange={(e) => site.selectSite(e.target.value)}>{(site.account?.sites || []).map((item) => <option key={item.siteId} value={item.siteId}>{item.name}</option>)}</select></div>
    {error && <p className="dashboard-error" role="alert">{error}</p>}
    <form className="panel records-question" onSubmit={ask}><h2>기록 질의</h2><textarea value={question} onChange={(e) => setQuestion(e.target.value)} required/><div className="records-suggestions">{questions.map((item) => <button type="button" key={item} onClick={() => setQuestion(item)}>{item}</button>)}</div><button disabled={loading || !siteId}>근거 조회</button></form>
    <section className="panel records-filters"><h2>검색 조건</h2><div><label>시작일<input type="date" value={filters.from} onChange={set('from')}/></label><label>종료일<input type="date" value={filters.to} onChange={set('to')}/></label><label>기록 종류<select value={filters.recordType} onChange={set('recordType')}><option value="">전체</option><option>WORK</option><option>RISK</option><option>PERMIT</option><option>INSPECTION</option><option>TBM</option><option>DAILY_LOG</option><option>CORRECTIVE_ACTION</option></select></label><label>작업 유형<select value={filters.workType} onChange={set('workType')}><option value="">전체</option><option>GENERAL</option><option>HOT</option><option>CONFINED</option><option>HEIGHT</option></select></label><label>상태<input value={filters.status} onChange={set('status')} placeholder="예: APPROVED"/></label><label>검색어<input value={filters.keyword} onChange={set('keyword')} placeholder="제목·장소"/></label></div><button type="button" disabled={loading} onClick={runSearch}>검색</button></section>
    {answer && <section className="panel records-answer"><h2>근거 기반 답변</h2><p>{answer.conclusion}</p><dl><div><dt>조회 기간</dt><dd>{answer.period?.from} ~ {answer.period?.to}</dd></div><div><dt>대상 기록</dt><dd>{answer.recordCount}건</dd></div><div><dt>조회 도구</dt><dd>{answer.tool}</dd></div></dl></section>}
    <section className="panel"><div className="records-panel-heading"><h2>검색 결과 <small>{records.length}건</small></h2><button type="button" disabled={loading || !siteId} onClick={audit}>감사 보고서 초안</button></div>{loading ? <p role="status">기록을 조회하는 중입니다...</p> : <RecordResultList records={records}/>}</section>
    <EvidencePanel evidence={answer?.evidence || []}/>
    {draft && <section className="panel"><h2>감사 보고서 JSON 초안</h2><pre className="records-json">{JSON.stringify(draft, null, 2)}</pre></section>}
  </>;
}

export default function RecordSearch() { return <SafetyPageLayout title="기록 조회·감사">{(site) => <Search site={site}/>}</SafetyPageLayout>; }
