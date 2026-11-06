import { useEffect, useRef, useState } from 'react';
import { reloadJobConflict } from '../api/jobs';
import {
  createRiskAssessment, getRiskAssessment, getWorkRiskAssessment, reviseRiskAssessment, submitRiskAssessment, updateRiskAssessment,
} from '../api/risk-assessments';
import { localDate, riskAssessmentBody, riskLevelNotice } from '../utils/job-forms';
import { blankRiskItem, riskItemForForm } from '../utils/risk-model.js';
import { useToast } from '../components/ui/toast-context.js';

/**
 * 위험성평가 상태와 동작. 기존 job-risk-assessment.jsx 의 규칙을 그대로 옮겼다.
 *  - 저장 본문·검사는 job-forms.riskAssessmentBody (빈도·강도 1~5, 개선 후는 둘 다 넣거나 둘 다 비움)
 *  - 409 · 응답 불명(WRITE_OUTCOME_UNKNOWN)이면 다시 불러오기 전까지 저장을 막는다
 *  - 버전 충돌(CONFLICT_MODIFIED)은 최신 기록으로 입력을 바꾸고 알린다 (자동 재저장 안 함)
 *  - 작성 중(DRAFT)이고 결재 대기가 아닐 때만 고칠 수 있다
 * 달라진 점: 주소에 riskId 나 workId 가 있으면 바로 불러온다(작업에 평가가 없으면 새 평가로 시작).
 */
export function useRiskAssessment({ siteId, initialRiskId, initialWorkId, disabled }) {
  const toast = useToast();
  const [risk, setRisk] = useState(null);
  const [workId, setWorkId] = useState(initialWorkId ?? '');
  const [assessDate, setAssessDate] = useState('');
  const [items, setItems] = useState([blankRiskItem(1)]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(Boolean(initialRiskId || initialWorkId));
  const [error, setError] = useState('');
  const [dirty, setDirty] = useState(false);
  const [needsReload, setNeedsReload] = useState(false);
  const pending = useRef(false);
  const locked = Boolean(risk && (risk.status !== 'DRAFT' || risk.approvalStatus === 'PENDING'));

  const applyRisk = (saved) => {
    setRisk(saved);
    setWorkId(String(saved.workId));
    setAssessDate(saved.assessDate);
    setItems(saved.items.length ? saved.items.map(riskItemForForm) : [blankRiskItem(1)]);
    setDirty(false); setNeedsReload(false);
  };

  // 처음 열 때: 평가 번호 → 그 평가, 작업 번호 → 그 작업의 평가 (없으면 새 평가)
  useEffect(() => {
    if (!initialRiskId && !initialWorkId) return undefined;
    let active = true;
    (async () => {
      try {
        const saved = initialRiskId ? await getRiskAssessment(initialRiskId, siteId) : await getWorkRiskAssessment(initialWorkId, siteId);
        if (active) applyRisk(saved);
      } catch (requestError) {
        if (!active) return;
        if (!initialRiskId && requestError.status === 404) { setWorkId(String(initialWorkId)); setAssessDate(localDate()); }
        else setError(requestError.message || '위험성평가를 불러오지 못했습니다.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [initialRiskId, initialWorkId, siteId]);

  const run = async (action, success) => {
    if (pending.current || disabled) return null;
    pending.current = true;
    setBusy(true);
    setError('');
    try {
      const saved = await action();
      if (saved) applyRisk(saved);
      const text = typeof success === 'function' ? success(saved) : success;
      if (text) toast.show({ tone: 'success', message: text });
      return saved;
    } catch (requestError) {
      if (requestError.status === 409 || requestError.code === 'WRITE_OUTCOME_UNKNOWN') setNeedsReload(true);
      setError(requestError.message || '위험성평가 요청에 실패했습니다.');
      if (requestError.code === 'CONFLICT_MODIFIED' && risk) {
        try {
          const latest = await reloadJobConflict(requestError, () => getRiskAssessment(risk.riskAssessmentId, siteId));
          applyRisk(latest);
          toast.show({ tone: 'info', message: '다른 변경과 충돌하여 최신 기록으로 입력을 바꿨습니다. 내용을 확인하고 다시 수정하세요. 자동으로 다시 저장하지 않았습니다.', duration: 8000 });
        } catch (reloadError) { setError(reloadError.message); }
      }
      return null;
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };

  /** 평가 번호 또는 작업 번호로 불러오기 (평가 번호 우선) */
  const load = ({ riskId, workId: work }) => run(
    () => (String(riskId ?? '').trim() ? getRiskAssessment(riskId, siteId) : getWorkRiskAssessment(work, siteId)),
    '위험성평가를 불러왔습니다.',
  );

  const save = () => {
    if (needsReload || locked) return null;
    let payload;
    return run(() => {
      payload = riskAssessmentBody({ risk, siteId, workId, assessDate, items });
      return risk ? updateRiskAssessment(risk.riskAssessmentId, payload, siteId) : createRiskAssessment(payload, siteId);
    }, (saved) => `${risk ? '변경 사항을 저장했습니다.' : '위험성평가 초안을 저장했습니다.'} ${riskLevelNotice(payload, saved)}`.trim());
  };

  const startNew = (work = '') => {
    if (needsReload && !window.confirm('서버 반영 여부를 확인했습니까? 확인 없이 새 평가를 만들면 중복 요청이 될 수 있습니다.')) return;
    setRisk(null); setItems([blankRiskItem(1)]); setAssessDate(localDate()); setWorkId(String(work));
    setDirty(false); setNeedsReload(false); setError('');
  };

  const updateItem = (seq, field, value) => { setItems((current) => current.map((item) => (item.seq === seq ? { ...item, [field]: value } : item))); setDirty(true); };
  const addItem = () => { setItems((current) => [...current, blankRiskItem(current.length + 1)]); setDirty(true); };
  const removeItem = (seq) => { setItems((current) => current.filter((item) => item.seq !== seq).map((item, index) => ({ ...item, seq: index + 1 }))); setDirty(true); };

  return {
    risk, workId, setWorkId: (value) => { setWorkId(value); setDirty(true); }, assessDate, setAssessDate: (value) => { setAssessDate(value); setDirty(true); },
    items, updateItem, addItem, removeItem, busy, loading, error, dirty, needsReload, locked,
    load, save, startNew,
    submit: () => risk && run(() => submitRiskAssessment(risk.riskAssessmentId, siteId), '승인 요청을 보냈습니다. 결과는 승인함 "내 요청"에서 볼 수 있습니다.'),
    revise: () => risk && run(() => reviseRiskAssessment(risk.riskAssessmentId, siteId), '반려된 내용을 옮긴 수정본을 열었습니다. 고친 뒤 다시 승인 요청하세요.'),
  };
}
