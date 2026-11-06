// 내 정보 화면 입력 검사 (서버 UpdateMeRequest · ChangePasswordRequest 와 같은 규칙. 최종 판단은 서버)
import { validPassword } from './auth-validation.js';

export const profileForm = (user) => ({
  name: user?.name ?? '', phone: user?.phone ?? '', department: user?.department ?? '', jobTitle: user?.jobTitle ?? '',
});

/** 내 정보 본문 (lockVersion 은 부르는 쪽이 붙인다). 문제 있으면 { errors } */
export function profileBody(form) {
  const errors = {};
  const name = form.name.trim();
  const phone = form.phone.replaceAll('-', '').trim();
  if (!name || name.length > 50) errors.name = '이름은 1~50자로 입력하세요.';
  if (phone && !/^0[0-9]{8,10}$/.test(phone)) errors.phone = '숫자만, 0으로 시작하는 9~11자리로 입력하세요. 하이픈은 빼고 저장합니다.';
  if (form.department.trim().length > 100) errors.department = '100자 이하로 입력하세요.';
  if (form.jobTitle.trim().length > 50) errors.jobTitle = '50자 이하로 입력하세요.';
  if (Object.keys(errors).length) return { errors };
  return { body: { name, phone, department: form.department.trim(), jobTitle: form.jobTitle.trim() } };
}

export const sameProfile = (a, b) => ['name', 'phone', 'department', 'jobTitle'].every((key) => (a[key] ?? '').trim() === (b[key] ?? '').trim());

export function passwordBody({ currentPassword, newPassword, confirm }) {
  const errors = {};
  if (!currentPassword) errors.currentPassword = '현재 비밀번호를 입력하세요.';
  if (!validPassword(newPassword)) errors.newPassword = '영문·숫자·특수문자를 각각 포함한 8~64자로 입력하세요.';
  else if (newPassword === currentPassword) errors.newPassword = '현재 비밀번호와 다르게 입력하세요.';
  if (newPassword !== confirm) errors.confirm = '새 비밀번호와 확인이 다릅니다.';
  if (Object.keys(errors).length) return { errors };
  return { body: { currentPassword, newPassword } };
}

export function emailBody({ newEmail, currentPassword }, currentEmail) {
  const errors = {};
  const email = newEmail.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.newEmail = '이메일 주소 형식으로 입력하세요.';
  else if (email.toLowerCase() === (currentEmail ?? '').toLowerCase()) errors.newEmail = '지금 쓰는 이메일과 같습니다.';
  if (!currentPassword) errors.currentPassword = '현재 비밀번호를 입력하세요.';
  if (Object.keys(errors).length) return { errors };
  return { body: { newEmail: email, currentPassword } };
}

/** 알림 설정에서 바뀐 종류만 */
export const changedPreferences = (saved, current) => current.filter((entry) => {
  const before = saved.find((item) => item.type === entry.type);
  return !before || before.webEnabled !== entry.webEnabled || before.smsEnabled !== entry.smsEnabled;
});
