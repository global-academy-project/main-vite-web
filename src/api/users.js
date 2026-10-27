import { api } from "./client";
export const getMe = () => api("/api/v1/users/me");
export const updateMe = (body) =>
  api("/api/v1/users/me", { method: "PATCH", body });
export const changePassword = (body) =>
  api("/api/v1/users/me/password", { method: "PUT", body });
export const requestEmailChange = (newEmail) =>
  api("/api/v1/users/me/email-change", { method: "POST", body: { newEmail } });
export const setLastSite = (siteId) =>
  api("/api/v1/users/me/last-site", { method: "PUT", body: { siteId } });
