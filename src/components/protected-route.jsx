import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { ApiError, getCurrentUser, getToken } from "../api/client";

function ProtectedRoute({ children }) {
  const [state, setState] = useState(() => getToken() ? "checking" : "signed-out");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!getToken()) return undefined;

    let cancelled = false;
    getCurrentUser()
      .then(() => {
        if (!cancelled) setState("authenticated");
      })
      .catch((requestError) => {
        if (cancelled) return;
        if (requestError instanceof ApiError && requestError.status === 401) {
          setState("signed-out");
          return;
        }
        setError(requestError.message);
        setState("error");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (state === "signed-out") return <Navigate to="/signin" replace />;
  if (state === "checking") return <main className="page-message">로그인 상태를 확인하고 있습니다...</main>;
  if (state === "error") {
    return (
      <main className="page-message" role="alert">
        <p>{error || "사용자 정보를 확인하지 못했습니다."}</p>
        <button type="button" onClick={() => window.location.reload()}>다시 시도</button>
      </main>
    );
  }
  return children;
}

export default ProtectedRoute;

/* 생성한 파일 
- protected-route.jsx: 인증된 사용자만 접근할 수 있는 라우트를 구현하는 React 컴포넌트
- 다른 파일들과의 관계
- App.jsx: ProtectedRoute를 import하여 인증된 사용자만 접근할 수 있는 라우트를 설정
- api/client.js: 현재 로그인한 사용자의 정보를 가져오는 getCurrentUser 함수를 import하여 사용
*/