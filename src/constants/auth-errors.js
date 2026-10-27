export const AUTH_ERROR_MESSAGES = {
  LOGIN_FAILED: "이메일 또는 비밀번호를 확인해주세요.",
  EMAIL_NOT_VERIFIED: "이메일 인증이 필요합니다.",
  ACCOUNT_PENDING: "관리자 승인을 기다리는 중입니다.",
  ACCOUNT_LOCKED: "계정이 잠겼습니다. 로그인에 10회 실패했습니다.",
  ACCOUNT_INACTIVE: "사용이 중지된 계정입니다. 관리자에게 문의하세요.",
  PASSWORD_REUSED: "최근에 쓴 비밀번호는 다시 쓸 수 없습니다.",
  TOKEN_EXPIRED: "링크가 만료됐습니다.",
  TOKEN_INVALID: "유효하지 않은 링크입니다.",
  TOKEN_ALREADY_USED: "이미 사용한 링크입니다.",
};
export const authErrorMessage = (error) =>
  AUTH_ERROR_MESSAGES[error?.code] ??
  error?.message ??
  "요청을 처리하지 못했습니다.";
