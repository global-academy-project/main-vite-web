const TOKEN_KEY = "accessToken";
const TOKEN_EXPIRY_KEY = "accessTokenExpiresAt";

export const getToken = () => {
  const token = localStorage.getItem(TOKEN_KEY);
  const expiresAt = Number(localStorage.getItem(TOKEN_EXPIRY_KEY));
  if (token && expiresAt && Date.now() >= expiresAt) {
    clearToken();
    return null;
  }
  return token;
};

export const setToken = (token, expiresIn = 3600) => {
  const seconds = Number(expiresIn);
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(
    TOKEN_EXPIRY_KEY,
    String(Date.now() + (Number.isFinite(seconds) && seconds > 0 ? seconds : 3600) * 1000),
  );
};

export const clearToken = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(TOKEN_EXPIRY_KEY);
};

export class ApiError extends Error {
  constructor(code, message, details, status) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.details = details;
    this.status = status;
  }
}

const TIMEOUT_MS = 30000;

export async function api(
  path,
  { method = "GET", body, headers = {}, responseType = "json" } = {},
) {
  const token = getToken();
  const isForm = body instanceof FormData;
  let response;

  try {
    response = await fetch(path, {
      method,
      headers: {
        ...(body && !isForm ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      body: body ? (isForm ? body : JSON.stringify(body)) : undefined,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    throw new ApiError("NETWORK_ERROR", "서버에 연결할 수 없습니다.", null, 0);
  }

  let payload = null;
  if (!response.ok || responseType === "json") {
    try {
      payload = await response.clone().json();
    } catch {
      if (response.ok && responseType === "json") {
        throw new ApiError("INVALID_RESPONSE", "서버 응답을 처리할 수 없습니다.", null, response.status);
      }
    }
  }

  if (!response.ok || payload?.success === false) {
    const error = payload?.error ?? {};
    if (response.status === 401) {
      clearToken();
      if (window.location.pathname !== "/signin") {
        window.location.assign("/signin");
      }
    }
    throw new ApiError(
      error.code ?? "INTERNAL_ERROR",
      error.message ?? `요청에 실패했습니다. (HTTP ${response.status})`,
      error.details ?? null,
      response.status,
    );
  }

  if (responseType === "json" && (payload?.success !== true || !Object.prototype.hasOwnProperty.call(payload, "data"))) {
    throw new ApiError("INVALID_RESPONSE", "서버 응답 형식이 올바르지 않습니다.", null, response.status);
  }

  if (responseType === "response") return response;
  if (responseType === "blob") return response.blob();
  if (responseType === "text") return response.text();
  return payload && Object.prototype.hasOwnProperty.call(payload, "data")
    ? payload.data
    : payload;
}

export function getCurrentUser() {
  return api("/api/v1/users/me");
}
