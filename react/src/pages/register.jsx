import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import "../style/register-style.css";

function Register() {
  const navigate = useNavigate();
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const email = formData.get("email")?.toString().trim();
    const name = formData.get("name")?.toString().trim();
    const password = formData.get("password");
    const passwordConfirm = formData.get("password-confirm");
    setFieldErrors({});
    setFormError("");

    if (!email || !name || !password) {
      setFormError("이메일, 이름, 비밀번호를 모두 입력해주세요.");
      return;
    }
    if (password.length < 8 || password.length > 64) {
      setFieldErrors({ password: "비밀번호는 8~64자로 입력해주세요." });
      return;
    }
    if (password !== passwordConfirm) {
      setFieldErrors({ "password-confirm": "비밀번호가 일치하지 않습니다." });
      return;
    }

    try {
      await api("/api/v1/auth/signup", {
        method: "POST",
        body: { email, password, name },
      });
      alert("회원가입이 완료되었습니다.");
      navigate("/signin");
    } catch (error) {
      if (error.code === "EMAIL_DUPLICATED") {
        setFieldErrors({ email: "이미 가입된 이메일입니다." });
      } else if (error.code === "INVALID_REQUEST" && error.details?.length) {
        const errors = {};
        error.details.forEach((detail) => {
          if (detail.field) {
            const field = {
              passwordConfirm: "password-confirm",
              password_confirmation: "password-confirm",
            }[detail.field] ?? detail.field;
            errors[field] = detail.message ?? detail.reason ?? error.message;
          }
        });
        setFieldErrors(errors);
        if (!Object.keys(errors).length) setFormError(error.message);
      } else {
        setFormError(error.message);
      }
    }
  };

  return (
    <div className="register-page">
      <div className="register-card">
        <div className="register-brand-wrap">
          <div className="register-brand-mark">G</div>
          <span className="register-brand-name">Global Academy</span>
        </div>

        <h1>회원가입</h1>
        <p className="register-subtitle">새 계정을 만들어 시작해보세요.</p>

        <form className="register-form" onSubmit={handleSubmit}>
          <label className="register-input-group">
            <span>이메일</span>
            <input type="email" name="email" placeholder="이메일을 입력하세요" aria-invalid={Boolean(fieldErrors.email)} />
            {fieldErrors.email && <small className="field-error">{fieldErrors.email}</small>}
          </label>

          <label className="register-input-group">
            <span>이름</span>
            <input type="text" name="name" placeholder="이름을 입력하세요" aria-invalid={Boolean(fieldErrors.name)} />
            {fieldErrors.name && <small className="field-error">{fieldErrors.name}</small>}
          </label>

          <label className="register-input-group">
            <span>비밀번호</span>
            <input type="password" name="password" minLength={8} maxLength={64} placeholder="비밀번호를 입력하세요" aria-invalid={Boolean(fieldErrors.password)} />
            {fieldErrors.password && <small className="field-error">{fieldErrors.password}</small>}
          </label>

          <label className="register-input-group">
            <span>비밀번호 확인</span>
            <input type="password" name="password-confirm" placeholder="비밀번호를 다시 입력하세요" aria-invalid={Boolean(fieldErrors["password-confirm"])} />
            {fieldErrors["password-confirm"] && <small className="field-error">{fieldErrors["password-confirm"]}</small>}
          </label>

          {formError && <p className="field-error" role="alert">{formError}</p>}
          <button className="register-btn" type="submit">
            회원가입
          </button>
          <button className="register-secondary-btn" type="button" onClick={() => navigate("/signin")}>
            돌아가기
          </button>
        </form>
      </div>
    </div>
  );
}

export default Register;

/* 생성한 파일
- register.jsx: 회원가입 페이지를 구현하는 React 컴포넌트
- 다른 파일들과의 관계 
- api/client.js: 회원가입 API 호출을 처리하는 함수를 import하여 사용
- style/register-style.css: 회원가입 페이지의 스타일을 정의하는 CSS 파일을 import하여 적용
*/
