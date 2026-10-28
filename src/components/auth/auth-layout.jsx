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
            {variant === "register" && (
              <div className="register-process" aria-label="회원가입 절차">
                <p>
                  <strong>
                    <span className="register-process__number">1</span>
                    <span className="register-process__label">이메일 인증</span>
                  </strong>
                  <span>가입한 주소로 온 링크를 10분 안에 누릅니다.</span>
                </p>
                <p>
                  <strong>
                    <span className="register-process__number">2</span>
                    <span className="register-process__label">관리자승인</span>
                  </strong>
                  <span>
                    관리자가 현장과 역할(작성자, 승인자, 현장관리자)을 정합니다.
                  </span>
                </p>
                <p>
                  <strong>
                    <span className="register-process__number">3</span>
                    <span className="register-process__label">로그인</span>
                  </strong>
                  <span>권한받은 현장이 대시보드에 보입니다.</span>
                </p>
              </div>
            )}
            <p className="auth-brand__description--legacy">
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
