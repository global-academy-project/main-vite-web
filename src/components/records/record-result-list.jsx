import { Link } from 'react-router-dom';

const statusLabels = {
  DRAFT: '작성 중', PENDING: '승인 대기', APPROVED: '승인', REJECTED: '반려',
  BLOCKED: '차단', DONE: '완료', IN_PROGRESS: '진행 중', OPEN: '미완료',
};

export default function RecordResultList({ records = [] }) {
  if (!records.length) return <p className="records-empty">조건에 해당하는 기록이 없습니다.</p>;
  return (
    <div className="table-scroll">
      <table>
        <thead><tr><th>종류</th><th>제목</th><th>일자</th><th>상태</th><th>작성자</th><th>상세</th></tr></thead>
        <tbody>
          {records.map((record) => (
            <tr key={`${record.recordType}-${record.recordId}`}>
              <td>{record.recordType}</td>
              <td>{record.title || '-'}</td>
              <td>{record.recordDate || '-'}</td>
              <td><span className={`pill status-${String(record.status).toLowerCase()}`}>{statusLabels[record.status] || record.status}</span></td>
              <td>{record.writerName || '-'}</td>
              <td><Link className="records-link" to={`/records/${record.recordType}/${record.recordId}`}>보기</Link></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
