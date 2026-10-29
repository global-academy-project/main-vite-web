import { useEffect, useRef, useState } from 'react';
import JobWorkForm from './job-work-form';
import { checkWorkRules } from '../../api/workers';

const measurements = {
  HOT: [{ code: 'LEL', label: '가연성가스 (% LEL)' }],
  CONFINED: [
    { code: 'O2', label: '산소 (%)' },
    { code: 'CO2', label: '탄산가스 (%)' },
    { code: 'CO', label: '일산화탄소 (ppm)' },
    { code: 'H2S', label: '황화수소 (ppm)' },
  ],
  HEIGHT: [],
};

function PermitFields({ siteId, selecting }) {
  const [type, setType] = useState('HOT');
  const [values, setValues] = useState({});
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);
  const revision = useRef(0);
  const mounted = useRef(false);
  const pending = useRef(false);
  const selectionInProgress = useRef(selecting);
  useEffect(() => {
    selectionInProgress.current = selecting;
    revision.current += 1;
  }, [selecting]);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const invalidate = () => {
    revision.current += 1;
    setResult(null);
    setError('');
  };
  const check = async () => {
    if (pending.current || selecting) return;
    const measurement = {};
    for (const { code } of measurements[type]) {
      const raw = values[code]?.trim();
      if (!raw) continue;
      const number = Number(raw);
      if (!Number.isFinite(number) || number < 0) {
        setError('측정값은 0 이상의 숫자로 입력해 주세요.');
        return;
      }
      measurement[code] = number;
    }
    const requestedRevision = revision.current;
    pending.current = true;
    setChecking(true);
    setError('');
    setResult(null);
    try {
      const data = await checkWorkRules({ siteId, workType: type, input: { measurement } });
      if (!['PASS', 'WARN', 'BLOCK'].includes(data?.result)
        || !Number.isInteger(data.rulesApplied) || data.rulesApplied < 0
        || !Array.isArray(data.violations) || !Array.isArray(data.unusedFields)) {
        throw new Error('규칙 판정 응답 형식이 올바르지 않습니다.');
      }
      if (mounted.current && revision.current === requestedRevision && !selectionInProgress.current) setResult(data);
    } catch (requestError) {
      if (mounted.current && revision.current === requestedRevision) setError(requestError.message || '규칙 판정을 요청하지 못했습니다.');
    } finally {
      pending.current = false;
      if (mounted.current) setChecking(false);
    }
  };

  return (
    <div onChange={invalidate}>
      <div className="job-fields">
        <label>작업명<input required placeholder="작업 조회 API 연결 전 수기 메모" /></label>
        <label>허가 유형<select value={type} onChange={(event) => { setType(event.target.value); setValues({}); }}><option value="HOT">화기</option><option value="CONFINED">밀폐공간</option><option value="HEIGHT">고소</option></select></label>
        <label>작업 장소<input required /></label>
        <label>작업 인원<input required type="number" min="1" step="1" /></label>
        <label>시작 일시<input required type="datetime-local" /></label>
        <label>종료 일시<input required type="datetime-local" /></label>
        <label>작업책임자 메모<input required /></label>
        <label>위험물·취급 물질 메모<input /></label>
      </div>
      <fieldset key={type}>
        <legend>허가 유형별 확인 사항</legend>
        <div className="job-fields">
          {measurements[type].map(({ code, label }) => (
            <label key={code}>{label}<input type="number" min="0" step="any" value={values[code] ?? ''} onChange={(event) => setValues((current) => ({ ...current, [code]: event.target.value }))} placeholder="미입력은 누락으로 판정" /></label>
          ))}
          {type === 'HOT' && <label>화재감시자 메모<input required /></label>}
          {type === 'CONFINED' && <><label>감시인 메모<input required /></label><label>환기·호흡 보호구<textarea required /></label></>}
          {type === 'HEIGHT' && <><label>작업 높이 (m)<input type="number" min="0" step="any" required /></label><label>추락방지 조치<input required /></label></>}
        </div>
      </fieldset>
      <p className="job-help">현재 연결은 측정값 규칙의 미리 확인만 수행합니다. 작업·감시자·보호구 메모는 판정이나 저장에 사용하지 않습니다. 작업·구역·작업자 ID 연결, 측정 단계(PRE_WORK/DURING/POST_WORK), 확인사항 저장은 별도 API가 필요합니다.</p>
      <button type="button" className="job-secondary-button" disabled={checking || selecting} onClick={check}>{checking ? '규칙 확인 중...' : '측정값 규칙 미리 확인'}</button>
      <p className="job-help">빈 측정값을 0으로 대체하지 않습니다. 등록된 규칙이 없는 항목은 검증되지 않으며, 이 결과로 허가를 승인하거나 작업을 시작할 수 없습니다.</p>
      {error && <p className="dashboard-error" role="alert">{error}</p>}
      {result && (
        <section className="job-example" aria-label="규칙 미리 확인 결과" role="status">
          <h2>{result.rulesApplied === 0 ? '판정 불가: 적용 규칙 없음' : `미리 확인: ${{ PASS: '등록된 규칙 내 위반 없음', WARN: '주의', BLOCK: '차단' }[result.result]}`}</h2>
          <p>적용 규칙 {result.rulesApplied}건 · 판정 기록은 저장되지 않았습니다.</p>
          <p className="job-help">화기·고소 등 미등록 규칙은 PASS 응답이어도 안전 확인 완료가 아닙니다. 최종 승인은 권한 있는 사람이 수행해야 합니다.</p>
          {result.violations.map((violation, index) => (
            <div className="job-demo-notice" key={`${violation.ruleCode}-${index}`}>
              <strong>{violation.severity} · {violation.message}</strong>
              <p>{violation.target}: {violation.actual ?? '미입력'} / 기준: {violation.expected}</p>
              <p>조치: {violation.action}</p>
              <p>근거: {violation.legalBasis}</p>
              {/^https?:\/\//i.test(violation.sourceUrl ?? '') && <a href={violation.sourceUrl} target="_blank" rel="noreferrer">근거 원문</a>}
            </div>
          ))}
          {result.unusedFields.length > 0 && <p className="job-help">등록된 규칙에서 사용하지 않은 입력: {result.unusedFields.join(', ')}</p>}
        </section>
      )}
    </div>
  );
}

export default function JobPermits() {
  return (
    <JobWorkForm title="작업허가" description="현장을 선택하고 측정값의 등록된 규칙을 미리 확인합니다.">
      {({ currentSite, selecting }) => <PermitFields key={currentSite?.siteId ?? 'no-site'} siteId={currentSite?.siteId} selecting={selecting} />}
    </JobWorkForm>
  );
}
