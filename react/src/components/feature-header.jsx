import { Link } from "react-router-dom";

function FeatureHeader({ onLogout }) {
  return (
    <header className="feature-topbar">
      <div className="feature-brand">
        <div className="feature-brand-mark">G</div>
        <Link to="/feature">Global Academy · 문서 OCR</Link>
      </div>
      <button className="feature-link-button" type="button" onClick={onLogout}>
        로그아웃
      </button>
    </header>
  );
}

export default FeatureHeader;

/* 생성한 파일
- feature-header.jsx: 문서 관리 페이지 상단의 헤더를 구현하는 React 컴포넌트
- 다른 파일들과의 관계
- feature.jsx: FeatureHeader를 import하여 문서 관리 페이지 상단에 표시
*/