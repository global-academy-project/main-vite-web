import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { resetPassword } from "../../api/auth";
import AuthLayout from "../../components/auth/auth-layout";
import AuthAlert from "../../components/auth/auth-alert";
import PasswordRules from "../../components/auth/password-rules";
import { validPassword } from "../../utils/auth-validation";
export default function ResetPassword() {
  const [q] = useSearchParams(),
    nav = useNavigate();
  const [error, setError] = useState("");
  const token = q.get("token");
  const submit = async (e) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget),
      p = f.get("password");
    if (!token) {
      setError("비밀번호 재설정 링크가 없습니다.");
      return;
    }
    if (!validPassword(p) || p !== f.get("confirm")) {
      setError("비밀번호 규칙과 일치 여부를 확인해주세요.");
      return;
    }
    try {
      await resetPassword(q.get("token"), p);
      nav("/signin", { replace: true });
    } catch (err) {
      setError(
        err.code === "PASSWORD_REUSED"
          ? "최근에 쓴 비밀번호는 다시 쓸 수 없습니다."
          : "링크가 만료됐거나 유효하지 않습니다.",
      );
    }
  };
  return (
    <AuthLayout compact>
      <div className="auth-card">
        <h1>새 비밀번호 정하기</h1>
        <AuthAlert type="error">{error}</AuthAlert>
        <form className="auth-form" onSubmit={submit}>
          <label className="auth-field">
            새 비밀번호
            <input name="password" type="password" required />
          </label>
          <label className="auth-field">
            새 비밀번호 확인
            <input name="confirm" type="password" required />
          </label>
          <PasswordRules />
          <button className="auth-button">비밀번호 바꾸기</button>
        </form>
      </div>
    </AuthLayout>
  );
}
