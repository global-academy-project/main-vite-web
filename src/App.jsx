import { lazy, Suspense, useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { getToken } from "./api/client";
import { getCachedCurrentUser } from "./api/workers";
import ProtectedRoute from "./components/protected-route";
import Signin from "./pages/users/signin";
import { homePathFor } from "./components/app-shell/nav-config.js";
import ErrorBoundary from "./components/ui/error-boundary.jsx";
import StatusView from "./components/ui/status-view.jsx";
import ToastProvider from "./components/ui/toast-provider.jsx";
import "./styles/ui.css";

// 화면별 지연 로딩: 첫 화면(로그인)만 바로 싣고 나머지는 들어갈 때 받는다
const Register = lazy(() => import("./pages/users/register"));
const RegisterDone = lazy(() => import("./pages/users/register-done"));
const Me = lazy(() => import("./pages/users/me"));
const ChangePassword = lazy(() => import("./pages/users/change-password"));
const ForgotPassword = lazy(() => import("./pages/users/forgot-password"));
const ResetPassword = lazy(() => import("./pages/users/reset-password"));
const VerifyEmail = lazy(() => import("./pages/users/verify-email"));
const VerifyEmailChange = lazy(() => import("./pages/users/verify-email-change"));
const JobSearch = lazy(() => import("./pages/job/job-search"));
const JobDashboard = lazy(() => import("./pages/job/job-dashboard"));
const JobWorkspace = lazy(() => import("./pages/job/job-workspace"));
const DailyChecklist = lazy(() => import("./pages/job/job-daily-checklist"));
const JobIncidents = lazy(() => import("./pages/job/job-incidents"));
const JobPermits = lazy(() => import("./pages/job/job-permits"));
const JobRiskAssessment = lazy(() => import("./pages/job/job-risk-assessment"));
const JobTbm = lazy(() => import("./pages/job/job-tbm"));
const JobDailySafety = lazy(() => import("./pages/job/job-daily-safety"));
const AdminUsers = lazy(() => import("./pages/admin/users"));
const Dashboard = lazy(() => import("./pages/dashboard"));
const ApprovalInbox = lazy(() => import("./pages/approvals/approval-inbox"));
const ApprovalDetail = lazy(() => import("./pages/approvals/approval-detail"));
const ApprovalResult = lazy(() => import("./pages/approvals/approval-result"));
const ApprovalRevision = lazy(() => import("./pages/approvals/approval-revision"));
const RecordSearch = lazy(() => import("./pages/records/record-search"));
const RecordDetail = lazy(() => import("./pages/records/record-detail"));

/** 첫 화면: 로그인 안 했으면 로그인, 했으면 역할별 첫 화면(승인자는 승인함, 나머지는 홈) */
function EntryRedirect() {
  const [target, setTarget] = useState(() => (getToken() ? null : "/signin"));
  useEffect(() => {
    if (target) return undefined;
    let cancelled = false;
    getCachedCurrentUser()
      .then((data) => {
        const site = data.sites.find((item) => item.siteId === data.currentSiteId);
        if (!cancelled) setTarget(homePathFor(data.user?.role, site?.role));
      })
      .catch(() => { if (!cancelled) setTarget("/dashboard"); });
    return () => { cancelled = true; };
  }, [target]);
  if (!target) return <PageLoading />;
  return <Navigate to={target} replace />;
}

function PageLoading() {
  return <main className="page-message"><StatusView kind="loading" title="화면을 불러오는 중입니다" /></main>;
}

/** 화면마다 에러 경계: 한 화면이 실패해도 메뉴 이동으로 다른 화면은 쓸 수 있다 */
function RouteFrame({ children }) {
  const { pathname } = useLocation();
  return (
    <ErrorBoundary resetKeys={[pathname]} title="이 화면을 표시하지 못했습니다">
      <Suspense fallback={<PageLoading />}>{children}</Suspense>
    </ErrorBoundary>
  );
}

const guard = (element) => <ProtectedRoute>{element}</ProtectedRoute>;

function App() {
  return (
    <ToastProvider>
      <BrowserRouter>
        <RouteFrame>
          <Routes>
            <Route path="/" element={<EntryRedirect />} />
            <Route path="/signin" element={<Signin />} />
            <Route path="/register" element={<Register />} />
            <Route path="/register/done" element={<RegisterDone />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/verify-email" element={<VerifyEmail />} />
            <Route path="/verify-email-change" element={<VerifyEmailChange />} />
            <Route path="/me" element={guard(<Me />)} />
            <Route path="/change-password" element={guard(<ChangePassword />)} />
            <Route path="/dashboard" element={guard(<Dashboard />)} />
            <Route path="/job/list" element={guard(<JobSearch />)} />
            <Route path="/job/dashboard" element={guard(<JobDashboard />)} />
            <Route path="/job/workspace" element={guard(<JobWorkspace />)} />
            {/* ROUTE: /approvals | ROLE: APPROVER, SITE_ADMIN, ADMIN | API: approvals/pending */}
            <Route path="/approvals" element={guard(<ApprovalInbox />)} />
            {/* ROUTE: /approvals/:approvalId | FLOW: 승인함 → 상세 → 승인/반려 */}
            <Route path="/approvals/:approvalId" element={guard(<ApprovalDetail />)} />
            <Route path="/approvals/:approvalId/result" element={guard(<ApprovalResult />)} />
            <Route path="/approvals/:approvalId/revision" element={guard(<ApprovalRevision />)} />
            <Route path="/records/search" element={guard(<RecordSearch />)} />
            <Route path="/records/:recordType/:recordId" element={guard(<RecordDetail />)} />
            <Route path="/job/dailey-checklist" element={guard(<DailyChecklist />)} />
            <Route path="/job/incidents" element={guard(<JobIncidents />)} />
            <Route path="/job/permits" element={guard(<JobPermits />)} />
            <Route path="/job/risk-assessment" element={guard(<JobRiskAssessment />)} />
            <Route path="/job/tbm" element={guard(<JobTbm />)} />
            <Route path="/job/daily-safety" element={guard(<JobDailySafety />)} />
            <Route path="/admin/users" element={guard(<AdminUsers />)} />
            <Route path="*" element={<Navigate to="/signin" replace />} />
          </Routes>
        </RouteFrame>
      </BrowserRouter>
    </ToastProvider>
  );
}

export default App;
