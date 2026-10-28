import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { verifyEmail } from "../../api/auth";
import AuthLayout from "../../components/auth/auth-layout";

export default function VerifyEmail() {
  const [query] = useSearchParams();
  const navigate = useNavigate();
  const token = query.get("token");
  const [status, setStatus] = useState(token ? "loading" : "invalid");
  useEffect(() => {
    if (!token) return;
    verifyEmail(token)
      .then(() => setStatus("success"))
      .catch((error) =>
        setStatus(
          error.code === "TOKEN_EXPIRED_LINK"
            ? "expired"
            : error.code === "TOKEN_ALREADY_USED"
              ? "used"
              : "invalid",
        ),
      );
  }, [token]);
  const copy = {
    loading: ["인증 링크 확인 중", "잠시만 기다려주세요."],
    success: [
      "이메일 인증을 마쳤습니다.",
      "관리자 승인 후 로그인할 수 있습니다.",
    ],
    expired: ["인증 링크가 만료됐습니다.", "새 인증 링크를 받아주세요."],
    used: ["이미 사용한 링크입니다.", "로그인 화면에서 상태를 확인해주세요."],
    invalid: ["유효하지 않은 링크입니다.", "링크 주소를 다시 확인해주세요."],
  }[status];
  return (
    <AuthLayout compact>
      <div className="auth-card">
        <div className="auth-status-icon">
          {status === "success" ? "✓" : "!"}
        </div>
        <h1>{copy[0]}</h1>
        <p className="auth-subtitle">{copy[1]}</p>
        <button
          className="auth-button"
          onClick={() =>
            navigate(status === "expired" ? "/register/done" : "/signin")
          }
        >
          {status === "expired" ? "새 인증 링크 받기" : "로그인 화면으로"}
        </button>
      </div>
    </AuthLayout>
  );
}
