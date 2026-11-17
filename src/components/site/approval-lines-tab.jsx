import { useId, useState } from 'react';
import { Badge } from '../home/panel.jsx';
import Icon from '../ui/icon.jsx';
import Sheet from '../ui/sheet.jsx';
import StatusView, { Skeleton } from '../ui/status-view.jsx';
import { confirmAction } from '../ui/confirm-store.js';
import { useApprovalLines } from '../../hooks/use-approval-lines.js';
import {
  DEFAULT_STEP, MAX_LABEL, MAX_STEPS, moveStep, ROLE_ORDER, roleLabel, sameSteps, targetLabel, validateSteps, verifyModeNote,
} from '../../utils/approval-line-model.js';

/**
 * 현장 설정 · 결재선 탭: 이 현장에서 문서 종류마다 몇 단계로, 어떤 역할이 승인하는지.
 * 바꾸면 그다음 승인 요청부터 적용되고, 이미 올라간 결재는 요청 때의 결재선을 그대로 쓴다.
 * 단계는 역할 기준이다 (사람 지정 아님). 자기 승인 허용 여부는 현장 운영 모드가 정한다.
 */
export default function ApprovalLinesTab({ siteId, canEdit, disabled, mode }) {
  const data = useApprovalLines({ siteId, canEdit, disabled });
  const [editing, setEditing] = useState(null);

  return (
    <section className="home-panel tbm-card" aria-labelledby="approval-lines-title">
      <header className="tbm-card__head">
        <div>
          <h2 id="approval-lines-title">결재선 {data.status === 'ready' && <span className="home-panel__count">{data.lines.length}</span>}</h2>
          <p className="rec-help">문서 종류마다 몇 단계로, 어떤 역할이 승인하는지 정합니다. 바꾸면 다음 승인 요청부터 적용되고, 이미 올라간 결재는 그대로입니다.</p>
        </div>
      </header>
      {data.blocked && (
        <div className="work-form__error site-pad" role="alert"><Icon name="warning" size={16} /><span>저장 결과를 확인해야 합니다. 새로고침으로 서버 값을 확인한 뒤 계속하세요.</span>
          <button type="button" className="ui-btn ui-btn--ghost" onClick={data.reload}>새로고침</button></div>
      )}
      {data.status === 'loading' && <div className="site-pad"><Skeleton lines={5} /></div>}
      {data.status === 'error' && <StatusView kind="error" compact message={data.error} onRetry={data.reload} />}
      {data.status === 'ready' && !data.lines.length && <StatusView kind="empty" compact title="결재선을 정할 수 있는 문서가 없습니다" />}
      {data.status === 'ready' && data.lines.length > 0 && (
        <div className="site-table-wrap">
          <table className="site-table appr-lines">
            <thead><tr><th scope="col">문서</th><th scope="col">결재 단계</th><th scope="col">설정</th><th scope="col"><span className="sr-only">바꾸기</span></th></tr></thead>
            <tbody>
              {data.lines.map((line) => (
                <tr key={line.targetType}>
                  <th scope="row" data-label="문서">{targetLabel(line.targetType)}</th>
                  <td data-label="결재 단계">
                    <ol className="appr-lines__steps" aria-label={`${targetLabel(line.targetType)} 결재 단계`}>
                      {line.steps.map((step, index) => (
                        <li key={step.stepNo}>
                          {index > 0 && <Icon name="chevronRight" size={14} className="appr-lines__arrow" />}
                          <span className="appr-lines__step"><b>{index + 1}</b>{step.label}<small>{roleLabel(step.requiredRole)}</small></span>
                        </li>
                      ))}
                    </ol>
                  </td>
                  <td data-label="설정">{line.defaultLine ? <Badge tone="neutral">기본</Badge> : <Badge tone="info">현장 설정</Badge>}</td>
                  <td className="site-table__act">
                    <button type="button" className="ui-btn ui-btn--ghost site-edit" disabled={!data.editable || data.busy}
                      onClick={() => setEditing(line)}>바꾸기</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <EditSheet line={editing} data={data} mode={mode} onClose={() => setEditing(null)} />
    </section>
  );
}

function EditSheet({ line, data, mode, onClose }) {
  if (!line) return <Sheet open={false} onClose={onClose} title="" />;
  return <EditForm key={line.targetType} line={line} data={data} mode={mode} onClose={onClose} />;
}

function EditForm({ line, data, mode, onClose }) {
  const formId = useId();
  const [steps, setSteps] = useState(() => line.steps.map(({ label, requiredRole }) => ({ label, requiredRole })));
  const [touched, setTouched] = useState(false);
  const check = validateSteps(steps);
  const changed = !sameSteps(steps, line.steps);
  const name = targetLabel(line.targetType);
  const note = verifyModeNote(steps, mode);
  const locked = !data.editable || data.busy;

  const update = (index, field, value) => setSteps((current) => current.map((step, i) => (i === index ? { ...step, [field]: value } : step)));
  const add = () => setSteps((current) => [...current, { ...DEFAULT_STEP, requiredRole: current[current.length - 1]?.requiredRole ?? DEFAULT_STEP.requiredRole }]);
  const submit = async (event) => {
    event.preventDefault();
    setTouched(true);
    if (check.message || !changed) return;
    if (await data.save(line.targetType, steps, `${name} 결재선을 저장했습니다. 다음 승인 요청부터 적용됩니다.`)) onClose();
  };
  const reset = async () => {
    if (!(await confirmAction({ title: `${name} 결재선을 기본으로 되돌릴까요?`, message: '1단계 · 승인 · 승인자로 돌아갑니다. 이미 올라간 결재는 그대로입니다.', confirmLabel: '되돌리기' }))) return;
    if (await data.save(line.targetType, [], `${name} 결재선을 기본으로 되돌렸습니다.`)) onClose();
  };

  return (
    <Sheet open onClose={onClose} title={`${name} 결재선`} subtitle={line.defaultLine ? '기본 결재선' : '현장 설정'}
      footer={<>
        {!line.defaultLine && <button type="button" className="ui-btn ui-btn--ghost appr-lines__reset" disabled={locked} onClick={reset}>기본으로 되돌리기</button>}
        <button type="button" className="ui-btn ui-btn--ghost" onClick={onClose}>취소</button>
        <button type="submit" form={formId} className="ui-btn ui-btn--primary ui-btn--lg" disabled={locked || !changed}>저장</button>
      </>}>
      <form id={formId} className="appr-lines__form" onSubmit={submit} noValidate>
        <p className="rec-help">위에서부터 차례로 승인합니다. 뒤 단계 역할은 앞 단계보다 낮을 수 없습니다 (승인자 → 현장 관리자 → 회사 관리자). 단계는 역할 기준이며, 그 역할 이상이면 누구나 결재할 수 있습니다.</p>
        <fieldset disabled={locked} className="appr-lines__list">
          <legend className="sr-only">{name} 결재 단계</legend>
          {steps.map((step, index) => {
            const error = touched || step.label !== (line.steps[index]?.label ?? DEFAULT_STEP.label) ? check.errors[index] : '';
            const roleError = Boolean(error) && error.includes('역할');
            return (
              <div key={index} className={`appr-lines__row${error ? ' is-error' : ''}`}>
                <span className="appr-lines__no" aria-hidden="true">{index + 1}</span>
                <label className="appr-lines__field"><span className="sr-only">{index + 1}단계 이름</span>
                  <input value={step.label} maxLength={MAX_LABEL} placeholder="단계 이름 (예: 현장 확인)" aria-invalid={(Boolean(error) && !roleError) || undefined}
                    onChange={(event) => update(index, 'label', event.target.value)} /></label>
                <label className="appr-lines__field appr-lines__role"><span className="sr-only">{index + 1}단계 역할</span>
                  <select value={step.requiredRole} aria-invalid={roleError || undefined} onChange={(event) => update(index, 'requiredRole', event.target.value)}>
                    {ROLE_ORDER.map((role) => <option key={role} value={role}>{roleLabel(role)}</option>)}
                  </select></label>
                <div className="appr-lines__tools">
                  <button type="button" className="ui-icon-btn" aria-label={`${index + 1}단계 위로`} disabled={index === 0} onClick={() => setSteps((current) => moveStep(current, index, -1))}><Icon name="chevronUp" size={16} /></button>
                  <button type="button" className="ui-icon-btn" aria-label={`${index + 1}단계 아래로`} disabled={index === steps.length - 1} onClick={() => setSteps((current) => moveStep(current, index, 1))}><Icon name="chevronDown" size={16} /></button>
                  <button type="button" className="ui-icon-btn" aria-label={`${index + 1}단계 빼기`} disabled={steps.length === 1} onClick={() => setSteps((current) => current.filter((_, i) => i !== index))}><Icon name="close" size={16} /></button>
                </div>
                {error && <p className="appr-lines__error" role="alert">{error}</p>}
              </div>
            );
          })}
          <button type="button" className="ui-btn ui-btn--ghost appr-lines__add" disabled={steps.length >= MAX_STEPS} onClick={add}>
            단계 추가 <span className="rec-help">({steps.length}/{MAX_STEPS})</span></button>
        </fieldset>
        {touched && check.message && <p className="work-form__error" role="alert"><Icon name="alert" size={16} />{check.message}</p>}
        {note && <p className="rec-note"><Icon name="info" size={16} />{note}</p>}
      </form>
    </Sheet>
  );
}
