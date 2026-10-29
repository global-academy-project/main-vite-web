export default function EvidencePanel({ evidence = [] }) {
  return (
    <section className="panel records-evidence">
      <h2>조회 근거</h2>
      {evidence.length ? (
        <ul>
          {evidence.map((item) => (
            <li key={`${item.targetType}-${item.targetId}`}>
              <strong>{item.title || `${item.targetType} #${item.targetId}`}</strong>
              <span>{item.targetType} #{item.targetId}{item.status ? ` · ${item.status}` : ''}</span>
            </li>
          ))}
        </ul>
      ) : <p className="records-empty">표시할 근거가 없습니다.</p>}
    </section>
  );
}
