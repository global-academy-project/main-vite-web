import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { changePassword } from "../../api/users";
import { clearToken } from "../../api/client";
import AuthLayout from "../../components/auth/auth-layout";
import AuthAlert from "../../components/auth/auth-alert";
import PasswordRules from "../../components/auth/password-rules";
export default function ChangePassword() {
  const nav = useNavigate();
  const [error, setError] = useState("");
  const submit = async (e) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    if (f.get("newPassword") !== f.get("confirm")) {
      setError("비밀번호가 일치하지 않습니다.");
      return;
    }
    try {
      await changePassword({
        currentPassword: f.get("currentPassword"),
        newPassword: f.get("newPassword"),
      });
      nav("/job/list");
    } catch (err) {
      setError(err.message);
    }
  };
  return (
    <AuthLayout compact>
      <div className="auth-card">
        <AuthAlert type="warning">
          임시 비밀번호로 로그인했습니다. 계속하려면 새 비밀번호를 설정하세요.
        </AuthAlert>
        <h1>비밀번호 변경</h1>
        <form className="auth-form" onSubmit={submit}>
          <label className="auth-field">
            현재 비밀번호
            <input name="currentPassword" type="password" required />
          </label>
          <label className="auth-field">
            새 비밀번호
            <input name="newPassword" type="password" required />
          </label>
          <label className="auth-field">
            새 비밀번호 확인
            <input name="confirm" type="password" required />
          </label>
          <PasswordRules />
          <AuthAlert type="error">{error}</AuthAlert>
          <button className="auth-button">변경하고 계속하기</button>
          <button
            type="button"
            className="auth-link"
            onClick={() => {
              clearToken();
              nav("/signin");
            }}
          >
            로그아웃
          </button>
        </form>
      </div>
    </AuthLayout>
  );
}
