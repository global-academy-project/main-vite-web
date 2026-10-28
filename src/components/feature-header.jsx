import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { logout } from "../api/auth";
import { clearToken, getCurrentUser } from "../api/client";

function FeatureHeader({ onLogout }) {
  const [userName, setUserName] = useState("내 계정");
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;

    getCurrentUser()
      .then((data) => {
        if (!cancelled) {
          setUserName(data?.user?.name || data?.user?.email || "내 계정");
        }
      })
      .catch(() => {
        // The protected route already handles authentication failures.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleLogout = async () => {
    try {
      await logout();
    } finally {
      clearToken();
      if (onLogout) {
        onLogout();
      } else {
        navigate("/signin", { replace: true });
      }
    }
  };

  return (
    <header className="feature-topbar">
      <div className="feature-brand">
        <div className="feature-brand-mark">G</div>
        <Link to="/dashboard">Global Academy · 문서 OCR</Link>
      </div>
      <div className="feature-header-actions">
        <Link className="feature-link-button" to="/me">
          {userName}
        </Link>
        <button
          className="feature-link-button"
          type="button"
          onClick={handleLogout}
        >
          로그아웃
        </button>
      </div>
    </header>
  );
}

export default FeatureHeader;
