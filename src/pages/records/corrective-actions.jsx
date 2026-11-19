import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import SafetyPageLayout from '../../components/safety-page-layout';
import PageHeader from '../../components/ui/page-header.jsx';
import { Badge } from '../../components/home/panel.jsx';
import Icon from '../../components/ui/icon.jsx';
import Sheet from '../../components/ui/sheet.jsx';
import Field from '../../components/ui/field.jsx';
import StatusView, { Skeleton } from '../../components/ui/status-view.jsx';
import { confirmAction } from '../../components/ui/confirm-store.js';
import { useToast } from '../../components/ui/toast-context.js';
import {
  createCorrectiveAction, getCorrectiveAction, getCorrectiveAssignees, listCorrectiveActions,
  stepCorrectiveAction, updateCorrectiveAction,
} from '../../api/corrective-actions.js';
import { reloadJobConflict } from '../../api/jobs.js';
import {
  ACTION_FILTERS, ACTION_SOURCE_LABELS, ACTION_STATUS_LABELS, ACTION_STATUS_TONES, actionButtons, actionStats, filterActions, sourcePath,
} from '../../utils/corrective-model.js';
import '../../styles/home.css';
import '../../styles/work.css';
import '../../styles/approvals.css';
import '../../styles/records.css';

// ROUTE: /records/actions  (?actionId=번호 상세, ?new=1&sourceType=&sourceId= 출처를 정해 등록, ?sourceType=&sourceId= 출처로 거르기)
// FLOW: 등록 → 시작 → 완료(조치 내용) → 확인(승인자 이상). 확인에서 미흡이면 다시 조치 중, 끝나기 전에는 취소
// 화면 모양은 아차사고(job-incidents)와 같다: 건수 카드 + 검색 + 표, 등록은 시트 아래 취소·저장 버튼, 상세 시트 제목은 개선조치 제목
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
  const [view, setView] = useState('open');
  const [keyword, setKeyword] = useState('');
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const [assignees, setAssignees] = useState([]);
  const [saving, setSaving] = useState(false);
  const [detailTitle, setDetailTitle] = useState('');

  const setQuery = (next) => {
    const merged = { sourceType: sourceType ?? '', sourceId: sourceId ?? '', actionId: actionId ?? '', new: creating ? '1' : '', ...next };
    setParams(Object.fromEntries(Object.entries(merged).filter(([, value]) => value !== '' && value != null)));
  };

  // 서버는 현장의 개선조치를 전부 준다 → 한 번 받아 건수 카드와 거르기를 화면에서 한다
  useEffect(() => {
    if (!siteId) return undefined;
    let active = true;
    listCorrectiveActions(siteId, { sourceType, sourceId })
      .then((rows) => { if (active) { setList(rows); setError(''); } })
      .catch((requestError) => { if (active) setError(requestError.message || '개선조치 목록을 불러오지 못했습니다.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [siteId, sourceType, sourceId, revision]);

  useEffect(() => {
    if (!siteId) return undefined;
    let active = true;
    getCorrectiveAssignees(siteId).then((rows) => { if (active) setAssignees(rows); }).catch(() => { if (active) setAssignees([]); });
    return () => { active = false; };
  }, [siteId]);

  const stats = useMemo(() => actionStats(list), [list]);
  const rows = useMemo(() => filterActions(list, { view, keyword }), [list, view, keyword]);
  const ready = !loading && !error;
  const reload = () => { setLoading(true); setRevision((value) => value + 1); };
  const say = (message) => toast.show({ tone: 'success', message, duration: 6000 });
  const openAction = (id) => setQuery({ actionId: String(id), new: '' });
  const closeCreate = () => setQuery({ new: '' });

  return (
    <div className="work-list rec-page">
      <PageHeader title="개선조치" description="아차사고·점검·감사에서 나온 조치를 담당자와 기한을 정해 끝까지 확인합니다." context={site}
        actions={<>
          <button type="button" className="ui-btn ui-btn--ghost" onClick={reload}><Icon name="refresh" size={16} />새로고침</button>
          <button type="button" className="ui-btn ui-btn--primary" onClick={() => setQuery({ new: '1', actionId: '' })}>개선조치 등록</button>
        </>} />

      {sourceType && (
        <p className="rec-note">{ACTION_SOURCE_LABELS[sourceType] ?? sourceType}{sourceId ? ` #${sourceId}` : ''}의 개선조치만 보고 있습니다.
          {sourcePath(sourceType, sourceId) && <Link className="ui-btn ui-btn--ghost ui-btn--sm" to={sourcePath(sourceType, sourceId)}>출처 보기</Link>}
          <button type="button" className="ui-btn ui-btn--ghost ui-btn--sm" onClick={() => setQuery({ sourceType: '', sourceId: '', new: '' })}>전체 보기</button></p>
      )}

      <ul className="work-stats appr-stats" aria-label="개선조치 건수">
        {ACTION_FILTERS.map((item) => (
          <li key={item.key}>
            <button type="button" aria-pressed={view === item.key}
              className={`work-stat work-stat--${item.tone}${item.key === 'overdue' ? ' appr-stat--overdue' : ''}${view === item.key ? ' is-active' : ''}`}
              onClick={() => setView(item.key)}>
              <span className="work-stat__label"><i aria-hidden="true" />{item.label}</span>
              <strong className="work-stat__value">{ready ? stats[item.key] : '–'}</strong>
              <span className="work-stat__note">{item.note}</span>
            </button>
          </li>
        ))}
      </ul>

      <section className="work-filters" aria-label="개선조치 검색 조건">
        <div className="work-filters__find">
          <label className="work-search"><Icon name="search" size={16} /><span className="sr-only">제목·내용·담당자 검색</span>
            <input type="search" value={keyword} placeholder="제목·내용·담당자 검색" onChange={(event) => setKeyword(event.target.value)} />
          </label>
        </div>
      </section>

      <div className="work-meta">
        <p className="work-filters__help">{ready ? `${rows.length}건 표시 · ` : ''}기한이 이른 순으로 보여 줍니다.</p>
        {keyword && <button type="button" className="ui-btn ui-btn--link ui-btn--sm" onClick={() => setKeyword('')}>검색어 지우기</button>}
      </div>

      <section className="home-panel work-table-panel" aria-label="개선조치 목록">
        {loading && <div className="home-panel__pad"><Skeleton lines={5} /></div>}
        {!loading && error && <StatusView kind="error" message={error} onRetry={reload} />}
        {ready && !rows.length && (
          <StatusView kind="empty" title={list.length ? '조건에 맞는 개선조치가 없습니다' : '개선조치가 없습니다'}
            message={list.length ? '위 건수 칸이나 검색어를 바꿔 보세요.' : '아차사고·점검표 화면이나 위 버튼으로 등록할 수 있습니다.'}
            action={list.length ? { label: '전체 보기', onClick: () => { setView('all'); setKeyword(''); } } : { label: '개선조치 등록', onClick: () => setQuery({ new: '1', actionId: '' }) }} />
        )}
        {ready && rows.length > 0 && (
          <table className="home-table rec-table">
            <thead><tr><th scope="col">기한</th><th scope="col">개선조치</th><th scope="col">출처</th><th scope="col">담당</th><th scope="col">상태</th><th scope="col"><span className="sr-only">열기</span></th></tr></thead>
            <tbody>
              {rows.map((action) => (
                <tr key={action.actionId} className={String(action.actionId) === actionId ? 'is-selected' : undefined}>
                  <td data-label="기한" className="work-table__date">{action.dueDate}{action.overdue && <> <Badge tone="block">기한 지남</Badge></>}</td>
                  <td data-label="개선조치">
                    <span className="home-table__name"><button type="button" className="appr-row-title" onClick={() => openAction(action.actionId)}>{action.title}</button><span className="work-table__id">#{action.actionId}</span></span>
                    {action.description && <span className="home-table__facts rec-snippet">{action.description}</span>}
                  </td>
                  <td data-label="출처">{sourcePath(action.sourceType, action.sourceId)
                    ? <Link className="home-panel__link" to={sourcePath(action.sourceType, action.sourceId)}>{ACTION_SOURCE_LABELS[action.sourceType]} #{action.sourceId}</Link>
                    : <>{ACTION_SOURCE_LABELS[action.sourceType]}{action.sourceId ? ` #${action.sourceId}` : ''}</>}</td>
                  <td data-label="담당">{action.assigneeName ?? `#${action.assigneeId}`}</td>
                  <td data-label="상태"><Badge tone={ACTION_STATUS_TONES[action.status]}>{ACTION_STATUS_LABELS[action.status]}</Badge></td>
                  <td data-label="열기"><button type="button" className="ui-btn ui-btn--ghost ui-btn--sm appr-open" onClick={() => openAction(action.actionId)}>보기</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <Sheet open={creating} onClose={closeCreate} title="개선조치 등록" subtitle={site.currentSite?.name}
        footer={<><button type="button" className="ui-btn ui-btn--ghost" onClick={closeCreate}>취소</button><button type="submit" form="action-create-form" className="ui-btn ui-btn--primary ui-btn--lg" disabled={saving}>{saving ? '저장 중…' : '등록'}</button></>}>
        {creating && (
          <ActionForm key={`${sourceType}:${sourceId}`} formId="action-create-form" assignees={assignees} defaultAssignee={userId}
            source={{ sourceType: sourceType ?? 'OTHER', sourceId }} onBusy={setSaving}
            onSubmit={async (body) => {
              const saved = await createCorrectiveAction(siteId, body);
              say('개선조치를 등록했습니다.');
              reload();
              setQuery({ new: '', actionId: String(saved.actionId) });
            }} />
        )}
      </Sheet>

      <Sheet open={Boolean(actionId) && !creating} onClose={() => setQuery({ actionId: '' })} wide
        title={detailTitle || '개선조치'} subtitle={actionId ? `개선조치 #${actionId}` : ''}>
        {actionId && !creating && (
          <ActionDetail key={actionId} id={actionId} siteId={siteId} role={role} userId={userId} assignees={assignees}
            onLoaded={(row) => setDetailTitle(row?.title ?? '')}
            onChanged={(message) => { say(message); reload(); }} />
        )}
      </Sheet>
    </div>
  );
}

/**
 * 등록·수정 입력칸 (아차사고 보고 폼과 같은 rec-form 두 칸 배치, ui-field 입력칸).
 * 등록은 시트 아래 버튼이 formId 로 제출하고, 상세 안 수정은 inline 버튼(취소·수정 저장)을 쓴다.
 */
function ActionForm({ formId, assignees, defaultAssignee, source, initial, onSubmit, onBusy, onCancel, submitLabel }) {
  const [form, setForm] = useState(() => ({
    title: initial?.title ?? '', description: initial?.description ?? '',
    assigneeId: String(initial?.assigneeId ?? defaultAssignee ?? ''), dueDate: initial?.dueDate ?? today(),
  }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [errors, setErrors] = useState({});
  const set = (key, value) => { setForm((current) => ({ ...current, [key]: value })); if (errors[key]) setErrors((current) => ({ ...current, [key]: undefined })); };
  const working = (value) => { setBusy(value); onBusy?.(value); };
  const submit = async (event) => {
    event.preventDefault();
    const found = {};
    if (!form.title.trim()) found.title = '제목을 입력하세요.';
    if (!form.assigneeId) found.assigneeId = '담당자를 고르세요.';
    if (!form.dueDate) found.dueDate = '기한을 입력하세요.';
    setErrors(found);
    if (Object.keys(found).length) return;
    working(true); setError('');
    try {
      await onSubmit({
        sourceType: source?.sourceType ?? initial?.sourceType ?? 'OTHER',
        sourceId: (source?.sourceType ?? initial?.sourceType) === 'OTHER' ? null : source?.sourceId ?? initial?.sourceId ?? null,
        title: form.title.trim(), description: form.description.trim() || null,
        assigneeId: Number(form.assigneeId), dueDate: form.dueDate, lockVersion: initial?.lockVersion ?? null,
      });
    } catch (requestError) {
      setError(requestError.message || '저장하지 못했습니다.');
    } finally {
      working(false);
    }
  };
  const sourceLabel = source
    ? `${ACTION_SOURCE_LABELS[source.sourceType] ?? source.sourceType}${source.sourceId ? ` #${source.sourceId}` : ''}`
    : null;
  return (
    <form id={formId} className="rec-form" onSubmit={submit} noValidate>
      {error && <p className="work-form__error" role="alert"><Icon name="alert" size={16} />{error}</p>}
      <fieldset className="rec-form__fields" disabled={busy}>
        <legend className="sr-only">{initial ? '개선조치 수정' : '새 개선조치'}</legend>
        <Field className="rec-form__wide" label="제목" required maxLength={200} value={form.title} error={errors.title} placeholder="예: 2층 배관 랙 발판 교체" onChange={(event) => set('title', event.target.value)} />
        <div className={`ui-field${errors.assigneeId ? ' ui-field--error' : ''}`}>
          <label className="ui-field__label" htmlFor={`${formId ?? 'action-edit'}-assignee`}>담당자<span className="ui-field__required" aria-hidden="true">*</span></label>
          <div className="ui-field__control">
            <select id={`${formId ?? 'action-edit'}-assignee`} className="ui-field__input" required aria-invalid={errors.assigneeId ? true : undefined}
              value={form.assigneeId} onChange={(event) => set('assigneeId', event.target.value)}>
              <option value="">선택</option>
              {assignees.map((person) => <option key={person.userId} value={person.userId}>{person.name ?? `#${person.userId}`}{person.role === 'ADMIN' ? ' (회사 관리자)' : ''}</option>)}
            </select>
          </div>
          <span className="ui-field__help">{errors.assigneeId || '이 현장에서 일할 수 있는 사람'}</span>
        </div>
        <Field label="기한" required type="date" max="9999-12-31" value={form.dueDate} error={errors.dueDate} onChange={(event) => set('dueDate', event.target.value)} />
        {sourceLabel && <Field label="출처" value={sourceLabel} readOnly />}
        <Field className="rec-form__wide" label="내용" multiline rows={4} maxLength={4000} value={form.description} placeholder="무엇을 어떻게 고칠지 적어 주세요." onChange={(event) => set('description', event.target.value)} />
      </fieldset>
      {onCancel && (
        <div className="rec-actions">
          <button type="button" className="ui-btn ui-btn--ghost" disabled={busy} onClick={onCancel}>취소</button>
          <button type="submit" className="ui-btn ui-btn--primary" disabled={busy}>{busy ? '저장 중…' : submitLabel}</button>
        </div>
      )}
    </form>
  );
}

function ActionDetail({ id, siteId, role, userId, assignees, onLoaded, onChanged }) {
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

  // 시트 제목을 이 개선조치 제목으로 (불러오기 전에는 null → "개선조치"). 같은 값이면 화면은 다시 그리지 않는다
  useEffect(() => { onLoaded?.(action); }, [action, onLoaded]);

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
      <ActionForm assignees={assignees} initial={action} submitLabel="수정 저장" onCancel={() => setEditing(false)}
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
      <dl className="rec-facts">
        <div><dt>상태</dt><dd><Badge tone={ACTION_STATUS_TONES[action.status]}>{ACTION_STATUS_LABELS[action.status]}</Badge>{action.overdue && <> <Badge tone="block">기한 지남</Badge></>}</dd></div>
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
        <Field label={noteButton.noteLabel} required={Boolean(noteButton.needsNote)} multiline rows={3} maxLength={4000} value={note}
          hint={noteButton.needsNote ? '완료하려면 무엇을 했는지 적어야 합니다.' : '선택'} onChange={(event) => setNote(event.target.value)} />
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
