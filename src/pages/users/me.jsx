import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getMe, updateMe } from "../../api/users";
import { clearToken } from "../../api/client";
import AuthAlert from "../../components/auth/auth-alert";
import FeatureHeader from "../../components/feature-header";
import "../../style/feature-style.css";

const labels = {
  name: "이름",
  phone: "전화번호",
  department: "부서",
  jobTitle: "직책",
};

export default function Me() {
  const [user, setUser] = useState(null);
  const [message, setMessage] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    getMe()
      .then(setUser)
      .catch((error) => {
        setUser({
          name: "홍길동",
          email: "hong.gildong@example.com",
          phone: "010-1234-5678",
          department: "안전관리팀",
          jobTitle: "관리자",
          sites: [
            {
              siteId: "preview-site",
              name: "서울 본사 현장",
              role: "관리자",
            },
          ],
        });
        setMessage(`미리보기 · ${error.message}`);
      });
  }, []);

  const logout = () => {
    clearToken();
    navigate("/signin", { replace: true });
  };

  const save = async (event) => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));

    try {
      setUser(await updateMe({ ...values, lockVersion: user.lockVersion }));
      setMessage("내 정보가 저장되었습니다.");
    } catch (error) {
      setMessage(
        error.status === 409
          ? "다른 변경 사항이 있습니다. 새로고침 후 다시 시도해 주세요."
          : error.message,
      );
    }
  };

  if (!user) {
    return (
      <div className="feature-page">
        <FeatureHeader onLogout={logout} />
        <main className="page-message">
          {message || "내 정보를 불러오는 중입니다..."}
        </main>
      </div>
    );
  }

  return (
    <div className="feature-page">
      <FeatureHeader onLogout={logout} />
      <main className="page-content profile-page">
        <Link className="back-button" to="/feature">
          ← 문서 목록으로
        </Link>
        <div className="page-heading profile-heading">
          <div>
            <p className="eyebrow">MY ACCOUNT</p>
            <h1>내 정보</h1>
            <p className="muted">
              개인 정보와 서비스 이용 권한을 확인하고 관리할 수 있습니다.
            </p>
          </div>
        </div>
        {message && <AuthAlert type="info">{message}</AuthAlert>}
        <div className="profile-layout">
          <aside className="profile-summary">
            <div className="profile-avatar">
              {(user.name || user.email || "U").slice(0, 1).toUpperCase()}
            </div>
            <h2>{user.name || "사용자"}</h2>
            <p>{user.email}</p>
            <span className="profile-chip">계정 활성</span>
            <dl className="profile-quick-info">
              <div><dt>부서</dt><dd>{user.department || "미등록"}</dd></div>
              <div><dt>직책</dt><dd>{user.jobTitle || "미등록"}</dd></div>
            </dl>
          </aside>
          <div className="profile-sections">
            <section className="profile-card">
              <div className="card-title-row">
                <h2>기본 정보</h2>
                <p>연락처와 소속 정보를 수정할 수 있습니다.</p>
              </div>
              <form className="profile-form" onSubmit={save}>
                <label className="profile-field profile-field--full">
                  이메일
                  <input value={user.email || ""} readOnly />
                </label>
                {["name", "phone", "department", "jobTitle"].map((name) => (
                  <label className="profile-field" key={name}>
                    {labels[name]}
                    <input
                      name={name}
                      defaultValue={user[name] ?? ""}
                      placeholder={`${labels[name]}을 입력하세요`}
                    />
                  </label>
                ))}
                <div className="profile-form-actions">
                  <button className="primary-button" type="submit">
                    변경 사항 저장
                  </button>
                </div>
              </form>
            </section>
            <section className="profile-card">
              <div className="card-title-row">
                <h2>소속 및 권한</h2>
                <p>현재 접근 가능한 현장과 역할입니다.</p>
              </div>
              {user.sites?.length ? (
                <ul className="site-list">
                  {user.sites.map((site) => (
                    <li key={site.siteId}>
                      <span className="site-icon">⌂</span>
                      <span><strong>{site.name}</strong><small>현장 구성원</small></span>
                      <span className="role-badge">{site.role}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="profile-empty">등록된 현장 권한이 없습니다.</div>
              )}
            </section>
            <section className="profile-card security-card">
              <div>
                <h2>보안 설정</h2>
                <p>비밀번호를 주기적으로 변경하여 계정을 안전하게 보호하세요.</p>
              </div>
              <Link className="outline-button" to="/change-password">
                비밀번호 변경
              </Link>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
