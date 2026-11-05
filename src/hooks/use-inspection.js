import { useCallback, useEffect, useRef, useState } from 'react';
import { createInspection, getInspection, getInspectionTemplates, getSiteEquipment, getSiteInspections, saveInspection, submitInspection } from '../api/inspections';
import { getJobZones } from '../api/job-reference';
import { reloadJobConflict } from '../api/jobs';
import { answerCounts, answersOf, changedAnswers, diffCodes, expectedResult } from '../utils/inspection-model.js';
import { useToast } from '../components/ui/toast-context.js';

/**
 * 점검표 상태와 동작.
 *  - 날짜를 바꾸면 그날 점검표 목록을 조회하고, 주소의 inspectionId 가 있으면 그 점검표 날짜로 옮겨 고른다
 *  - 결과는 화면에서 고친 뒤 "저장"으로 바뀐 항목만 보낸다(불량은 내용이 있어야 보낸다). 제출 전 저장 안 한 내용이 있으면 먼저 저장
 *  - 409·응답 불명이면 새로고침 전까지 쓰기를 막고, 버전 충돌이면 최신 점검표로 바꿔 알린다(자동 재저장 없음)
 *  - 작성 중(DRAFT)일 때만 고칠 수 있다. 반려되면 서버가 작성 중으로 되돌린다
 */
export function useInspection({ siteId, disabled, initialId, initialDate }) {
  const toast = useToast();
  const [date, setDate] = useState(initialDate);
  const [records, setRecords] = useState([]);
  const [selectedId, setSelectedId] = useState(initialId ?? '');
  const [answers, setAnswers] = useState({});
  const [listState, setListState] = useState({ key: null, error: '' });
  const [revision, setRevision] = useState(0);
  const [refs, setRefs] = useState({ key: null, templates: [], zones: [], equipment: [], error: '' });
  const [needsReload, setNeedsReload] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef(false);
  const wanted = useRef(initialId ?? '');
  const jump = useRef(Boolean(initialId));

  const listKey = `${siteId}:${date}:${revision}`;
  const loading = listState.key !== listKey;
  const selected = records.find((record) => String(record.inspectionId) === String(selectedId)) ?? null;
  const editable = selected?.status === 'DRAFT';
  const dirty = Boolean(selected) && diffCodes(selected, answers).length > 0;

  const pick = useCallback((record) => {
    setSelectedId(record ? String(record.inspectionId) : '');
    setAnswers(answersOf(record));
  }, []);
  const replace = (saved) => {
    setRecords((current) => (current.some((record) => record.inspectionId === saved.inspectionId)
      ? current.map((record) => (record.inspectionId === saved.inspectionId ? saved : record)) : [saved, ...current]));
    pick(saved);
  };

  // 양식·구역·설비 (만들기에 쓴다)
  const refsKey = String(siteId);
  useEffect(() => {
    let active = true;
    Promise.allSettled([getInspectionTemplates(), getJobZones(siteId), getSiteEquipment(siteId)]).then(([templates, zones, equipment]) => {
      if (!active) return;
      const failed = [templates, zones, equipment].find((entry) => entry.status === 'rejected');
      setRefs({
        key: refsKey, templates: templates.value ?? [], zones: zones.value ?? [], equipment: (equipment.value ?? []).filter((entry) => entry.active !== false),
        error: failed ? failed.reason?.message || '점검표 기준 정보를 불러오지 못했습니다.' : '',
      });
    });
    return () => { active = false; };
  }, [siteId, refsKey]);

  // 날짜의 점검표 목록. 처음 주소에 inspectionId 가 있으면 그 점검표의 날짜로 옮긴다
  useEffect(() => {
    let active = true;
    const load = async () => {
      if (jump.current) {
        jump.current = false;
        const target = await getInspection(wanted.current, siteId);
        if (target.inspectDate !== date) return { moveTo: target.inspectDate };
      }
      return { list: await getSiteInspections(siteId, date) };
    };
    load().then((result) => {
      if (!active) return;
      if (result.moveTo) { setDate(result.moveTo); return; }
      setRecords(result.list);
      const current = result.list.find((record) => String(record.inspectionId) === String(wanted.current));
      pick(current ?? result.list[0] ?? null);
      setNeedsReload(false);
      setListState({ key: listKey, error: '' });
    }).catch((requestError) => { if (active) setListState({ key: listKey, error: requestError.message || '점검표 목록을 불러오지 못했습니다.' }); });
    return () => { active = false; };
  }, [siteId, date, listKey, pick]);

  const showWriteError = async (requestError, fallback) => {
    if (requestError.status === 409 || requestError.code === 'WRITE_OUTCOME_UNKNOWN') setNeedsReload(true);
    setError(requestError.message || fallback);
    toast.show({ tone: 'error', message: requestError.message || fallback, duration: 8000 });
    if (requestError.code === 'CONFLICT_MODIFIED' && selected) {
      try {
        const latest = await reloadJobConflict(requestError, () => getInspection(selected.inspectionId, siteId));
        replace(latest); setNeedsReload(false); setError('');
        toast.show({ tone: 'info', message: '다른 변경과 충돌하여 최신 점검표로 바꿨습니다. 화면에서 고친 결과는 저장되지 않았으니 다시 입력하세요.', duration: 9000 });
      } catch (reloadError) { setError(reloadError.message); }
    }
  };

  const write = async (action, fallback) => {
    if (pending.current || disabled || needsReload) return false;
    pending.current = true; setBusy(true); setError('');
    try { await action(); return true; } catch (requestError) { await showWriteError(requestError, fallback); return false; } finally { pending.current = false; setBusy(false); }
  };

  const persist = async () => {
    const items = changedAnswers(selected, answers);
    if (!items.length) return selected;
    const saved = await saveInspection(selected.inspectionId, { lockVersion: selected.lockVersion, items }, siteId);
    // 내용 없는 불량처럼 아직 보내지 못한 항목은 화면에 남겨 둔다
    const unsent = Object.fromEntries(diffCodes(selected, answers).filter((code) => !items.some((item) => item.itemCode === code))
      .map((code) => [code, answers[code]]));
    setRecords((current) => current.map((record) => (record.inspectionId === saved.inspectionId ? saved : record)));
    setAnswers({ ...answersOf(saved), ...unsent });
    return saved;
  };

  const save = () => {
    if (!selected || !editable) return Promise.resolve(false);
    const counts = answerCounts(answers);
    return write(async () => {
      await persist();
      toast.show({ tone: 'success', message: counts.missingNote ? `저장했습니다. 내용이 없는 불량 ${counts.missingNote}개는 내용을 적어야 저장됩니다.` : '점검 결과를 저장했습니다.', duration: 6000 });
    }, '점검 결과를 저장하지 못했습니다.');
  };

  const submit = () => {
    if (!selected || !editable) return Promise.resolve(false);
    const counts = answerCounts(answers);
    if (counts.answered < counts.total) { setError(`결과를 적지 않은 항목이 ${counts.total - counts.answered}개 있습니다.`); return Promise.resolve(false); }
    if (counts.missingNote) { setError(`불량 항목 ${counts.missingNote}개에 내용을 적어 주세요.`); return Promise.resolve(false); }
    return write(async () => {
      await persist();
      const saved = await submitInspection(selected.inspectionId, siteId);
      replace(saved);
      toast.show({ tone: 'success', message: '점검표를 제출했습니다. 승인함에서 확인하며, 승인 완료를 뜻하지 않습니다.', duration: 7000 });
    }, '점검표를 제출하지 못했습니다.');
  };

  /** form: { targetType, templateCode, zoneId, equipmentId, inspectDate, workId } */
  const create = (form) => write(async () => {
    const body = {
      targetType: form.targetType, templateCode: form.templateCode, inspectDate: form.inspectDate,
      zoneId: form.zoneId ? Number(form.zoneId) : null, equipmentId: form.targetType === 'EQUIPMENT' && form.equipmentId ? Number(form.equipmentId) : null,
      workId: form.workId ? Number(form.workId) : null,
    };
    if (body.targetType === 'EQUIPMENT' && !form.zoneId) body.zoneId = null;
    const saved = await createInspection(siteId, body);
    if (saved.inspectDate !== date) { wanted.current = String(saved.inspectionId); setDate(saved.inspectDate); }
    replace(saved);
    toast.show({ tone: 'success', message: '점검표를 만들었습니다. 항목별 결과를 적고 저장하세요.', duration: 6000 });
  }, '점검표를 만들지 못했습니다.');

  const setResult = (itemCode, result) => {
    if (!editable) return;
    setAnswers((current) => ({ ...current, [itemCode]: { ...current[itemCode], result: current[itemCode]?.result === result ? null : result } }));
  };
  const setNote = (itemCode, note) => {
    if (!editable) return;
    setAnswers((current) => ({ ...current, [itemCode]: { ...current[itemCode], note } }));
  };

  const guard = (action) => {
    if (dirty) { toast.show({ tone: 'info', message: '저장하지 않은 점검 결과가 있습니다. 저장하거나 "변경 취소" 후 이동하세요.', duration: 6000 }); return; }
    action();
  };

  return {
    date, changeDate: (next) => guard(() => { if (next) { wanted.current = ''; setDate(next); } }),
    records, loading, listError: loading ? '' : listState.error,
    reload: () => guard(() => { wanted.current = selectedId; setRevision((value) => value + 1); }),
    selected, select: (record) => guard(() => { wanted.current = String(record.inspectionId); pick(record); }),
    answers, setResult, setNote, reset: () => setAnswers(answersOf(selected)),
    counts: answerCounts(answers), expected: expectedResult(answers), dirty, editable,
    refs: refs.key === refsKey ? refs : { templates: [], zones: [], equipment: [], error: '', loading: true },
    needsReload, busy, error, clearError: () => setError(''), locked: disabled || busy || loading || needsReload,
    save, submit, create,
  };
}
