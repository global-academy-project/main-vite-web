import { useRef, useState } from 'react';
import { workTypes } from '../../api/workers';
import { createWork, validatePeriod } from '../../api/jobs';
import JobReferenceSelectors from '../job-reference-selectors';
import Icon from '../ui/icon.jsx';
import { useToast } from '../ui/toast-context.js';

const workZoneEnabled = import.meta.env.VITE_ENABLE_WORK_ZONE_API !== 'false';

/**
 * 작업 직접 등록 (POST /works). 기존 job-workspace.jsx 의 등록 폼과 검사·문구·중복 방지를 그대로 옮겼다.
 *  - 시작·종료가 둘 다 있으면 종료가 뒤여야 함, 인원은 1 이상 정수, 작업명 필수(200자)
 *  - 응답을 못 받았으면(WRITE_OUTCOME_UNKNOWN) 중복 작업을 막으려고 등록을 잠근다
 */
export default function WorkCreateForm({ site, disabled = false, onCreated }) {
  const toast = useToast();
  const [zoneId, setZoneId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [uncertain, setUncertain] = useState(false);
  const pending = useRef(false);

  const create = async (event) => {
    event.preventDefault();
    if (pending.current || disabled || uncertain) return;
    const fields = Object.fromEntries(new FormData(event.currentTarget));
    pending.current = true;
    setBusy(true);
    setError('');
    try {
      if (fields.startAt && fields.endAt) validatePeriod(fields.startAt, fields.endAt);
      const workerCount = fields.workerCount ? Number(fields.workerCount) : null;
      if (workerCount !== null && (!Number.isSafeInteger(workerCount) || workerCount < 1)) {
        throw new Error('작업 인원은 1 이상의 정수로 입력하세요.');
      }
      if (!fields.title.trim()) throw new Error('작업명을 입력하세요.');
      const saved = await createWork({
        siteId: site.siteId, workDate: fields.workDate, title: fields.title.trim(),
        description: fields.description.trim() || null, workType: fields.workType,
        startAt: fields.startAt || null, endAt: fields.endAt || null, workerCount,
        ...(workZoneEnabled ? { zoneId: zoneId ? Number(zoneId) : null } : {}),
      });
      toast.show({ tone: 'success', message: '작업을 저장했습니다. 작업 승인은 별도 절차입니다.' });
      onCreated?.(saved);
    } catch (requestError) {
      if (requestError.code === 'WRITE_OUTCOME_UNKNOWN') setUncertain(true);
      setError(requestError.message || '작업 요청에 실패했습니다.');
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };

  return (
    <form id="work-create-form" className="work-form" onSubmit={create}>
      {error && <p className="work-form__error" role="alert"><Icon name="alert" size={16} />{error}</p>}
      {uncertain && (
        <div className="work-form__error" role="alert">
          <span>작업 생성 결과가 불확실하여 추가 등록을 멈췄습니다. 작업 목록에서 저장됐는지 먼저 확인하세요.</span>
          <button type="button" className="ui-btn ui-btn--ghost" disabled={busy || disabled} onClick={() => {
            if (window.confirm('작업 목록에서 저장 여부를 확인했으며, 새 작업 등록을 진행하시겠습니까? 중복 작업이 생길 수 있습니다.')) { setUncertain(false); setError(''); }
          }}>확인 후 잠금 해제</button>
        </div>
      )}
      <fieldset className="work-form__fields" disabled={disabled || busy || uncertain}>
        <legend className="sr-only">{site.name} 작업 등록</legend>
        <label className="work-form__wide">작업명 <span aria-hidden="true">*</span><input name="title" required maxLength={200} placeholder="예: 저장탱크 주변 용접 작업" /></label>
        <label>작업일 <span aria-hidden="true">*</span><input name="workDate" type="date" max="9999-12-31" required /></label>
        <label>작업 유형<select name="workType">{Object.entries(workTypes).map(([code, label]) => <option key={code} value={code}>{label}</option>)}</select></label>
        {workZoneEnabled && <JobReferenceSelectors siteId={site.siteId} zoneId={zoneId} onChange={(_, value) => setZoneId(value)} disabled={disabled || busy} showTeams={false} />}
        <label>작업 인원<input name="workerCount" type="number" min="1" step="1" inputMode="numeric" /></label>
        <label>시작 일시<input name="startAt" type="datetime-local" max="9999-12-31T23:59" /></label>
        <label>종료 일시<input name="endAt" type="datetime-local" max="9999-12-31T23:59" /></label>
        <label className="work-form__wide">작업 내용<textarea name="description" rows={3} placeholder="작업 범위와 확인할 사항을 입력해 주세요." /></label>
      </fieldset>
      <p className="work-form__help">저장하면 작업 허브로 이동해 위험성평가·허가·TBM을 이어서 작성합니다.</p>
    </form>
  );
}
