import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { confirmEmailChange } from "../../api/auth";
import AuthLayout from "../../components/auth/auth-layout";

export default function VerifyEmailChange() {
  const [query] = useSearchParams();
  const navigate = useNavigate();
  const token = query.get("token");
  const [status, setStatus] = useState(token ? "loading" : "invalid");

  useEffect(() => {
    if (!token) return;

    confirmEmailChange(token)
      .then(() => setStatus("success"))
      .catch((error) => {
        if (error.code === "TOKEN_EXPIRED_LINK") setStatus("expired");
        else if (error.code === "TOKEN_ALREADY_USED") setStatus("used");
        else setStatus("invalid");
      });
  }, [token]);

  const copy = {
    loading: ["이메일 변경 링크 확인 중", "잠시만 기다려 주세요."],
    success: ["이메일이 변경되었습니다.", "새 이메일로 로그인해 주세요."],
    expired: ["링크가 만료되었습니다.", "내 정보에서 새 링크를 받아 주세요."],
    used: ["이미 사용한 링크입니다.", "로그인 화면에서 계정 상태를 확인해 주세요."],
    invalid: ["유효하지 않은 링크입니다.", "링크 주소를 다시 확인해 주세요."],
  }[status];

  return (
    <AuthLayout compact>
      <div className="auth-card">
        <div className="auth-status-icon">
          {status === "success" ? "✓" : "!"}
        </div>
        <h1>{copy[0]}</h1>
        <p className="auth-subtitle">{copy[1]}</p>
        {status !== "loading" && (
          <button className="auth-button" onClick={() => navigate("/signin")}>
            로그인 화면으로
          </button>
        )}
      </div>
    </AuthLayout>
  );
}
