import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { forgotPassword } from "../../api/auth";
import AuthLayout from "../../components/auth/auth-layout";
import AuthAlert from "../../components/auth/auth-alert";
export default function ForgotPassword() {
  const nav = useNavigate();
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [loading, setLoading] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setEmailError("");
    const emailInput = e.currentTarget.elements.email;
    const email = emailInput.value.trim();

    if (!email) {
      setEmailError("가입할 때 사용한 이메일을 입력해 주세요.");
      return;
    }
    if (!emailInput.validity.valid) {
      setEmailError("name@company.com과 같은 이메일 형식으로 입력해 주세요.");
      return;
    }

    setLoading(true);
    try {
      await forgotPassword(email);
      setSent(true);
    } catch (err) {
      setError(err.message || "비밀번호 재설정 메일을 보내지 못했습니다.");
    } finally {
      setLoading(false);
    }
  };
  return (
    <AuthLayout compact>
      <div className="auth-card">
        <h1>비밀번호 찾기</h1>
        <p className="auth-subtitle">
          가입한 이메일로 재설정 링크를 보내드립니다.
        </p>
        {sent ? (
          <AuthAlert type="success">
            입력한 이메일로 가입된 계정이 있으면 재설정 링크를 보냈습니다.
            링크는 10분 동안 한 번만 쓸 수 있습니다.
          </AuthAlert>
        ) : (
          <form className="auth-form" onSubmit={submit} noValidate>
            <AuthAlert type="error">{error}</AuthAlert>
            <label className="auth-field">
              이메일
              <input
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="name@company.com"
                aria-invalid={!!emailError}
                aria-describedby={emailError ? "forgot-password-email-error" : undefined}
                onInput={(event) => {
                  const value = event.currentTarget.value.trim();
                  setEmailError(
                    value && !event.currentTarget.validity.valid
                      ? "name@company.com과 같은 이메일 형식으로 입력해 주세요."
                      : "",
                  );
                }}
              />
              {emailError && (
                <small id="forgot-password-email-error" className="field-error">
                  {emailError}
                </small>
              )}
            </label>
            <button className="auth-button" disabled={loading}>
              {loading ? "전송 중…" : "재설정 링크 보내기"}
            </button>
          </form>
        )}
        <button className="auth-link" onClick={() => nav("/signin")}>
          로그인 화면으로
        </button>
      </div>
    </AuthLayout>
  );
}
