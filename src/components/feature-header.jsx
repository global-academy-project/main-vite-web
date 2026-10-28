import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getCurrentUser } from "../api/client";

function FeatureHeader({ onLogout }) {
  const [userName, setUserName] = useState("내 계정");

  useEffect(() => {
    let cancelled = false;

    getCurrentUser()
      .then((user) => {
        if (!cancelled) {
          setUserName(user?.name || user?.email || "내 계정");
        }
      })
      .catch(() => {
        // The protected route already handles authentication failures.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <header className="feature-topbar">
      <div className="feature-brand">
        <div className="feature-brand-mark">G</div>
        <Link to="/job/list">Global Academy · 문서 OCR</Link>
      </div>
      <div className="feature-header-actions">
        <Link className="feature-link-button" to="/me">
          {userName}
        </Link>
        <button
          className="feature-link-button"
          type="button"
          onClick={onLogout}
        >
          로그아웃
        </button>
      </div>
    </header>
  );
}

export default FeatureHeader;
