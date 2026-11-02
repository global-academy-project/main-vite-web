import { api } from './client.js';
import { jobId, jobWrite } from './jobs.js';

const path = '/api/v1/notifications';
const types = ['APPROVAL_REQUEST', 'APPROVAL_RESULT', 'BLOCKED', 'NEAR_MISS_WARNING', 'DEADLINE',
  'ACTION_DUE', 'AGENT_DONE', 'DOCUMENT_READY', 'JOB_FAILED', 'ACCOUNT', 'SYSTEM'];
const count = (data) => {
  if (!Number.isSafeInteger(data?.unreadCount) || data.unreadCount < 0) {
    throw new Error('안 읽은 알림 수 응답 형식이 올바르지 않습니다.');
  }
  return data.unreadCount;
};
const item = (data) => {
  if (!data || !Number.isSafeInteger(data.id) || data.id < 1 || typeof data.title !== 'string'
    || typeof data.message !== 'string' || !types.includes(data.type)
    || !['INFO', 'WARN', 'CRITICAL'].includes(data.severity)) {
    throw new Error('알림 응답 형식이 올바르지 않습니다.');
  }
  return data;
};
const preferences = (data) => {
  if (!Array.isArray(data) || !data.every((entry) => entry && types.includes(entry.type)
    && ['webEnabled', 'smsEnabled', 'mandatory'].every((field) => typeof entry[field] === 'boolean'))) {
    throw new Error('알림 설정 응답 형식이 올바르지 않습니다.');
  }
  return data;
};

export const getUnreadCount = async () => count(await api(`${path}/unread-count`));
export async function getNotifications({ siteId, unreadOnly = false } = {}) {
  const query = new URLSearchParams({ unreadOnly: String(unreadOnly) });
  if (siteId != null) query.set('siteId', String(jobId(siteId)));
  const data = await api(`${path}?${query}`);
  count(data);
  if (!Array.isArray(data?.items)) throw new Error('알림 목록 응답 형식이 올바르지 않습니다.');
  return { ...data, items: data.items.map(item) };
}
export async function readNotification(id) {
  const url = `${path}/${jobId(id)}/read`;
  return jobWrite(async () => item(await api(url, { method: 'POST' })));
}
export const readAllNotifications = () =>
  jobWrite(async () => count(await api(`${path}/read-all`, { method: 'POST' })));
export async function dismissNotification(id) {
  const url = `${path}/${jobId(id)}/dismiss`;
  return jobWrite(() => api(url, { method: 'POST' }));
}
export const getNotificationPreferences = async () => preferences(await api(`${path}/preferences`));
export async function saveNotificationPreferences(changes) {
  preferences(changes);
  if (changes.length > 20 || changes.some((entry) => entry.mandatory && !entry.webEnabled)) {
    throw new Error('설정은 20종 이하이며 안전 필수 웹 알림은 끌 수 없습니다.');
  }
  return jobWrite(async () => preferences(await api(`${path}/preferences`, { method: 'PUT', body: changes })));
}
