import "../../style/auth-layout.css";
export default function AuthLayout({ children, compact = false }) {
  return (
    <main className={`auth-page ${compact ? "auth-page--compact" : ""}`}>
      {!compact && (
        <aside className="auth-brand">
          <div className="auth-brand__logo">
            <span>◇</span> 산업현장 안전관리 AI
          </div>
          <div>
            <h2>
              작업 전에
              <br />
              위험을 먼저
              <br />
              확인합니다
            </h2>
            <p>
              작업허가 · 위험성평가 · TBM · 안전일지를
              <br />
              한곳에서 작성하고 승인합니다.
            </p>
          </div>
          <small>산업현장 안전관리</small>
        </aside>
      )}
      <section className="auth-content">
        <div className="auth-mobile-brand">◇ 산업현장 안전관리 AI</div>
        {children}
      </section>
    </main>
  );
}
