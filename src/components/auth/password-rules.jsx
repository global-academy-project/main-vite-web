export default function PasswordRules() {
  return (
    <ul className="auth-password-rules">
      <li>8~64자</li>
      <li>영문·숫자·특수문자 각각 1개 이상</li>
      <li>최근에 쓴 비밀번호와 다르게</li>
    </ul>
  );
}
