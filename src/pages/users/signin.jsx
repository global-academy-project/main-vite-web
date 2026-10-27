import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { signIn, resendVerification } from "../../api/auth";
import { setToken } from "../../api/client";
import { authErrorMessage } from "../../constants/auth-errors";
import AuthLayout from "../../components/auth/auth-layout";
import AuthAlert from "../../components/auth/auth-alert";

export default function Signin() {
  const navigate = useNavigate();
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    const data = new FormData(e.currentTarget);
    setEmail(data.get("email"));
    setLoading(true);
    try {
      const result = await signIn({
        email: data.get("email"),
        password: data.get("password"),
        rememberMe: data.get("rememberMe") === "on",
      });
      setToken(result.accessToken, result.expiresIn);
      navigate(result.mustChangePassword ? "/change-password" : "/job/list");
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };
  return (
    <AuthLayout>
      <div className="auth-card">
        <h1>로그인</h1>
        <p className="auth-subtitle">회사 이메일로 로그인하세요.</p>
        <AuthAlert
          type={error?.code === "ACCOUNT_PENDING" ? "warning" : "error"}
        >
          {error && authErrorMessage(error)}
          {error?.code === "EMAIL_NOT_VERIFIED" && (
            <>
              <br />
              <button
                className="auth-link"
                onClick={() => resendVerification(email)}
              >
                인증 메일 다시 보내기
              </button>
            </>
          )}
          {error?.code === "ACCOUNT_LOCKED" && (
            <>
              <br />
              <button
                className="auth-link"
                onClick={() => navigate("/forgot-password")}
              >
                비밀번호 재설정
              </button>
            </>
          )}
        </AuthAlert>
        <form className="auth-form" onSubmit={submit}>
          <label className="auth-field">
            이메일
            <input
              name="email"
              type="email"
              required
              placeholder="name@company.com"
            />
          </label>
          <label className="auth-field">
            비밀번호
            <input
              name="password"
              type="password"
              required
              placeholder="비밀번호"
            />
          </label>
          <div className="auth-row">
            <label className="auth-check">
              <input name="rememberMe" type="checkbox" />
              로그인 유지
            </label>
            <button
              type="button"
              className="auth-link"
              onClick={() => navigate("/forgot-password")}
            >
              비밀번호 찾기
            </button>
          </div>
          <p className="auth-help">
            체크하면 로그아웃하기 전까지 로그인이 유지됩니다. 체크하지 않으면
            30분 뒤 다시 로그인해야 합니다.
          </p>
          <button className="auth-button" disabled={loading}>
            {loading ? "로그인 중…" : "로그인"}
          </button>
          <div className="auth-help" style={{ textAlign: "center" }}>
            계정이 없으신가요?{" "}
            <button
              type="button"
              className="auth-link"
              onClick={() => navigate("/register")}
            >
              회원가입
            </button>
          </div>
        </form>
      </div>
    </AuthLayout>
  );
}
