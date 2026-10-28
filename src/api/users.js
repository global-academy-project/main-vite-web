import { api } from "./client";
export const getMe = () => api("/api/v1/users/me");
export const updateMe = (body) =>
  api("/api/v1/users/me", { method: "PATCH", body });
export const changePassword = (body) =>
  api("/api/v1/auth/password/change", { method: "POST", body });
export const requestEmailChange = (newEmail, currentPassword) =>
  api("/api/v1/users/me/email-change", {
    method: "POST",
    body: { newEmail, currentPassword },
  });
export const setLastSite = (siteId) =>
  api("/api/v1/users/me/last-site", { method: "PUT", body: { siteId } });
