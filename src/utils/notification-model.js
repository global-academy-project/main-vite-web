// 알림함 화면 계산 (React 없이 테스트할 수 있게 분리)
import { jobRecordPath } from './job-forms.js';

export const NOTIFICATION_TYPE_LABELS = Object.freeze({
  APPROVAL_REQUEST: '승인 요청', APPROVAL_RESULT: '승인 결과', BLOCKED: '작업 차단',
  NEAR_MISS_WARNING: '아차사고 경고', DEADLINE: '마감', ACTION_DUE: '조치 기한',
  AGENT_DONE: 'AI 처리 완료', DOCUMENT_READY: '문서 준비', JOB_FAILED: '작업 실패', ACCOUNT: '계정', SYSTEM: '시스템',
});

// 심각도 → 색·아이콘·읽는 말
export const SEVERITY = Object.freeze({
  CRITICAL: { tone: 'block', icon: 'warning', label: '긴급' },
  WARN: { tone: 'wait', icon: 'alert', label: '주의' },
  INFO: { tone: 'info', icon: 'info', label: '안내' },
});
export const severityOf = (severity) => SEVERITY[severity] ?? SEVERITY.INFO;

/** 배지 숫자: 0 은 숨김(null), 100 이상은 99+ */
export function badgeText(count) {
  if (!Number.isSafeInteger(count) || count < 1) return null;
  return count > 99 ? '99+' : String(count);
}

const pad = (value) => String(value).padStart(2, '0');
const dayStart = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
const parse = (value) => {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
};

/** 0 = 오늘, 1 = 어제, 2 = 그 이전 (날짜를 못 읽으면 2) */
export function dayBucket(value, now = new Date()) {
  const date = parse(value);
  if (!date) return 2;
  const diff = Math.round((dayStart(now) - dayStart(date)) / 86400000);
  return diff <= 0 ? 0 : diff === 1 ? 1 : 2;
}

/** 방금 · N분 전 · 오늘 HH:mm · 어제 HH:mm · M/D HH:mm */
export function relativeTime(value, now = new Date()) {
  const date = parse(value);
  if (!date) return '';
  const minutes = Math.floor((now.getTime() - date.getTime()) / 60000);
  const clock = `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  if (minutes > -5 && minutes < 1) return '방금'; // 서버·PC 시계가 조금 어긋나 미래로 보여도 방금
  if (minutes >= 1 && minutes < 60) return `${minutes}분 전`;
  const bucket = dayBucket(value, now);
  if (bucket === 0) return `오늘 ${clock}`;
  if (bucket === 1) return `어제 ${clock}`;
  return `${date.getMonth() + 1}/${date.getDate()} ${clock}`;
}

const GROUP_LABELS = ['오늘', '어제', '이전'];

/** 오늘 / 어제 / 이전 묶음. 빈 묶음은 뺀다. 각 묶음 안의 순서는 서버 순서를 지킨다 */
export function groupNotifications(items, now = new Date()) {
  const groups = GROUP_LABELS.map((label) => ({ label, items: [] }));
  for (const item of items) groups[dayBucket(item.createdAt, now)].items.push(item);
  return groups.filter((group) => group.items.length);
}

/**
 * 알림을 눌렀을 때 갈 곳. 결재 알림은 승인함 드로어(요청은 결재 대기, 결과는 내 요청)로 바로 연다.
 * 나머지는 기존 기록 경로(jobRecordPath). 갈 곳이 없으면 null.
 */
export function notificationTarget(notification) {
  const { type, targetType, targetId } = notification;
  if (targetType === 'APPROVAL' && Number.isSafeInteger(targetId) && targetId > 0) {
    const tab = type === 'APPROVAL_RESULT' ? 'requested' : 'pending';
    return { path: `/approvals?tab=${tab}&open=${targetId}`, label: type === 'APPROVAL_RESULT' ? '결과 보기' : '검토하기' };
  }
  const path = jobRecordPath(targetType, targetId);
  return path ? { path, label: '열기' } : null;
}

/** 현장 이름 (계정 현장 목록에 없으면 현장 #id) */
export function siteLabel(siteId, sites = []) {
  if (siteId == null) return '';
  return sites.find((site) => site.siteId === siteId)?.name ?? `현장 #${siteId}`;
}
