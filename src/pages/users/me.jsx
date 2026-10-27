import { useEffect, useState } from "react";
import { getMe, updateMe } from "../../api/users";
import AuthAlert from "../../components/auth/auth-alert";
import "../../style/auth-layout.css";
export default function Me() {
  const [user, setUser] = useState(null),
    [message, setMessage] = useState("");
  useEffect(() => {
    getMe()
      .then(setUser)
      .catch((e) => setMessage(e.message));
  }, []);
  if (!user)
    return (
      <main className="page-message">
        {message || "내 정보를 불러오는 중입니다…"}
      </main>
    );
  const save = async (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget));
    try {
      setUser(await updateMe({ ...f, lockVersion: user.lockVersion }));
      setMessage("저장했습니다.");
    } catch (e) {
      setMessage(
        e.status === 409
          ? "다른 곳에서 수정됐습니다. 새로고침 후 다시 시도하세요."
          : e.message,
      );
    }
  };
  return (
    <main className="dashboard-content">
      <h1>내 정보</h1>
      <AuthAlert type="info">{message}</AuthAlert>
      <section className="auth-card auth-card--wide">
        <h2>기본 정보</h2>
        <form className="auth-form" onSubmit={save}>
          <label className="auth-field">
            이메일
            <input value={user.email} readOnly />
          </label>
          {["name", "phone", "department", "jobTitle"].map((n) => (
            <label className="auth-field" key={n}>
              {
                {
                  name: "이름",
                  phone: "전화번호",
                  department: "부서",
                  jobTitle: "직책",
                }[n]
              }
              <input name={n} defaultValue={user[n] ?? ""} />
            </label>
          ))}
          <button className="auth-button">저장</button>
        </form>
      </section>
      <section className="auth-card auth-card--wide">
        <h2>내 현장 권한</h2>
        {user.sites?.length ? (
          user.sites.map((s) => (
            <p key={s.siteId}>
              {s.name} · {s.role}
            </p>
          ))
        ) : (
          <p>등록된 현장이 없습니다.</p>
        )}
      </section>
    </main>
  );
}
