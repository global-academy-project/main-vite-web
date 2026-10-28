import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { signUp } from "../../api/auth";
import AuthLayout from "../../components/auth/auth-layout";
import AuthAlert from "../../components/auth/auth-alert";
import PasswordRules from "../../components/auth/password-rules";
import { validPassword } from "../../utils/auth-validation";
import { getDetailMessages, getFieldErrors } from "../../utils/validation-details";
export default function Register() {
  const nav = useNavigate();
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [loading, setLoading] = useState(false);
  const validatePasswordFields = (event) => {
    const form = event.currentTarget;
    const input = event.target;
    const password = form.elements.password.value;
    const passwordConfirm = form.elements.passwordConfirm.value;

    setErrors((current) => ({
      ...current,
      password: password && !validPassword(password)
        ? "비밀번호는 영문, 숫자, 특수문자를 포함한 8~64자여야 합니다."
        : undefined,
      passwordConfirm: passwordConfirm && password !== passwordConfirm
        ? "비밀번호가 일치하지 않습니다."
        : undefined,
      email: input.name === "email" && input.value && !input.validity.valid
        ? "이메일 형식으로 입력해 주세요."
        : input.name === "email" ? undefined : current.email,
    }));
  };
  const submit = async (e) => {
    e.preventDefault();
    setFormError("");
    const f = new FormData(e.currentTarget),
      v = Object.fromEntries(f);
    const next = {};
    if (!validPassword(v.password))
      next.password = "비밀번호 규칙을 확인해주세요.";
    if (v.password !== v.passwordConfirm)
      next.passwordConfirm = "비밀번호가 일치하지 않습니다.";
    if (v.phone && !/^0[0-9]{8,10}$/.test(v.phone))
      next.phone = "전화번호는 숫자 9~11자로 입력해주세요.";
    setErrors(next);
    if (Object.keys(next).length) return;
    setLoading(true);
    setErrors({});
    try {
      await signUp({
        email: v.email,
        name: v.name,
        password: v.password,
      });
      nav("/register/done", { state: { email: v.email } });
    } catch (err) {
      if (err.code === "EMAIL_DUPLICATED")
        setErrors({ email: "이미 가입된 이메일입니다." });
      else {
        const fieldErrors = getFieldErrors(err);
        setErrors(fieldErrors);
        setFormError(Object.keys(fieldErrors).length ? "" : getDetailMessages(err).join("\n") || err.message);
      }
    } finally {
      setLoading(false);
    }
  };
  return (
    <AuthLayout variant="register">
      <div className="auth-card">
        <h1>회원가입</h1>
        <p className="auth-subtitle">
          <b>*</b> 표시는 필수입니다.
        </p>
        <AuthAlert type="error">{formError}</AuthAlert>
        <form className="auth-form" onSubmit={submit} onInput={validatePasswordFields}>
          {[
            ["email", "이메일 *", "email"],
            ["name", "이름 *", "text"],
            ["password", "비밀번호 *", "password"],
            ["passwordConfirm", "비밀번호 확인 *", "password"],
            ["phone", "전화번호 (선택)", "tel"],
          ].map(([n, l, t]) => (
            <label className="auth-field" key={n}>
              {l}
              <input
                name={n}
                type={t}
                required={n !== "phone"}
                aria-invalid={!!errors[n]}
              />
              {errors[n] && <small className="field-error">{errors[n]}</small>}
            </label>
          ))}
          <PasswordRules />
          <div className="auth-row">
            <label className="auth-field" style={{ flex: 1 }}>
              부서 (선택)
              <input name="department" />
            </label>
            <label className="auth-field" style={{ flex: 1 }}>
              직책 (선택)
              <input name="jobTitle" />
            </label>
          </div>
          <button className="auth-button" disabled={loading}>
            {loading ? "가입 중…" : "가입하기"}
          </button>
          <div className="register-footer" style={{ textAlign: "center" }}>
            이미 계정이 있나요?{" "}
            <button
              type="button"
              className="auth-link"
              onClick={() => nav("/signin")}
            >
              로그인
            </button>
          </div>
        </form>
      </div>
    </AuthLayout>
  );
}
