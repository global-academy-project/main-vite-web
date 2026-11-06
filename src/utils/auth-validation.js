// 로그인·회원가입 입력 검사 (서버 SignupRequest · ChangePasswordRequest 와 같은 규칙. 최종 판단은 서버)

export const validPassword = (value) =>
  value.length >= 8 &&
  value.length <= 64 &&
  /[A-Za-z]/.test(value) &&
  /\d/.test(value) &&
  /[^A-Za-z0-9]/.test(value);

/** 입력하는 동안 보여 줄 비밀번호 규칙 체크 */
export function passwordChecks(value = '') {
  return [
    { key: 'length', label: '8~64자', ok: value.length >= 8 && value.length <= 64 },
    { key: 'letter', label: '영문', ok: /[A-Za-z]/.test(value) },
    { key: 'digit', label: '숫자', ok: /\d/.test(value) },
    { key: 'symbol', label: '특수문자', ok: /[^A-Za-z0-9]/.test(value) },
  ];
}

export const validEmail = (value = '') => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()) && value.trim().length <= 255;

/** 전화번호: 숫자만 입력받는다(하이픈·공백·문자는 입력 단계에서 막음). 서버는 0으로 시작하는 9~11자리 */
export const PHONE_MAX = 11;
export const digitsOnly = (value = '') => value.replace(/\D/g, '').slice(0, PHONE_MAX);
export const normalizePhone = digitsOnly;
export const validPhone = (value = '') => !value || /^0[0-9]{8,10}$/.test(value);

/**
 * 이름: 한글만 2~10자 (공백·영문·숫자·기호 불가). 서버는 1~50자를 받지만 웹에서 더 좁게 받는다.
 * 입력 중에는 조합 중인 자모(ㄱ, ㅏ …)도 남겨 둬야 한글을 칠 수 있으므로 걸러 내는 것은 한글 외 글자만.
 */
export const NAME_MIN = 2;
export const NAME_MAX = 10;
export const koreanOnly = (value = '') => value.replace(/[^가-힣ㄱ-ㅎㅏ-ㅣ]/g, '').slice(0, NAME_MAX);
export function nameError(value = '') {
  if (!value) return '이름을 입력하세요.';
  if (/[ㄱ-ㅎㅏ-ㅣ]/.test(value)) return '완성된 한글로 입력하세요.';
  if (!/^[가-힣]+$/.test(value)) return '이름은 한글만 입력할 수 있습니다.';
  if (value.length < NAME_MIN || value.length > NAME_MAX) return `이름은 ${NAME_MIN}~${NAME_MAX}자로 입력하세요.`;
  return '';
}

/** 회원가입 검사 + 본문. 문제 있으면 { errors } */
export function signupBody(form) {
  const errors = {};
  const email = form.email.trim();
  const name = form.name.trim();
  const phone = form.phone ?? '';
  if (!validEmail(email)) errors.email = 'name@company.com 같은 이메일 형식으로 입력하세요.';
  if (nameError(name)) errors.name = nameError(name);
  if (!validPassword(form.password)) errors.password = '비밀번호 규칙을 모두 지켜 주세요.';
  if (form.password !== form.passwordConfirm) errors.passwordConfirm = '비밀번호가 서로 다릅니다.';
  if (!/^\d*$/.test(phone)) errors.phone = '숫자만 입력하세요. 하이픈(-)은 넣지 않습니다.';
  else if (!validPhone(phone)) errors.phone = '0으로 시작하는 9~11자리 숫자로 입력하세요.';
  if ((form.department ?? '').trim().length > 100) errors.department = '100자 이하로 입력하세요.';
  if ((form.jobTitle ?? '').trim().length > 50) errors.jobTitle = '50자 이하로 입력하세요.';
  if (Object.keys(errors).length) return { errors };
  return {
    body: {
      email, name, password: form.password, phone: phone || null,
      department: form.department?.trim() || null, jobTitle: form.jobTitle?.trim() || null,
    },
  };
}

// 마지막으로 로그인한 이메일 (이 브라우저에만). 막힌 환경이면 그냥 기억하지 않는다
const LAST_EMAIL = 'last-login-email';
export function readLastEmail() {
  try { return window.localStorage.getItem(LAST_EMAIL) ?? ''; } catch { return ''; }
}
export function writeLastEmail(email) {
  try { if (email) window.localStorage.setItem(LAST_EMAIL, email); else window.localStorage.removeItem(LAST_EMAIL); } catch { /* 기억 못 해도 로그인은 된다 */ }
}

/** 전화번호 세 칸(3·4·4) ↔ 숫자만 이어 붙인 값. 10자리는 3·3·4 로 나눈다 */
export const PHONE_PARTS = [3, 4, 4];
export function splitPhone(value = '') {
  const digits = digitsOnly(value);
  if (digits.length === 10) return [digits.slice(0, 3), digits.slice(3, 6), digits.slice(6)];
  return [digits.slice(0, 3), digits.slice(3, 7), digits.slice(7, 11)];
}
export const joinPhone = (parts) => parts.map((part) => digitsOnly(part)).join('');
/** 칸별 검사: 다 비면 미입력(통과), 하나라도 쓰면 첫 칸 0으로 시작 3자리 · 가운데 3~4자리 · 끝 4자리 */
export function phonePartsError(parts) {
  const [a, b, c] = parts.map((part) => part ?? '');
  if (!a && !b && !c) return '';
  if (!/^0\d{2}$/.test(a)) return '첫 칸은 0으로 시작하는 3자리입니다 (예: 010).';
  if (!/^\d{3,4}$/.test(b)) return '가운데 칸은 3~4자리입니다.';
  if (!/^\d{4}$/.test(c)) return '마지막 칸은 4자리입니다.';
  return '';
}
