import { useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApprovalReview } from '../../hooks/use-approval-review.js';
import { Badge } from '../home/panel.jsx';
import Icon from '../ui/icon.jsx';
import StatusView, { Skeleton } from '../ui/status-view.jsx';
import { useToast } from '../ui/toast-context.js';
import ApprovalPreview from './approval-preview.jsx';
import {
  APPROVAL_STATUS_LABELS, APPROVER_ROLE_LABELS, approvalTone, missingItemOptions, nextStep, shortDateTime, STEP_STATUS_LABELS, stepTone,
} from '../../utils/approval-model.js';
import { APPROVAL_TARGET_LABELS } from '../../utils/home-model.js';
import { jobRecordPath } from '../../utils/job-forms.js';

/**
 * 결재 한 건 검토: 요청 정보 → 결재선 → 문서 미리보기 → 승인·반려(또는 회수).
 * 승인함 드로어(layout='sheet')와 /approvals/:id 전체 화면(layout='page')이 같이 쓴다. onDecided(latest, action) 로 결과를 알린다.
 */
export default function ApprovalReview({ approvalId, onDecided, layout = 'sheet' }) {
  const review = useApprovalReview(approvalId);
  const toast = useToast();
  const [comment, setComment] = useState('');
  const [missing, setMissing] = useState([]);
  const [touched, setTouched] = useState(false);
  const commentId = useId();

  if (review.status === 'loading') return <div className="appr-review"><Skeleton lines={7} height={18} /></div>;
  if (review.status === 'error') {
    return <StatusView kind={review.errorCode === 403 ? 'forbidden' : 'error'} title={review.errorCode === 404 ? '결재를 찾을 수 없습니다' : undefined} message={review.error} onRetry={review.reload} />;
  }

  const { detail, preview } = review;
  const summary = detail.summary ?? {};
  const options = missingItemOptions(preview);
  const docPath = jobRecordPath(summary.targetType, summary.targetId);
  const next = nextStep(detail);
  const reasonMissing = touched && !comment.trim();

  const act = async (action) => {
    if (action === 'reject') setTouched(true);
    if (action === 'cancel' && !window.confirm('이 승인 요청을 회수하시겠습니까?')) return;
    const latest = await review.decide(action, { comment, missingItems: action === 'reject' ? missing : [] });
    if (!latest) return;
    const status = latest.summary?.status;
    toast.show({
      tone: action === 'reject' ? 'info' : 'success',
      message: action === 'cancel' ? '승인 요청을 회수했습니다.' : action === 'reject' ? '반려했습니다. 요청자에게 알림이 갑니다.' : status === 'APPROVED' ? '최종 승인했습니다.' : '승인했습니다. 다음 단계로 넘어갑니다.',
    });
    setComment(''); setMissing([]); setTouched(false);
    onDecided?.(latest, action);
  };

  const mainBlock = (
    <>
      <header className="appr-review__head">
        <div className="appr-review__badges">
          <Badge tone="info">{APPROVAL_TARGET_LABELS[summary.targetType] ?? summary.targetType}</Badge>
          <Badge tone={approvalTone(summary.status)}>{APPROVAL_STATUS_LABELS[summary.status] ?? summary.status}</Badge>
          {summary.overdue && summary.status === 'PENDING' && <Badge tone="block"><Icon name="clock" size={12} />지연</Badge>}
          {summary.selfApproval && <Badge tone="warn">자기 승인</Badge>}
        </div>
        <h3 className="appr-review__title">{summary.title || preview?.title || `${summary.targetType} #${summary.targetId}`}</h3>
        <dl className="appr-facts">
          <div><dt>요청자</dt><dd>{summary.requestedByName || '-'}</dd></div>
          <div><dt>요청 시각</dt><dd>{shortDateTime(summary.requestedAt) || '-'}</dd></div>
          <div><dt>마감</dt><dd className={summary.overdue ? 'is-overdue' : ''}>{shortDateTime(summary.dueAt) || '없음'}</dd></div>
          <div><dt>현재 단계</dt><dd>{summary.status === 'PENDING' ? `${summary.currentStep}/${summary.totalSteps} ${summary.currentStepLabel ?? ''}` : '-'}</dd></div>
        </dl>
        {docPath && <Link className="appr-review__doc" to={docPath}><Icon name="external" size={14} />문서 화면 열기</Link>}
      </header>

      <section className="appr-block" aria-labelledby={`${commentId}-line`}>
        <h4 id={`${commentId}-line`} className="appr-block__title">결재선</h4>
        <ol className="appr-line">
          {detail.steps?.map((step) => (
            <li key={step.stepNo} className={`appr-line__step appr-line__step--${stepTone(step.status)}`}>
              <span className="appr-line__dot" aria-hidden="true">{step.status === 'APPROVED' ? <Icon name="check" size={12} strokeWidth={3} /> : step.status === 'REJECTED' ? '!' : step.stepNo}</span>
              <div className="appr-line__body">
                <p className="appr-line__label"><strong>{step.label}</strong> <span>{APPROVER_ROLE_LABELS[step.requiredRole] ?? step.requiredRole}</span></p>
                <p className="appr-line__meta">{STEP_STATUS_LABELS[step.status] ?? step.status}{step.decidedByName ? ` · ${step.decidedByName}` : ''}{step.decidedAt ? ` · ${shortDateTime(step.decidedAt)}` : ''}</p>
                {step.comment && <p className="appr-line__comment">{step.comment}</p>}
              </div>
            </li>
          ))}
        </ol>
        {detail.missingItems?.length > 0 && (
          <div className="appr-missing-list"><strong>반려 때 고른 누락 항목</strong><ul>{detail.missingItems.map((key) => <li key={key}>{options.find((o) => o.key === key)?.label ?? key}</li>)}</ul></div>
        )}
      </section>

      <section className="appr-block" aria-labelledby={`${commentId}-preview`}>
        <h4 id={`${commentId}-preview`} className="appr-block__title">문서 미리보기</h4>
        {preview ? <ApprovalPreview preview={preview} /> : <StatusView kind="error" compact title="미리보기를 불러오지 못했습니다" message={review.previewError} onRetry={review.reload} />}
      </section>

    </>
  );
  const actionBlock = (
    <>
      {detail.canDecide && (
        <section className="appr-block appr-decide" aria-labelledby={`${commentId}-decide`}>
          <h4 id={`${commentId}-decide`} className="appr-block__title">결재 처리</h4>
          <div className={`ui-field${reasonMissing ? ' ui-field--error' : ''}`}>
            <label className="ui-field__label" htmlFor={commentId}>의견 <span className="appr-hint">반려할 때는 사유 필수 · 500자</span></label>
            <textarea id={commentId} className="ui-field__input" rows={3} maxLength={500} value={comment} aria-invalid={reasonMissing || undefined} aria-describedby={`${commentId}-help`}
              placeholder="승인 의견 또는 반려 사유" onChange={(event) => setComment(event.target.value)} />
            <span id={`${commentId}-help`} className="ui-field__help">{reasonMissing ? '반려 사유를 입력해 주세요.' : `${comment.length}/500`}</span>
          </div>
          {options.length > 0 && (
            <fieldset className="appr-missing-pick">
              <legend>누락 항목 <span className="appr-hint">반려할 때 선택 · 요청자에게 그대로 보입니다</span></legend>
              {options.map((option) => (
                <label key={option.key} className="appr-missing-pick__item">
                  <input type="checkbox" checked={missing.includes(option.key)} onChange={(event) => setMissing((value) => (event.target.checked ? [...value, option.key] : value.filter((key) => key !== option.key)))} />
                  {option.label}
                </label>
              ))}
            </fieldset>
          )}
          {review.actionError && <p className="work-form__error" role="alert"><Icon name="alert" size={16} />{review.actionError}</p>}
          <div className="appr-decide__actions">
            <button type="button" className="ui-btn ui-btn--danger ui-btn--lg" disabled={Boolean(review.busy)} onClick={() => act('reject')}>{review.busy === 'reject' ? '반려 중…' : '반려(보완 요청)'}</button>
            <button type="button" className="ui-btn ui-btn--primary ui-btn--lg" disabled={Boolean(review.busy)} onClick={() => act('approve')}>{review.busy === 'approve' ? '승인 중…' : '승인'}</button>
          </div>
        </section>
      )}

      {!detail.canDecide && summary.status !== 'PENDING' && (
        <div className={`appr-result appr-result--${approvalTone(summary.status)}`} role="status">
          <Icon name={summary.status === 'APPROVED' ? 'check' : 'info'} size={18} />
          <span><strong>{APPROVAL_STATUS_LABELS[summary.status]}</strong>{summary.comment ? ` · ${summary.comment}` : ''}</span>
        </div>
      )}
      {!detail.canDecide && summary.status === 'PENDING' && next && (
        <div className="appr-result appr-result--wait" role="status"><Icon name="clock" size={18} /><span><strong>{next.label}</strong> 결재를 기다리고 있습니다 ({APPROVER_ROLE_LABELS[next.requiredRole] ?? next.requiredRole})</span></div>
      )}

      {detail.canCancel && (
        <div className="appr-cancel">
          {review.actionError && !detail.canDecide && <p className="work-form__error" role="alert"><Icon name="alert" size={16} />{review.actionError}</p>}
          <button type="button" className="ui-btn ui-btn--ghost" disabled={Boolean(review.busy)} onClick={() => act('cancel')}>{review.busy === 'cancel' ? '회수 중…' : '승인 요청 회수'}</button>
        </div>
      )}
    </>
  );

  // 전체 화면(넓을 때): 왼쪽 본문 · 오른쪽 결재 처리(따라 내려옴). 드로어·좁은 화면: 한 줄로 쌓는다
  if (layout === 'page') {
    return (
      <div className="appr-review appr-review--page">
        <section className="home-panel appr-review__main">{mainBlock}</section>
        <aside className="home-panel appr-review__side" aria-label="결재 처리">{actionBlock}</aside>
      </div>
    );
  }
  return <div className="appr-review">{mainBlock}{actionBlock}</div>;
}
