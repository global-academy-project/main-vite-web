import Icon from '../ui/icon.jsx';

const SIGNUP_STEPS = [
  ['가입 신청', '이메일·이름·비밀번호를 적습니다.'],
  ['이메일 인증', '받은 메일의 링크를 10분 안에 누릅니다.'],
  ['관리자 승인', '관리자가 현장과 역할을 정합니다.'],
  ['로그인', '권한받은 현장이 홈에 보입니다.'],
];

/** 가입 진행 단계 (current: 0부터) */
export default function SignupSteps({ current = 0 }) {
  return (
    <ol className="auth-steps" aria-label="가입 절차">
      {SIGNUP_STEPS.map(([title, text], index) => (
        <li key={title} className={index < current ? 'is-done' : index === current ? 'is-current' : ''} aria-current={index === current ? 'step' : undefined}>
          <span className="auth-steps__no" aria-hidden="true">{index < current ? <Icon name="check" size={12} strokeWidth={3} /> : index + 1}</span>
          <span className="auth-steps__text"><strong>{title}</strong><span>{text}</span></span>
        </li>
      ))}
    </ol>
  );
}
