import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { getToken } from "./api/client";
// User Component 모듈
import Register from "./pages/users/register";
import RegisterDone from "./pages/users/register-done";
import Signin from "./pages/users/signin";
import Me from "./pages/users/me";
import ChangePassword from "./pages/users/change-password";
import ForgotPassword from "./pages/users/forgot-password";
import ResetPassword from "./pages/users/reset-password";
import VerifyEmail from "./pages/users/verify-email";
// Feature Component 모듈
import DocumentDetail from "./pages/features/document-detail";
import Feature from "./pages/features/feature";
import Upload from "./pages/features/upload";
import ProtectedRoute from "./components/protected-route";
// Job Component 모듈
import JobSearch from "./pages/job/job-search";
import DaileyChecklist from "./pages/job/dailey-checklist";

function EntryRedirect() {
  return <Navigate to={getToken() ? "/feature" : "/signin"} replace />;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<EntryRedirect />} />
        <Route path="/signin" element={<Signin />} />
        <Route path="/register" element={<Register />} />
        <Route path="/register/done" element={<RegisterDone />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route
          path="/me"
          element={
            <ProtectedRoute>
              <Me />
            </ProtectedRoute>
          }
        />
        <Route
          path="/change-password"
          element={
            <ProtectedRoute>
              <ChangePassword />
            </ProtectedRoute>
          }
        />
        <Route
          path="/feature"
          element={<ProtectedRoute><Feature /></ProtectedRoute>}
        />
        <Route
          path="/upload"
          element={<ProtectedRoute><Upload /></ProtectedRoute>}
        />
        <Route
          path="/documents/:documentId"
          element={<ProtectedRoute><DocumentDetail /></ProtectedRoute>}
        />
        <Route
          path="/documents/:documentId/runs/:runId"
          element={<ProtectedRoute><DocumentDetail /></ProtectedRoute>}
        />
        {/* Job List, Details 라우팅 / WARNING : ProtectedRoute 없이 현재 테스트용으로 우회 */}
        <Route
          path="/job/list"
          element={
            <ProtectedRoute>
              <JobSearch />
            </ProtectedRoute>
          }
        />
        <Route
          path="/job/dailey-checklist"
          element={<DaileyChecklist />}
        />
        <Route path="*" element={<Navigate to="/signin" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;

/* 생성한 파일
- App.jsx: React Router를 사용하여 애플리케이션의 라우팅을 설정하는 컴포넌트
- EntryRedirect: 사용자가 로그인 상태인지 확인하고, 로그인 상태에 따라 /feature 또는 /signin으로 리디렉션하는 컴포넌트 
- App: 애플리케이션의 주요 라우팅을 정의하는 컴포넌트
- 다른 파일들과의 관계
- pages: 각 페이지 컴포넌트들을 import하여 라우팅에 사용
- components/protected-route.jsx: 로그인 상태를 확인하고 보호된 라우트를 구현하는 컴포넌트를 import하여 사용
- api/client.js: 토큰 관리를 위한 getToken 함수를 import하여 사용
*/
