import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getRecordDetail } from '../../api/records';
import EvidencePanel from '../../components/records/evidence-panel';
import SafetyPageLayout from '../../components/safety-page-layout';
import '../../style/records.css';

function Detail() {
  const { recordType, recordId } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => { getRecordDetail(recordType, recordId).then(setData).catch((e) => setError(e.message)); }, [recordType, recordId]);
  if (error) return <p className="dashboard-error" role="alert">{error}</p>;
  if (!data) return <p role="status">기록을 불러오는 중입니다...</p>;
  return <><div className="page-heading"><h1>{data.title || `${recordType} #${recordId}`}</h1><p>{recordType} · {data.status}</p></div><section className="panel"><h2>기록 내용</h2><pre className="records-json">{JSON.stringify(data.record, null, 2)}</pre></section><section className="panel"><h2>승인 이력</h2>{data.approvalHistory?.length ? <pre className="records-json">{JSON.stringify(data.approvalHistory, null, 2)}</pre> : <p className="records-empty">승인 이력이 없습니다.</p>}</section><section className="panel"><h2>변경 이력</h2>{data.changeHistory?.length ? <pre className="records-json">{JSON.stringify(data.changeHistory, null, 2)}</pre> : <p className="records-empty">변경 이력이 없습니다.</p>}</section><EvidencePanel evidence={data.evidence || []}/></>;
}
export default function RecordDetail() { return <SafetyPageLayout title="기록 상세">{() => <Detail/>}</SafetyPageLayout>; }
