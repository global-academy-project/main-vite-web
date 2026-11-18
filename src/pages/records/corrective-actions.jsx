import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import SafetyPageLayout from '../../components/safety-page-layout';
import PageHeader from '../../components/ui/page-header.jsx';
import { Badge } from '../../components/home/panel.jsx';
import Icon from '../../components/ui/icon.jsx';
import Sheet from '../../components/ui/sheet.jsx';
import StatusView, { Skeleton } from '../../components/ui/status-view.jsx';
import { confirmAction } from '../../components/ui/confirm-store.js';
import { useToast } from '../../components/ui/toast-context.js';
import {
  createCorrectiveAction, getCorrectiveAction, getCorrectiveAssignees, listCorrectiveActions,
  stepCorrectiveAction, updateCorrectiveAction,
} from '../../api/corrective-actions.js';
import { reloadJobConflict } from '../../api/jobs.js';
import {
  ACTION_FILTERS, ACTION_SOURCE_LABELS, ACTION_STATUS_LABELS, ACTION_STATUS_TONES, actionButtons, sourcePath,
} from '../../utils/corrective-model.js';
import '../../styles/home.css';
import '../../styles/work.css';
import '../../styles/records.css';

// ROUTE: /records/actions  (?actionId=번호 상세, ?new=1&sourceType=&sourceId= 출처를 정해 등록, ?sourceType=&sourceId= 출처로 거르기)
// FLOW: 등록 → 시작 → 완료(조치 내용) → 확인(승인자 이상). 확인에서 미흡이면 다시 조치 중, 끝나기 전에는 취소
export default function CorrectiveActions() {
  return <SafetyPageLayout title="개선조치">{(site) => <ActionsPage site={site} />}</SafetyPageLayout>;
}

const today = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);

function ActionsPage({ site }) {
  const siteId = site.currentSite?.siteId;
  const role = site.account?.user?.role === 'ADMIN' ? 'ADMIN' : site.currentSite?.role;
  const userId = site.account?.user?.userId ?? site.account?.user?.id;
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const sourceType = params.get('sourceType') || null;
  const sourceId = /^\d+$/.test(params.get('sourceId') ?? '') ? Number(params.get('sourceId')) : null;
  const actionId = /^\d+$/.test(params.get('actionId') ?? '') ? params.get('actionId') : null;
  const creating = params.get('new') === '1';
  const [filter, setFilter] = useState('open');
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const [assignees, setAssignees] = useState([]);

  const setQuery = (next) => {
    const merged = { sourceType: sourceType ?? '', sourceId: sourceId ?? '', actionId: actionId ?? '', new: creating ? '1' : '', ...next };
    setParams(Object.fromEntries(Object.entries(merged).filter(([, value]) => value !== '' && value != null)));
  };

  useEffect(() => {
    if (!siteId) return undefined;
    let active = true;
    const statuses = ACTION_FILTERS.find((item) => item.key === filter)?.statuses ?? [];
    listCorrectiveActions(siteId, { statuses, sourceType, sourceId })
      .then((rows) => { if (active) { setList(rows); setError(''); } })
      .catch((requestError) => { if (active) setError(requestError.message || '개선조치 목록을 불러오지 못했습니다.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [siteId, filter, sourceType, sourceId, revision]);

  useEffect(() => {
    if (!siteId) return undefined;
    let active = true;
    getCorrectiveAssignees(siteId).then((rows) => { if (active) setAssignees(rows); }).catch(() => { if (active) setAssignees([]); });
    return () => { active = false; };
  }, [siteId]);

  const reload = () => { setLoading(true); setRevision((value) => value + 1); };
  const say = (message) => toast.show({ tone: 'success', message, duration: 6000 });

  return (
    <div className="work-list rec-page">
      <PageHeader title="개선조치" description="아차사고·점검·감사에서 나온 조치를 담당자와 기한을 정해 끝까지 확인합니다." context={site}
        actions={<>
          <button type="button" className="ui-btn ui-btn--ghost" onClick={reload}><Icon name="refresh" size={16} />새로고침</button>
          <button type="button" className="ui-btn ui-btn--primary" onClick={() => setQuery({ new: '1', actionId: '' })}>개선조치 등록</button>
        </>} />

      {sourceType && (
        <p className="rec-note">{ACTION_SOURCE_LABELS[sourceType] ?? sourceType}{sourceId ? ` #${sourceId}` : ''}의 개선조치만 보고 있습니다.
          {sourcePath(sourceType, sourceId) && <Link className="ui-btn ui-btn--ghost" to={sourcePath(sourceType, sourceId)}>출처 보기</Link>}
          <button type="button" className="ui-btn ui-btn--ghost" onClick={() => setQuery({ sourceType: '', sourceId: '', new: '' })}>전체 보기</button></p>
      )}

      <div className="home-assistant__tabs appr-tabs" role="tablist" aria-label="개선조치 상태">
        {ACTION_FILTERS.map((item) => (
          <button key={item.key} type="button" role="tab" aria-selected={filter === item.key} className={`home-assistant__tab${filter === item.key ? ' is-active' : ''}`}
            onClick={() => { setLoading(true); setFilter(item.key); }}>{item.label}</button>
        ))}
      </div>

      <section className="home-panel">
        {loading ? <div className="home-panel__pad"><Skeleton lines={5} /></div>
          : error ? <StatusView kind="error" message={error} onRetry={reload} />
            : list.length === 0 ? <StatusView kind="empty" title="개선조치가 없습니다" message="아차사고·점검표 화면이나 위 버튼으로 등록할 수 있습니다." />
              : (
                <table className="work-table">
                  <thead><tr><th>제목</th><th>출처</th><th>담당</th><th>기한</th><th>상태</th></tr></thead>
                  <tbody>
                    {list.map((action) => (
                      <tr key={action.actionId}>
                        <td data-label="제목"><button type="button" className="ui-btn ui-btn--ghost" onClick={() => setQuery({ actionId: String(action.actionId), new: '' })}>{action.title}</button><span className="work-table__id">#{action.actionId}</span></td>
                        <td data-label="출처">{ACTION_SOURCE_LABELS[action.sourceType]}{action.sourceId ? ` #${action.sourceId}` : ''}</td>
                        <td data-label="담당">{action.assigneeName ?? `#${action.assigneeId}`}</td>
                        <td data-label="기한">{action.dueDate}{action.overdue && <> <Badge tone="block">기한 지남</Badge></>}</td>
                        <td data-label="상태"><Badge tone={ACTION_STATUS_TONES[action.status]}>{ACTION_STATUS_LABELS[action.status]}</Badge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
      </section>

      <Sheet open={creating} onClose={() => setQuery({ new: '' })} title="개선조치 등록" subtitle={site.currentSite?.name}>
        {creating && (
          <ActionForm key={`${sourceType}:${sourceId}`} assignees={assignees} defaultAssignee={userId}
            source={{ sourceType: sourceType ?? 'OTHER', sourceId }}
            onSubmit={async (body) => {
              const saved = await createCorrectiveAction(siteId, body);
              say('개선조치를 등록했습니다.');
              reload();
              setQuery({ new: '', actionId: String(saved.actionId) });
            }} />
        )}
      </Sheet>

      <Sheet open={Boolean(actionId) && !creating} onClose={() => setQuery({ actionId: '' })} title="개선조치" subtitle={actionId ? `#${actionId}` : ''} wide>
        {actionId && !creating && (
          <ActionDetail key={actionId} id={actionId} siteId={siteId} role={role} userId={userId} assignees={assignees}
            onChanged={(message) => { say(message); reload(); }} />
        )}
      </Sheet>
    </div>
  );
}

function ActionForm({ assignees, defaultAssignee, source, initial, onSubmit, submitLabel = '등록' }) {
  const [form, setForm] = useState(() => ({
    title: initial?.title ?? '', description: initial?.description ?? '',
    assigneeId: String(initial?.assigneeId ?? defaultAssignee ?? ''), dueDate: initial?.dueDate ?? today(),
  }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const submit = async (event) => {
    event.preventDefault();
    if (!form.title.trim() || !form.assigneeId || !form.dueDate) { setError('제목·담당자·기한을 입력하세요.'); return; }
    setBusy(true); setError('');
    try {
      await onSubmit({
        sourceType: source?.sourceType ?? 'OTHER', sourceId: source?.sourceType === 'OTHER' ? null : source?.sourceId ?? null,
        title: form.title.trim(), description: form.description.trim() || null,
        assigneeId: Number(form.assigneeId), dueDate: form.dueDate, lockVersion: initial?.lockVersion ?? null,
      });
    } catch (requestError) {
      setError(requestError.message || '저장하지 못했습니다.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <form className="rec-detail" onSubmit={submit}>
      {source && <p className="rec-help">출처: {ACTION_SOURCE_LABELS[source.sourceType] ?? source.sourceType}{source.sourceId ? ` #${source.sourceId}` : ''}</p>}
      {error && <p className="work-form__error" role="alert"><Icon name="alert" size={16} />{error}</p>}
      <label className="risk-field"><span className="risk-field__label">제목<span className="risk-req" aria-hidden="true">*</span></span>
        <input required maxLength={200} value={form.title} onChange={(event) => set('title', event.target.value)} /></label>
      <label className="risk-field">내용<textarea rows={4} maxLength={4000} value={form.description} onChange={(event) => set('description', event.target.value)} /></label>
      <label className="risk-field"><span className="risk-field__label">담당자<span className="risk-req" aria-hidden="true">*</span></span>
        <select required value={form.assigneeId} onChange={(event) => set('assigneeId', event.target.value)}>
          <option value="">선택</option>
          {assignees.map((person) => <option key={person.userId} value={person.userId}>{person.name ?? `#${person.userId}`}{person.role === 'ADMIN' ? ' (회사 관리자)' : ''}</option>)}
        </select></label>
      <label className="risk-field"><span className="risk-field__label">기한<span className="risk-req" aria-hidden="true">*</span></span>
        <input required type="date" value={form.dueDate} onChange={(event) => set('dueDate', event.target.value)} /></label>
      <div className="rec-actions"><button type="submit" className="ui-btn ui-btn--primary" disabled={busy}>{busy ? '저장 중…' : submitLabel}</button></div>
    </form>
  );
}

function ActionDetail({ id, siteId, role, userId, assignees, onChanged }) {
  const [action, setAction] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [editing, setEditing] = useState(false);

  const load = useCallback(() => getCorrectiveAction(id, siteId).then((row) => { setAction(row); setError(''); return row; }), [id, siteId]);
  useEffect(() => {
    let active = true;
    getCorrectiveAction(id, siteId).then((row) => { if (active) setAction(row); })
      .catch((requestError) => { if (active) setError(requestError.message || '개선조치를 불러오지 못했습니다.'); });
    return () => { active = false; };
  }, [id, siteId]);

  if (!action) {
    return error ? <StatusView kind="error" compact message={error} /> : <div className="home-panel__pad"><Skeleton lines={5} /></div>;
  }

  const step = async (button) => {
    if (button.needsNote && !note.trim()) { setError(button.noteHint); return; }
    if (button.confirm) {
      const ok = await confirmAction({ title: button.confirm, message: button.confirmMessage, confirmLabel: button.label, tone: button.tone ?? 'default' });
      if (!ok) return;
    }
    setBusy(true); setError('');
    try {
      const saved = await stepCorrectiveAction(action.actionId, button.step, { lockVersion: action.lockVersion, note: note.trim() || null }, siteId);
      setAction(saved); setNote('');
      onChanged(button.done);
    } catch (requestError) {
      try {
        const latest = await reloadJobConflict(requestError, load);
        setError(latest ? '다른 사람이 먼저 바꿨습니다. 최신 내용으로 바꿨으니 다시 확인하세요.' : requestError.message);
      } catch (reloadError) {
        setError(reloadError.message);
      }
    } finally {
      setBusy(false);
    }
  };

  if (editing) {
    return (
      <ActionForm assignees={assignees} initial={action} submitLabel="수정 저장"
        onSubmit={async (body) => {
          const saved = await updateCorrectiveAction(action.actionId, body, siteId);
          setAction(saved); setEditing(false); onChanged('개선조치를 수정했습니다.');
        }} />
    );
  }

  const buttons = actionButtons(action, { role, userId });
  const noteButton = buttons.find((button) => button.needsNote || button.allowsNote);
  return (
    <div className="rec-detail">
      {error && <p className="work-form__error" role="alert"><Icon name="alert" size={16} />{error}</p>}
      <h3>{action.title} <Badge tone={ACTION_STATUS_TONES[action.status]}>{ACTION_STATUS_LABELS[action.status]}</Badge>{action.overdue && <> <Badge tone="block">기한 지남</Badge></>}</h3>
      <dl className="rec-facts">
        <div><dt>출처</dt><dd>{ACTION_SOURCE_LABELS[action.sourceType]}{action.sourceId ? ` #${action.sourceId}` : ''}
          {sourcePath(action.sourceType, action.sourceId) && <> <Link to={sourcePath(action.sourceType, action.sourceId)}>보기</Link></>}</dd></div>
        <div><dt>담당</dt><dd>{action.assigneeName ?? `#${action.assigneeId}`}</dd></div>
        <div><dt>기한</dt><dd>{action.dueDate}</dd></div>
        <div><dt>등록</dt><dd>{action.createdByName ?? `#${action.createdBy}`} · {action.createdAt?.replace('T', ' ').slice(0, 16) ?? ''}</dd></div>
        {action.completedAt && <div><dt>완료</dt><dd>{action.completedAt.replace('T', ' ').slice(0, 16)}</dd></div>}
        {action.verifiedAt && <div><dt>확인</dt><dd>{action.verifiedByName ?? `#${action.verifiedBy}`} · {action.verifiedAt.replace('T', ' ').slice(0, 16)}</dd></div>}
      </dl>
      {action.description && <section className="rec-block"><h3 className="rec-block__title">내용</h3><p className="rec-text">{action.description}</p></section>}
      {action.completionNote && <section className="rec-block"><h3 className="rec-block__title">조치 내용</h3><p className="rec-text">{action.completionNote}</p></section>}
      {noteButton && (
        <label className="risk-field">{noteButton.noteLabel}<textarea rows={3} maxLength={4000} value={note} onChange={(event) => setNote(event.target.value)} /></label>
      )}
      {buttons.length > 0 && (
        <div className="rec-actions">
          {['OPEN', 'IN_PROGRESS'].includes(action.status) && <button type="button" className="ui-btn ui-btn--ghost" disabled={busy} onClick={() => setEditing(true)}>수정</button>}
          {buttons.map((button) => (
            <button key={button.step} type="button" className={`ui-btn ${button.primary ? 'ui-btn--primary' : button.tone === 'danger' ? 'ui-btn--danger' : 'ui-btn--secondary'}`}
              disabled={busy} onClick={() => step(button)}>{button.label}</button>
          ))}
        </div>
      )}
      {action.status === 'DONE' && !buttons.some((button) => button.step === 'verify') && <p className="rec-help">확인은 승인자 이상이 합니다. 검증 모드 현장에서는 담당자 본인이 확인할 수 없습니다.</p>}
    </div>
  );
}
