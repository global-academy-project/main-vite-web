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
