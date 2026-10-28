import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { logout } from "../../api/auth";
import { getMe, requestEmailChange, updateMe } from "../../api/users";
import { clearToken } from "../../api/client";
import { authErrorMessage } from "../../constants/auth-errors";
import { getDetailMessages, getFieldErrors } from "../../utils/validation-details";
import AuthAlert from "../../components/auth/auth-alert";
import DashboardHeader from "../../components/dashboard-header";
import Sidebar from "../../components/sidebar";
import { useTheme } from "../../contexts/theme-context";
import "../../style/feature-style.css";
import "../../style/job/job-dashboard.css";

const labels = {
  name: "이름",
  phone: "전화번호",
  department: "부서",
  jobTitle: "직책",
};

const roleLabels = {
  WRITER: "작성자",
  APPROVER: "승인자",
  SITE_ADMIN: "현장 관리자",
  ADMIN: "관리자",
};

export default function Me() {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { darkMode, setDarkMode } = useTheme();
  const [me, setMe] = useState(null);
  const [message, setMessage] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [emailMessage, setEmailMessage] = useState("");

  useEffect(() => {
    getMe()
      .then(setMe)
      .catch((error) => {
        setMessage(error.message);
      });
  }, []);

  const save = async (event) => {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    setMessage("");
    setFieldErrors({});

    try {
      setMe(await updateMe({
        name: values.get("name"),
        phone: values.get("phone"),
        department: values.get("department"),
        jobTitle: values.get("jobTitle"),
        lockVersion: me.lockVersion,
      }));
      setMessage("내 정보가 저장되었습니다.");
    } catch (error) {
      const errors = getFieldErrors(error);
      setFieldErrors(errors);
      setMessage(
        error.status === 409
          ? "다른 변경 사항이 있습니다. 새로고침 후 다시 시도해 주세요."
          : Object.keys(errors).length
            ? ""
            : getDetailMessages(error).join("\n") || error.message,
      );
    }
  };

  const changeEmail = async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);

    try {
      await requestEmailChange(
        values.get("newEmail"),
        values.get("currentPassword"),
      );
      form.reset();
      setEmailMessage(
        "새 주소로 확인 메일을 보냈습니다. 10분 안에 링크를 눌러야 바뀝니다.",
      );
    } catch (error) {
      setEmailMessage(authErrorMessage(error));
    }
  };

  const doLogout = async () => {
    try {
      await logout();
    } finally {
      clearToken();
      navigate("/signin", { replace: true });
    }
  };

  const user = me?.user;

  const shell = (content) => (
    <div className="dashboard-shell">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="dashboard-main">
        <DashboardHeader
          userInitial={Array.from(user?.name || user?.email || "U")[0]}
          userName={user?.name || user?.email || "내 계정"}
          darkMode={darkMode}
          setDarkMode={setDarkMode}
          doLogout={doLogout}
          setSidebarOpen={setSidebarOpen}
          title="내 정보"
        />
        {content}
      </div>
    </div>
  );

  if (!me) {
    return shell(<main className="page-message">{message || "내 정보를 불러오는 중입니다..."}</main>);
  }

  return shell(
      <main className="page-content profile-page">
        <div className="page-heading profile-heading">
          <div>
            <p className="eyebrow">MY ACCOUNT</p>
            <h1>내 정보</h1>
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
                      aria-invalid={!!fieldErrors[name]}
                    />
                    {fieldErrors[name] && (
                      <small className="field-error">{fieldErrors[name]}</small>
                    )}
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
              {me.sites?.length ? (
                <ul className="site-list">
                  {me.sites.map((site) => (
                    <li key={site.siteId}>
                      <span className="site-icon">⌂</span>
                      <span><strong>{site.name}</strong><small>현장 구성원</small></span>
                      <span className="role-badge">
                        {roleLabels[site.role] ?? site.role}
                      </span>
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
            <section className="profile-card">
              <div className="card-title-row">
                <h2>이메일 변경</h2>
                <p>새 이메일로 전송된 확인 링크를 눌러야 변경이 완료됩니다.</p>
              </div>
              {emailMessage && <AuthAlert type="info">{emailMessage}</AuthAlert>}
              <form className="profile-form" onSubmit={changeEmail}>
                <label className="profile-field">
                  새 이메일
                  <input name="newEmail" type="email" required />
                </label>
                <label className="profile-field">
                  현재 비밀번호
                  <input name="currentPassword" type="password" required />
                </label>
                <div className="profile-form-actions">
                  <button className="primary-button" type="submit">
                    확인 메일 보내기
                  </button>
                </div>
              </form>
            </section>
          </div>
        </div>
      </main>
  );
}
