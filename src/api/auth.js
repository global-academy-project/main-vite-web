import { api } from "./client";
export const signIn = (body) =>
  api("/api/v1/auth/login", { method: "POST", body, skipRefresh: true });
export const signUp = (body) =>
  api("/api/v1/auth/signup", { method: "POST", body, skipRefresh: true });
export const logout = () =>
  api("/api/v1/auth/logout", { method: "POST", skipRefresh: true });
export const verifyEmail = (token) =>
  api("/api/v1/auth/email/verify", {
    method: "POST",
    body: { token },
    skipRefresh: true,
  });
export const resendVerification = (email) =>
  api("/api/v1/auth/email/verify/resend", {
    method: "POST",
    body: { email },
    skipRefresh: true,
  });
export const forgotPassword = (email) =>
  api("/api/v1/auth/password/forgot", {
    method: "POST",
    body: { email },
    skipRefresh: true,
  });
export const resetPassword = (token, newPassword) =>
  api("/api/v1/auth/password/reset", {
    method: "POST",
    body: { token, newPassword },
    skipRefresh: true,
  });
