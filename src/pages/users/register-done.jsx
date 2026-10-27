import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import AuthLayout from "../../components/auth/auth-layout";
import AuthAlert from "../../components/auth/auth-alert";
import { resendVerification } from "../../api/auth";
export default function RegisterDone() {
  const nav = useNavigate(),
    location = useLocation();
  const [email, setEmail] = useState(location.state?.email ?? "");
  const [message, setMessage] = useState("");
  const resend = async () => {
    await resendVerification(email);
    setMessage("인증 메일을 다시 보냈습니다.");
  };
  return (
    <AuthLayout compact>
      <div className="auth-card">
        <div className="auth-status-icon">✉</div>
        <h1>인증 메일을 보냈습니다</h1>
        <p className="auth-subtitle">
          <b>{email || "[가입한 이메일]"}</b>으로 보낸 링크를 눌러 인증을
          마쳐주세요. 링크는 10분 동안 쓸 수 있습니다.
        </p>
        {!location.state?.email && (
          <label className="auth-field">
            이메일
            <input value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
        )}
        <AuthAlert type="success">{message}</AuthAlert>
        <ol className="auth-help">
          <li>이메일 인증</li>
          <li>관리자 승인</li>
          <li>로그인</li>
        </ol>
        <div className="auth-form">
          <button
            className="auth-button auth-button--secondary"
            onClick={resend}
          >
            인증 메일 다시 보내기
          </button>
          <button className="auth-link" onClick={() => nav("/signin")}>
            로그인 화면으로
          </button>
        </div>
      </div>
    </AuthLayout>
  );
}
