export default function ApprovalTimeline({ steps = [] }) {
  return (
    <section className="panel">
      <h2>전체 결재선</h2>
      {steps.length ? (
        <ol className="approval-timeline">
          {steps.map((step) => (
            <li key={step.stepNo}>
              <strong>{step.label}</strong>
              <span>{step.requiredRole} · {step.status}{step.deciderName ? ` · ${step.deciderName}` : ''}</span>
              {step.comment && <p>{step.comment}</p>}
            </li>
          ))}
        </ol>
      ) : <p className="records-empty">결재선 정보가 없습니다.</p>}
    </section>
  );
}
