import { api } from './client.js';
import { jobId } from './jobs.js';

export const userStatuses = { PENDING: '승인 대기', ACTIVE: '사용 중', INACTIVE: '사용 중지', LOCKED: '잠김' };
const siteRoles = ['WRITER', 'APPROVER', 'SITE_ADMIN'];

function requireUser(user) {
  if (!user || !Number.isSafeInteger(user.userId) || user.userId < 1
    || typeof user.email !== 'string' || typeof user.name !== 'string'
    || !['ADMIN', 'MEMBER'].includes(user.role) || !Object.hasOwn(userStatuses, user.status)
    || typeof user.emailVerified !== 'boolean' || !Array.isArray(user.sites)) {
    throw new Error('관리자 회원 응답 형식이 올바르지 않습니다.');
  }
  return user;
}

function grants(sites) {
  if (!Array.isArray(sites)) throw new Error('현장 권한 목록이 필요합니다.');
  const result = sites.map(({ siteId, role }) => {
    if (!siteRoles.includes(role)) throw new Error('현장 역할이 올바르지 않습니다.');
    return { siteId: jobId(siteId), role };
  });
  if (new Set(result.map((site) => site.siteId)).size !== result.length) {
    throw new Error('같은 현장의 권한을 중복 지정할 수 없습니다.');
  }
  return result;
}

export async function getAdminUsers(status = '') {
  if (status && !Object.hasOwn(userStatuses, status)) throw new Error('회원 상태가 올바르지 않습니다.');
  const data = await api(`/api/v1/admin/users${status ? `?status=${status}` : ''}`);
  if (!Array.isArray(data)) throw new Error('관리자 회원 목록 응답 형식이 올바르지 않습니다.');
  return data.map(requireUser);
}

export async function approveUser(userId, { role, sites }) {
  if (!['ADMIN', 'MEMBER'].includes(role)) throw new Error('계정 역할이 올바르지 않습니다.');
  const permissions = grants(sites);
  if (role === 'MEMBER' && !permissions.length) throw new Error('일반 회원은 현장 권한이 1개 이상 필요합니다.');
  return requireUser(await api(`/api/v1/admin/users/${jobId(userId)}/approve`, {
    method: 'POST', body: { role, sites: permissions },
  }));
}

export async function replaceUserSites(userId, sites) {
  return requireUser(await api(`/api/v1/admin/users/${jobId(userId)}/sites`, {
    method: 'PUT', body: { sites: grants(sites) },
  }));
}

// 계정 관리 (회사 관리자). 서버가 자기 자신·마지막 관리자 보호를 판단한다
const userAction = async (userId, action) => requireUser(await api(`/api/v1/admin/users/${jobId(userId)}/${action}`, { method: 'POST' }));

export async function changeUserRole(userId, role) {
  if (!['ADMIN', 'MEMBER'].includes(role)) throw new Error('계정 역할이 올바르지 않습니다.');
  return requireUser(await api(`/api/v1/admin/users/${jobId(userId)}/role`, { method: 'PUT', body: { role } }));
}
export const unlockUser = (userId) => userAction(userId, 'unlock');
export const verifyUserEmail = (userId) => userAction(userId, 'verify-email');
export const deactivateUser = (userId) => userAction(userId, 'deactivate');
export const reactivateUser = (userId) => userAction(userId, 'reactivate');

/** 임시 비밀번호. 응답으로 한 번만 받는다 (본인은 다음 로그인 때 바꿔야 하고 기존 세션은 끊긴다) */
export async function issueTemporaryPassword(userId) {
  const data = await api(`/api/v1/admin/users/${jobId(userId)}/temporary-password`, { method: 'POST' });
  if (typeof data?.temporaryPassword !== 'string' || !data.temporaryPassword) throw new Error('임시 비밀번호 응답 형식이 올바르지 않습니다.');
  return data.temporaryPassword;
}

// 현장 (회사 관리자): 전체 목록(사용 중지 포함)·등록·이름·모드·사용 중지
export const siteModes = { VERIFY: '검증 모드', GUIDE: '안내 모드' };

function requireSite(site) {
  if (!site || !Number.isSafeInteger(site.siteId) || site.siteId < 1 || typeof site.name !== 'string'
    || !Object.hasOwn(siteModes, site.mode) || typeof site.active !== 'boolean') {
    throw new Error('현장 응답 형식이 올바르지 않습니다.');
  }
  return site;
}

export async function getAdminSites() {
  const data = await api('/api/v1/admin/sites');
  if (!Array.isArray(data)) throw new Error('현장 목록 응답 형식이 올바르지 않습니다.');
  return data.map(requireSite);
}

/** body: { name, mode, active } (active 는 수정 때만) */
export async function saveAdminSite(siteId, body) {
  const name = body.name?.trim();
  if (!name || name.length > 100) throw new Error('현장 이름은 1~100자로 입력하세요.');
  if (!Object.hasOwn(siteModes, body.mode)) throw new Error('현장 모드가 올바르지 않습니다.');
  const path = siteId == null ? '/api/v1/admin/sites' : `/api/v1/admin/sites/${jobId(siteId)}`;
  return requireSite(await api(path, {
    method: siteId == null ? 'POST' : 'PUT', body: { name, mode: body.mode, active: siteId == null ? null : Boolean(body.active) },
  }));
}
