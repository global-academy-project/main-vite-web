import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { ApiError, getCurrentUser, getToken } from "../api/client";

function ProtectedRoute({ children }) {
  const [state, setState] = useState(() =>
    getToken() ? "checking" : "signed-out",
  );
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

  if (state === "signed-out") {
    return <Navigate to="/signin" replace />;
  }

  if (state === "checking") {
    return (
      <main className="page-message">
        로그인 상태를 확인하고 있습니다...
      </main>
    );
  }

  if (state === "error") {
    return (
      <main className="page-message" role="alert">
        <p>{error || "사용자 정보를 확인하지 못했습니다."}</p>
        <button type="button" onClick={() => window.location.reload()}>
          다시 시도
        </button>
      </main>
    );
  }

  return children;
}

export default ProtectedRoute;
