import { Link } from 'react-router-dom';
import safetyGuardianLogo from '../../assets/safety-guardian-logo.png';
import Icon from '../ui/icon.jsx';
import SignupSteps from './signup-steps.jsx';
import '../../styles/ui.css';
import '../../styles/auth.css';

const FEATURES = [
  ['작업 전 위험을 먼저', '작업허가·위험성평가·TBM을 한 흐름으로 작성하고 승인합니다.'],
  ['규칙으로 확인', '측정값과 필수 조치를 서버 규칙으로 판정해 빠진 것을 알려 줍니다.'],
  ['기록을 한곳에', '아차사고·점검표·안전일지를 모아 찾고 질문할 수 있습니다.'],
];

/**
 * 로그인 전 화면 틀. 왼쪽 소개(PC), 오른쪽 카드. compact 면 소개 없이 가운데 카드만(링크 확인·결과 화면).
 * steps 를 주면 소개 자리에 가입 절차를 보인다.
 */
export default function AuthLayout({ children, compact = false, steps = null, wide = false }) {
  return (
    <main className={`auth2${compact ? ' auth2--compact' : ''}`}>
      {!compact && (
        <aside className="auth2-brand" aria-label="서비스 소개">
          <Link to="/signin" className="auth2-brand__logo"><img src={safetyGuardianLogo} alt="" /><span>산업현장 안전관리 AI</span></Link>
          <div className="auth2-brand__main">
            <h2>현장의 위험을<br />작업 전에 확인합니다</h2>
            {steps != null ? <SignupSteps current={steps} /> : (
              <ul className="auth2-brand__features">
                {FEATURES.map(([title, text]) => (
                  <li key={title}><span className="auth2-brand__dot" aria-hidden="true"><Icon name="check" size={14} strokeWidth={3} /></span><span><strong>{title}</strong><span>{text}</span></span></li>
                ))}
              </ul>
            )}
          </div>
          <small>입력한 정보는 회사 안전관리 목적에만 씁니다.</small>
        </aside>
      )}
      <section className="auth2-content">
        <Link to="/signin" className="auth2-mobile-logo"><img src={safetyGuardianLogo} alt="" /><span>산업현장 안전관리 AI</span></Link>
        <div className={`auth2-card${wide ? ' auth2-card--wide' : ''}`}>{children}</div>
      </section>
    </main>
  );
}
