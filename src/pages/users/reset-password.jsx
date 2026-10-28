import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { resetPassword } from "../../api/auth";
import AuthLayout from "../../components/auth/auth-layout";
import AuthAlert from "../../components/auth/auth-alert";
import PasswordRules from "../../components/auth/password-rules";
import { validPassword } from "../../utils/auth-validation";
import { getDetailMessages, getFieldErrors } from "../../utils/validation-details";
export default function ResetPassword() {
  const [q] = useSearchParams(),
    nav = useNavigate();
  const [error, setError] = useState("");
  const [errors, setErrors] = useState({});
  const token = q.get("token");
  const validatePasswordFields = (event) => {
    const form = event.currentTarget;
    const password = form.elements.password.value;
    const confirm = form.elements.confirm.value;

    setErrors((current) => ({
      ...current,
      password: password && !validPassword(password)
        ? "비밀번호는 영문, 숫자, 특수문자를 포함한 8~64자여야 합니다."
        : undefined,
      confirm: confirm && password !== confirm ? "비밀번호가 일치하지 않습니다." : undefined,
    }));
  };
  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setErrors({});
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
      const fieldErrors = getFieldErrors(err, { newPassword: "password" });
      setErrors(fieldErrors);
      setError(
        Object.keys(fieldErrors).length
          ? ""
          : getDetailMessages(err).join("\n") || (err.code === "PASSWORD_REUSED"
            ? "최근에 쓴 비밀번호는 다시 쓸 수 없습니다."
            : "링크가 만료됐거나 유효하지 않습니다."),
      );
    }
  };
  return (
    <AuthLayout compact>
      <div className="auth-card">
        <h1>새 비밀번호 정하기</h1>
        <AuthAlert type="error">{error}</AuthAlert>
        <form className="auth-form" onSubmit={submit} onInput={validatePasswordFields}>
          <label className="auth-field">
            새 비밀번호
            <input name="password" type="password" required aria-invalid={!!errors.password} />
            {errors.password && <small className="field-error">{errors.password}</small>}
          </label>
          <label className="auth-field">
            새 비밀번호 확인
            <input name="confirm" type="password" required aria-invalid={!!errors.confirm} />
            {errors.confirm && <small className="field-error">{errors.confirm}</small>}
          </label>
          <PasswordRules />
          <button className="auth-button">비밀번호 바꾸기</button>
        </form>
      </div>
    </AuthLayout>
  );
}
