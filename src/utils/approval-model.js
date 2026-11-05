// 승인함 화면용 순수 함수 (서버 ApprovalSummary · ApprovalDetail · PreviewResponse 값만 쓴다)
import { measurementFields, permitFormFields } from '../api/jobs.js';

export const APPROVAL_STATUS_LABELS = Object.freeze({ PENDING: '승인 대기', APPROVED: '승인 완료', REJECTED: '반려', CANCELED: '회수' });
export const STEP_STATUS_LABELS = Object.freeze({ WAITING: '차례 전', PENDING: '결재 차례', APPROVED: '승인', REJECTED: '반려', SKIPPED: '건너뜀' });
export const APPROVER_ROLE_LABELS = Object.freeze({ APPROVER: '승인자', SITE_ADMIN: '현장 관리자', ADMIN: '회사 관리자' });
export const TARGET_FILTERS = Object.freeze(['PERMIT', 'RISK', 'TBM', 'INSPECTION', 'DAILY_LOG', 'WORK']);

export const approvalTone = (status) => ({ PENDING: 'wait', APPROVED: 'done', REJECTED: 'block', CANCELED: 'neutral' })[status] ?? 'neutral';
export const stepTone = (status) => ({ PENDING: 'current', APPROVED: 'done', REJECTED: 'problem', SKIPPED: 'done', WAITING: 'todo' })[status] ?? 'todo';

/** "2026-11-05T09:20:00" → "11/05 09:20" */
export function shortDateTime(value) {
  if (typeof value !== 'string' || value.length < 16) return '';
  return `${value.slice(5, 7)}/${value.slice(8, 10)} ${value.slice(11, 16)}`;
}

/** 검색 조건: 문서 종류(여러 개), 상태, 기간(요청일), 검색어(제목·요청자) */
export function filterApprovals(rows = [], { types = [], status = '', from = '', to = '', keyword = '' } = {}) {
  const q = keyword.trim().toLowerCase();
  return rows.filter((row) => {
    const date = row.requestedAt?.slice(0, 10) || '';
    return (!types.length || types.includes(row.targetType))
      && (!status || row.status === status)
      && (!from || date >= from)
      && (!to || date <= to)
      && (!q || `${row.title || ''} ${row.requestedByName || ''}`.toLowerCase().includes(q));
  });
}

/** 지연(마감 지남) 먼저, 그다음 마감이 가까운 순, 마감 없으면 요청 순 */
export function sortApprovals(rows = []) {
  return [...rows].sort((a, b) => Number(b.overdue) - Number(a.overdue)
    || String(a.dueAt ?? '9999').localeCompare(String(b.dueAt ?? '9999'))
    || String(a.requestedAt ?? '').localeCompare(String(b.requestedAt ?? '')));
}

/** 숫자 카드 */
export function approvalStats(rows = []) {
  return {
    total: rows.length,
    pending: rows.filter((row) => row.status === 'PENDING').length,
    overdue: rows.filter((row) => row.overdue && row.status === 'PENDING').length,
    rejected: rows.filter((row) => row.status === 'REJECTED').length,
    approved: rows.filter((row) => row.status === 'APPROVED').length,
  };
}

/**
 * 반려 때 고를 누락 항목. 서버는 "measurement.LEL", "form.extinguisher_ready" 같은 키를 받아 반려 이력에 남긴다.
 * 허가서 미리보기(content.permitType)에서 측정 항목·확인 항목으로 만든다. 다른 문서는 고를 항목이 없다.
 */
export function missingItemOptions(preview) {
  const type = preview?.targetType === 'PERMIT' ? preview?.content?.permitType : null;
  if (!type || !measurementFields[type]) return [];
  return [
    ...measurementFields[type].map(({ code, label }) => ({ key: `measurement.${code}`, label: `측정 · ${label}` })),
    ...permitFormFields[type].checks.map(({ code, label }) => ({ key: `form.${code}`, label: `확인 · ${label}` })),
    ...permitFormFields[type].choices.map(({ code, label }) => ({ key: `form.${code}`, label: `확인 · ${label}` })),
  ];
}

/** 다음 결재 단계 (결과 화면용) */
export const nextStep = (detail) => detail?.steps?.find((step) => step.status === 'PENDING') ?? null;

// 서버 측정 단위 코드(MeasurementItem.unit) → 화면 표시
const UNIT_LABELS = Object.freeze({ PCT: '%', PPM: 'ppm', PCT_LEL: '%LEL' });
export const unitLabel = (unit) => UNIT_LABELS[unit] ?? unit ?? '';
