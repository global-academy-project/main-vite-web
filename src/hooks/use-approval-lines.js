import { useEffect, useRef, useState } from 'react';
import { getApprovalLines, saveApprovalLine } from '../api/approval-policies.js';
import { normalizeLines, stepsBody } from '../utils/approval-line-model.js';
import { useToast } from '../components/ui/toast-context.js';

/**
 * 현장 결재선 상태와 저장. 현장 설정의 "결재선" 탭을 열 때만 부른다 (다른 탭 요청과 따로).
 *  - 저장 결과를 모르거나(WRITE_OUTCOME_UNKNOWN) 충돌하면(CONFLICT_MODIFIED) 새로고침 전까지 저장을 막는다 (현장 설정 다른 탭과 같은 규칙)
 *  - 저장·되돌리기 뒤에는 서버 목록을 다시 받아 화면을 서버 값으로 맞춘다
 */
export function useApprovalLines({ siteId, canEdit, disabled }) {
  const toast = useToast();
  const [state, setState] = useState({ status: 'loading', lines: [], error: '' });
  const [busy, setBusy] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [revision, setRevision] = useState(0);
  const pending = useRef(false);

  useEffect(() => {
    let active = true;
    // 다시 받는 동안에는 지금 목록을 그대로 둔다 (현장 설정 다른 탭과 같은 방식)
    getApprovalLines(siteId)
      .then((lines) => { if (active) { setState({ status: 'ready', lines: normalizeLines(lines), error: '' }); setBlocked(false); } })
      .catch((error) => { if (active) setState({ status: 'error', lines: [], error: error.message || '결재선을 불러오지 못했습니다.' }); });
    return () => { active = false; };
  }, [siteId, revision]);

  /** steps 가 빈 목록이면 기본 결재선으로 되돌린다. 성공 true / 실패 false */
  const save = async (targetType, steps, success) => {
    if (pending.current || disabled || blocked || !canEdit) return false;
    pending.current = true; setBusy(true);
    try {
      await saveApprovalLine(siteId, targetType, stepsBody(steps));
      toast.show({ tone: 'success', message: success, duration: 5000 });
      setRevision((value) => value + 1);
      return true;
    } catch (error) {
      toast.show({ tone: 'error', message: error.message || '결재선을 저장하지 못했습니다.', duration: 8000 });
      if (error.code === 'WRITE_OUTCOME_UNKNOWN' || error.code === 'CONFLICT_MODIFIED') setBlocked(true);
      return false;
    } finally { pending.current = false; setBusy(false); }
  };

  return {
    ...state, busy, blocked,
    editable: Boolean(canEdit) && !disabled && !blocked && state.status === 'ready',
    reload: () => setRevision((value) => value + 1),
    save,
  };
}
