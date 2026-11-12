import { useEffect, useRef, useState } from 'react';
import {
  checkPermit, createPermit, editablePermitStatuses, getPermit, getWork, hasMeasurementItems, measurementItems,
  requireWork, saveMeasurements, stepForPermit, submitPermit, updatePermit, validatePeriod, applyPermitExtraction, extractRuleInput, measurementFields,
} from '../api/jobs';
import { useToast } from '../components/ui/toast-context.js';
import { MAX_FILL_TEXTS, extractFill, mergeFill, remainingCodes } from '../utils/extract-model.js';

const EMPTY_FORM = { validFrom: '', validTo: '', watcherName: '', supervisorName: '', form: {} };

/**
 * 작업허가 4단계(작성 → 측정값 → 규칙 판정 → 승인 요청) 상태와 동작. 기존 job-permits.jsx 의 PermitWorkspace 를 그대로 옮겼다.
 *  - 버전 충돌·상태 오류·응답 불명이면 다시 불러오기 전까지 수정·판정·승인 요청을 막는다(conflict)
 *  - 새 허가서 저장 응답을 못 받으면 중복 생성을 막으려고 등록을 잠근다(creationUncertain)
 *  - 판정은 응답이 사라져도 저장됐을 수 있어 판정 전에 conflict 로 두고, 다시 받아 확인한다
 *  - 저장하지 않은 내용·측정값이 있으면 다른 허가서를 열기 전에 확인한다
 * 화면 안내 문구(message)는 토스트로 보인다. 오류는 단계 안에 남는다.
 */
export function usePermitWorkspace({ siteId, disabled, initialWorkId, initialPermitId, initialType }) {
  const toast = useToast();
  const [workId, setWorkId] = useState(initialWorkId ?? '');
  const [form, setForm] = useState(EMPTY_FORM);
  const [permit, setPermit] = useState(null);
  const [values, setValues] = useState({});
  const [dirty, setDirty] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [evaluation, setEvaluation] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(Boolean(initialPermitId));
  const [creationUncertain, setCreationUncertain] = useState(false);
  const [step, setStep] = useState(1);
  // 허가 유형: 저장된 허가서 → 사용자가 고른 값 → 작업 종류로 정한 기본값 → 화기
  const [chosenType, setChosenType] = useState(null);
  const type = permit?.permitType ?? chosenType ?? initialType ?? 'HOT';
  const mounted = useRef(false);
  const pending = useRef(false);
  const applyRef = useRef(null);
  const say = (message) => { if (message) toast.show({ tone: 'success', message, duration: 6000 }); };

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const apply = (saved) => {
    setPermit(saved);
    setWorkId(String(saved.workId));
    setForm({
      validFrom: saved.validFrom, validTo: saved.validTo,
      watcherName: saved.watcherName ?? '', supervisorName: saved.supervisorName ?? '',
      form: saved.form ?? {},
    });
    setDirty(false);
    setConflict(false);
    setValues({});
    setEvaluation(null);
    setCreationUncertain(false);
  };
  useEffect(() => { applyRef.current = apply; });

  // 주소에 permitId 가 있으면 바로 불러와 이어서 할 단계로 간다
  useEffect(() => {
    if (initialPermitId == null || initialPermitId === '') return undefined;
    let active = true;
    (async () => {
      try {
        const saved = await getPermit(initialPermitId, siteId);
        if (active) { applyRef.current?.(saved); setStep(stepForPermit(saved)); }
      } catch (requestError) {
        if (active) setError(requestError.message || '허가서를 불러오지 못했습니다.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [initialPermitId, siteId]);

  const run = async (action) => {
    if (pending.current || disabled) return;
    pending.current = true;
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (requestError) {
      if (mounted.current) {
        const mustReload = ['CONFLICT_MODIFIED', 'INVALID_STATE', 'WRITE_OUTCOME_UNKNOWN'].includes(requestError.code);
        if (mustReload && permit) { setConflict(true); setEvaluation(null); }
        if (requestError.code === 'WRITE_OUTCOME_UNKNOWN' && !permit) setCreationUncertain(true);
        setError(`${requestError.message || '허가서 요청에 실패했습니다.'}${mustReload && permit ? ' 최신 허가서를 다시 불러온 뒤 수정하세요.' : ''}`);
      }
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
  };

  const measurementDirty = Object.values(values).some((value) => String(value).trim());
  const confirmReplacement = () => !(dirty || measurementDirty) || window.confirm('저장하지 않은 내용과 측정값을 버리고 계속하시겠습니까?');

  const load = (id) => {
    if (!confirmReplacement()) return undefined;
    return run(async () => {
      const saved = await getPermit(id, siteId);
      if (mounted.current) { apply(saved); setFill(null); setStep(stepForPermit(saved)); say('서버의 허가서를 불러왔습니다. 이어서 할 단계로 이동했습니다.'); }
    });
  };
  const goTo = (next) => { setError(''); setStep(next); };
  const update = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setDirty(true);
    setEvaluation(null);
  };
  const changeType = (next) => {
    if (!confirmReplacement()) return;
    setChosenType(next); update('form', {}); setValues({}); setFill(null);
  };
  const setMeasurement = (code, value) => { setValues((current) => ({ ...current, [code]: value })); setError(''); };

  // 말·문장으로 채우기: 서버가 뽑은 값으로 칸을 채우고(저장 전), 무엇이 빠졌는지는 서버 미리 판정을 그대로 보여 준다
  // 11/12: 문장을 나눠 이어서 채울 수 있다. 결과는 앞 문장과 합치고(mergeFill), 저장 때 보낸 문장을 모두 기록한다
  const [fill, setFill] = useState(null); // mergeFill 결과 (texts·text 포함)
  const [extracting, setExtracting] = useState(false);
  const fillFromText = async (text) => {
    const clean = String(text ?? '').trim();
    if (!clean || extracting || disabled) return null;
    if ((fill?.texts?.length ?? 0) >= MAX_FILL_TEXTS) {
      setError(`문장으로 채우기는 ${MAX_FILL_TEXTS}번까지입니다. 남은 칸은 아래에 직접 입력해 주세요.`);
      return null;
    }
    setExtracting(true); setError('');
    try {
      const result = extractFill(await extractRuleInput({ siteId, text: clean, workType: type }), type, measurementFields[type] ?? []);
      if (!mounted.current) return null;
      setValues((current) => ({ ...current, ...result.values }));
      setFill((current) => mergeFill(current, result, clean));
      return result;
    } catch (requestError) {
      if (mounted.current) setError(requestError.message || '문장에서 값을 뽑지 못했습니다. 칸에 직접 입력해 주세요.');
      return null;
    } finally {
      if (mounted.current) setExtracting(false);
    }
  };

  const hasMeasurements = hasMeasurementItems(type);
  const editable = !permit || editablePermitStatuses.includes(permit.status);
  const currentEvaluation = evaluation ?? permit?.lastEvaluation;
  const visibleChecks = !dirty && !measurementDirty && !conflict ? evaluation?.checks : undefined;
  const noApplicableRules = evaluation?.rulesApplied === 0;
  const serverDisallowsSubmit = permit?.status === 'DRAFT' && permit.lastEvaluation && !permit.canSubmit && !noApplicableRules;
  const submitted = Boolean(permit && !editable);
  const saved = permit && !dirty && !conflict;
  const reachable = {
    1: true,
    2: Boolean(saved && hasMeasurements),
    3: Boolean(saved && !measurementDirty && (!hasMeasurements || permit.measurements.length > 0 || submitted)),
    4: Boolean(saved && !measurementDirty && (submitted || (permit.canSubmit && !noApplicableRules))),
  };
  const blocked = evaluation ? evaluation.checks.filter((item) => item.status !== 'PASS') : (permit?.lastEvaluation?.violations ?? []);

  const save = () => {
    if (conflict || creationUncertain) return;
    if (permit && !dirty) { goTo(hasMeasurements ? 2 : 3); return; }
    void run(async () => {
      validatePeriod(form.validFrom, form.validTo);
      const body = { ...form, watcherName: form.watcherName.trim() || null, supervisorName: form.supervisorName.trim() || null };
      let result;
      if (permit) result = await updatePermit(permit.permitId, { ...body, lockVersion: permit.lockVersion }, siteId);
      else {
        const work = requireWork(await getWork(workId), siteId);
        result = await createPermit({ ...body, workId: work.workId, permitType: type }, siteId);
      }
      if (mounted.current) {
        apply(result);
        setStep(hasMeasurementItems(result.permitType) ? 2 : 3);
        say(hasMeasurementItems(result.permitType) ? '허가서를 저장했습니다. 작업 전 측정값을 입력하세요.' : '허가서를 저장했습니다. 이 유형은 측정 항목이 없어 바로 규칙 판정 단계로 왔습니다.');
      }
    });
  };

  const saveMeasurementsAndNext = () => {
    if (!measurementDirty) {
      if (permit.measurements.length === 0) { setError('측정값을 하나 이상 입력해 주세요.'); return; }
      goTo(3);
      return;
    }
    void run(async () => {
      const items = measurementItems(type, values);
      // 문장으로 채운 경우: 원문·추출값 기록이 함께 남도록 추출 반영 API 로 저장 (측정값 저장은 같다)
      const result = fill?.text
        ? await applyPermitExtraction(permit.permitId, { lockVersion: permit.lockVersion, text: fill.text, texts: fill.texts?.length > 1 ? fill.texts : undefined, measurements: items }, siteId)
        : await saveMeasurements(permit.permitId, items, siteId);
      if (mounted.current) { apply(result); setFill(null); setStep(3); say('측정값을 저장했습니다. 기존 측정값은 이력으로 남고 최근 판정은 무효가 되었습니다. 규칙 판정을 실행하세요.'); }
    });
  };

  const runCheck = () => run(async () => {
    // 판정은 응답이 사라져도 저장됐을 수 있다
    if (mounted.current) { setConflict(true); setEvaluation(null); }
    const checked = await checkPermit(permit.permitId);
    const result = await getPermit(permit.permitId, siteId);
    if (mounted.current) {
      apply(result); setEvaluation(checked.evaluation);
      say(result.canSubmit ? '판정을 저장했습니다. 통과했으니 다음 단계에서 승인 요청하세요. 판정은 최종 안전 승인이 아닙니다.' : '판정을 저장했습니다. 막힌 항목을 고친 뒤 다시 판정하세요.');
    }
  });

  const submit = () => run(async () => {
    if (noApplicableRules) throw new Error('등록된 판정 규칙이 없는 허가서는 승인 요청할 수 없습니다.');
    const result = await submitPermit(permit.permitId, siteId);
    if (mounted.current) { apply(result); say('승인 요청을 보냈습니다. 승인 완료나 작업 시작 허가가 아닙니다. 결과는 승인함 "내 요청"에서 볼 수 있습니다.'); }
  });

  const startNew = () => {
    if (!confirmReplacement()) return false;
    setPermit(null); setForm(EMPTY_FORM); setValues({}); setFill(null); setDirty(false);
    setConflict(false); setCreationUncertain(false); setEvaluation(null); setError('');
    setStep(1);
    return true;
  };

  return {
    workId, setWorkId: (value) => { setWorkId(value); setDirty(true); }, type, changeType,
    form, update, permit, values, setMeasurement,
    discardMeasurements: () => { setValues({}); setFill(null); }, fill, fillFromText, extracting, clearFill: () => setFill(null), dirty, measurementDirty, conflict, evaluation, currentEvaluation, visibleChecks,
    remaining: remainingCodes(fill, values, measurementFields[type] ?? []), // 문장으로 채운 뒤 아직 비어 있는 필수 칸
    noApplicableRules, serverDisallowsSubmit, submitted, reachable, blocked, error, busy, loading, creationUncertain,
    unlockCreation: () => { setCreationUncertain(false); setError(''); },
    step, goTo, hasMeasurements, editable, locked: busy || disabled,
    load, save, saveMeasurementsAndNext, runCheck, submit, startNew,
  };
}
