import { useNavigate } from "react-router-dom";
import { api, setToken } from "../../api/client";
import "../../style/signin-style.css";

function Signin() {
  const navigate = useNavigate();

  const handleSignin = async (event) => {
    event.preventDefault();

    const form = event.currentTarget;
    const email = form.email.value.trim();
    const password = form.password.value;

    if (!email || !password) {
      alert("이메일과 비밀번호를 입력해주세요.");
      return;
    }

    try {
      const data = await api("/api/v1/auth/login", {
        method: "POST",
        body: { email, password },
      });
      if (!data?.accessToken) {
        throw new Error("로그인 응답에 액세스 토큰이 없습니다.");
      }
      setToken(data.accessToken, data.expiresIn);
      navigate("/feature");
    } catch (error) {
      if (error.status === 401) {
        alert("이메일 또는 비밀번호를 확인해주세요.");
      } else {
        alert(error.message);
      }
    }
  };

  return (
    <div className="signin-page">
      <div className="signin-card">
        <div className="brand-wrap">
          <div className="brand-mark">G</div>
          <span className="brand-name">Global Academy</span>
        </div>

        <h1>로그인</h1>
        <p className="subtitle">계속하려면 계정 정보를 입력해주세요.</p>

        <form className="signin-form" onSubmit={handleSignin}>
          <label className="input-group">
            <span>이메일</span>
            <input type="email" name="email" placeholder="이메일을 입력하세요" />
          </label>

          <label className="input-group">
            <span>비밀번호</span>
            <input type="password" name="password" placeholder="비밀번호를 입력하세요" />
          </label>

          <div className="form-options">
            <label className="remember-me">
              <input type="checkbox" />
              <span>로그인 유지</span>
            </label>
            <button type="button" className="link-btn">
              비밀번호 찾기
            </button>
          </div>

          <button className="signin-btn" type="submit">
            로그인
          </button>
          <button
            className="secondary-btn"
            type="button"
            onClick={() => navigate("/register")}
          >
            회원가입
          </button>
        </form>
      </div>
    </div>
  );
}

export default Signin;

/* 생성한 파일
- signin.jsx: 로그인 페이지를 구현하는 React 컴포넌트
- 다른 파일들과의 관계  
- api/client.js: 로그인 API 호출 및 토큰 관리를 위한 함수들을 import하여 사용
- style/signin-style.css: 로그인 페이지의 스타일을 정의하는 CSS 파일을 import하여 적용
*/
