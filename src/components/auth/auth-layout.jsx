import "../../style/auth-layout.css";
import safetyGuardianLogo from "../../assets/safety-guardian-logo.png";

export default function AuthLayout({ children, compact = false, variant = "default" }) {
  return (
    <main className={`auth-page auth-page--${variant} ${compact ? "auth-page--compact" : ""}`}>
      {!compact && (
        <aside className="auth-brand">
          <div className="auth-brand__logo">
            <img src={safetyGuardianLogo} alt="" aria-hidden="true" />
            <span>산업현장 안전관리 AI</span>
          </div>
          <div>
            <h2>
              <span>작업 전에 위험을 먼저</span>
              <span>확인합니다</span>
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
        <div className="auth-mobile-brand">
          <img src={safetyGuardianLogo} alt="" aria-hidden="true" />
          <span>산업현장 안전관리 AI</span>
        </div>
        {children}
      </section>
    </main>
  );
}
