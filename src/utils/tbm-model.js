// TBM 화면 계산 (React 없이 테스트할 수 있게 분리)

export const TBM_STATE_LABELS = Object.freeze({ DRAFT: '작성 중', DONE: '실시 완료', APPROVED: '승인' });

/** 표시용 상태: 확인 요청 중이면 그것이 먼저 */
export function tbmStatusLabel(tbm) {
  if (!tbm) return '새 TBM';
  if (tbm.approvalStatus === 'PENDING') return '확인 요청 중';
  return TBM_STATE_LABELS[tbm.status] ?? tbm.status;
}

/** 단계: 작성 → 참석자 → 실시 완료 → 확인 요청 → 승인 */
export function tbmSteps(tbm, { attendeesSaved = false, attendeeTotal = 0 } = {}) {
  const status = tbm?.status;
  const pending = tbm?.approvalStatus === 'PENDING';
  const done = status === 'DONE' || status === 'APPROVED';
  return [
    { key: 'write', label: '작성', state: tbm ? 'done' : 'current', hint: tbm ? `TBM #${tbm.tbmId}` : '새 TBM' },
    { key: 'attendees', label: '참석자', state: !tbm ? 'todo' : done || (attendeesSaved && attendeeTotal > 0) ? 'done' : 'current', hint: tbm ? `${attendeeTotal}명${attendeesSaved ? '' : ' · 저장 안 됨'}` : '' },
    { key: 'held', label: '실시 완료', state: done ? 'done' : tbm && attendeesSaved && attendeeTotal > 0 ? 'current' : 'todo', hint: tbm?.heldAt ? tbm.heldAt.replace('T', ' ').slice(11, 16) : '' },
    { key: 'request', label: '확인 요청', state: pending || status === 'APPROVED' ? 'done' : status === 'DONE' ? 'current' : 'todo', hint: pending ? '요청함' : '' },
    { key: 'approve', label: '승인', state: status === 'APPROVED' ? 'done' : pending ? 'current' : 'todo', hint: status === 'APPROVED' ? '완료' : pending ? '대기' : '' },
  ];
}

/** 연결 작업 번호 문자열 ↔ 목록 (tbmContentBody 는 "31, 32" 문자열을 받는다) */
export const parseWorkIds = (text) => String(text ?? '').split(',').map((part) => part.trim()).filter((part) => /^\d+$/.test(part));
export function toggleWorkId(text, workId, checked) {
  const ids = parseWorkIds(text).filter((id) => id !== String(workId));
  if (checked) ids.push(String(workId));
  return ids.join(', ');
}

/** 참석자 건강 상태 수 */
export function healthCounts(attendees = []) {
  return {
    ok: attendees.filter((person) => person.healthOk === true).length,
    bad: attendees.filter((person) => person.healthOk === false).length,
    unknown: attendees.filter((person) => person.healthOk == null).length,
  };
}
