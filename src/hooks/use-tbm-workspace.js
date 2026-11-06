import { useCallback, useEffect, useRef, useState } from 'react';
import { completeTbm, createTbm, getSiteTbms, getSiteWorkers, getTbm, reopenTbm, saveTbmAttendees, submitTbm, updateTbm } from '../api/tbm';
import { reloadJobConflict } from '../api/jobs';
import { completeTbmBody, tbmContentBody, tbmHeldAt, tbmPermissions } from '../utils/job-forms';
import { useToast } from '../components/ui/toast-context.js';
import { datesBetween, presetRange } from '../utils/period-model.js';

const SPANS = [1, 7, 30];
const spanKey = (siteId) => `tbm-span:${siteId}`;
const readSpan = (siteId) => {
  try { const value = Number(window.sessionStorage.getItem(spanKey(siteId))); return SPANS.includes(value) ? value : 1; } catch { return 1; }
};
// TBM 목록 API 는 하루씩만 받는다: 여러 날은 날짜마다 조회하되 한 번에 6개까지만 보낸다
async function tbmsOfDays(siteId, dates) {
  const lists = [];
  for (let index = 0; index < dates.length; index += 6) {
    lists.push(...await Promise.all(dates.slice(index, index + 6).map((day) => getSiteTbms(siteId, day))));
  }
  return lists.flat();
}

const EMPTY_CONTENT = { leaderName: '', workIds: '', points: '', healthCheck: '', teamId: '', zoneId: '' };

/**
 * TBM 상태와 동작. 기존 job-tbm.jsx 의 TbmWorkspace 규칙을 그대로 옮겼다.
 *  - 내용 저장은 tbmContentBody(연결 작업 50개, 요점 30개·각 300자, 진행자 50자, 건강 확인 500자), 수정은 내용·작업·참석자를 통째로 바꾼다
 *  - 실시 완료 전에 참석자를 먼저 저장, 실시 일시는 TBM 날짜와 같은 날(completeTbmBody)
 *  - 409·응답 불명이면 다시 조회하기 전까지 변경을 막고, 버전 충돌이면 최신 TBM 으로 바꿔 알린다(자동 재저장 없음)
 *  - 작성 중(DRAFT)이고 확인 요청 중이 아닐 때만 고칠 수 있고, 실시 완료(DONE)면 확인 요청·되돌리기
 * 달라진 점: 날짜를 바꾸면 그날 TBM 을 바로 조회한다(예전에는 "날짜별 조회"를 눌러야 했다).
 */
export function useTbmWorkspace({ siteId, disabled, initialTbmId, initialDate, presetWorkId = null }) {
  const toast = useToast();
  const [date, setDate] = useState(initialDate);
  // 목록 기간: 고른 날짜까지 하루·7일·30일 (같은 탭 동안 남는다). 작업 허브에서 날짜를 정해 오면 그날 하루
  const [span, setSpanState] = useState(() => (initialTbmId ? 1 : readSpan(siteId)));
  const [records, setRecords] = useState([]);
  const [tbmId, setTbmId] = useState(initialTbmId ?? '');
  const [workers, setWorkers] = useState([]);
  const [workersLoaded, setWorkersLoaded] = useState(false);
  const [workerError, setWorkerError] = useState('');
  const [workerRevision, setWorkerRevision] = useState(0);
  const [attendees, setAttendees] = useState([]);
  const [attendeesSaved, setAttendeesSaved] = useState(false);
  const [attendeeCount, setAttendeeCount] = useState('');
  const [heldAt, setHeldAt] = useState('');
  const [content, setContent] = useState(EMPTY_CONTENT);
  const [contentDate, setContentDate] = useState(initialDate);
  const [editing, setEditing] = useState(null); // null | 'new' | 'edit'
  const [contentDirty, setContentDirty] = useState(false);
  const [needsReload, setNeedsReload] = useState(false);
  const [busy, setBusy] = useState(false);
  const [listState, setListState] = useState({ key: null, error: '' });
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState('');
  const pending = useRef(false);
  const say = (message) => toast.show({ tone: 'success', message, duration: 6000 });

  const selectedTbm = records.find((record) => String(record.tbmId) === String(tbmId)) ?? null;
  const { editable, pending: approvalPending, canRequest } = tbmPermissions(selectedTbm);
  const listKey = `${siteId}:${date}:${span}:${revision}`;
  const loading = listState.key !== listKey;

  const selectTbm = useCallback((record) => {
    setTbmId(record ? String(record.tbmId) : '');
    setAttendees(record ? record.attendees.map((person) => ({ workerId: person.workerId, healthOk: person.healthOk })) : []);
    setAttendeeCount(record?.attendeeCount == null ? '' : String(record.attendeeCount));
    setHeldAt(record ? tbmHeldAt(record) : '');
    setAttendeesSaved(Boolean(record));
    setEditing(null); setContentDirty(false);
  }, []);

  useEffect(() => {
    let active = true;
    getSiteWorkers(siteId).then((list) => { if (active) { setWorkers(list); setWorkerError(''); setWorkersLoaded(true); } })
      .catch((requestError) => { if (active) setWorkerError(requestError.message || '현장 작업자를 불러오지 못했습니다.'); });
    return () => { active = false; };
  }, [siteId, workerRevision]);

  // 날짜의 TBM 목록 (주소의 tbmId 가 있으면 그것, 없으면 첫 TBM 을 고른다)
  const wanted = useRef(initialTbmId ?? '');
  // 작업 허브에서 "TBM 작성"으로 왔고 그 작업이 아직 어느 TBM 에도 없으면 첫 조회 뒤 새 TBM 을 열어 둔다 (한 번만)
  const preset = useRef(presetWorkId);
  useEffect(() => {
    let active = true;
    tbmsOfDays(siteId, datesBetween(presetRange(span, date).from, date)).then((list) => {
      if (!active) return;
      setRecords(list);
      const current = list.find((record) => String(record.tbmId) === String(wanted.current));
      selectTbm(current ?? list[0] ?? null);
      if (preset.current) {
        const workId = preset.current; preset.current = null;
        if (!list.some((record) => record.works.some((work) => String(work.workId) === String(workId)))) {
          setContent({ ...EMPTY_CONTENT, workIds: String(workId) }); setContentDate(date); setEditing('new');
        }
      }
      setNeedsReload(false);
      setListState({ key: listKey, error: '' });
    }).catch((requestError) => { if (active) setListState({ key: listKey, error: requestError.message || 'TBM 목록을 불러오지 못했습니다.' }); });
    return () => { active = false; };
  }, [siteId, date, span, listKey, selectTbm]);

  const updateRecord = (saved) => setRecords((current) => current.map((record) => (record.tbmId === saved.tbmId ? saved : record)));

  const showWriteError = async (requestError, fallback) => {
    if (requestError.status === 409 || requestError.code === 'WRITE_OUTCOME_UNKNOWN') setNeedsReload(true);
    setError(requestError.message || fallback);
    if (requestError.code === 'CONFLICT_MODIFIED' && selectedTbm) {
      try {
        const latest = await reloadJobConflict(requestError, () => getTbm(selectedTbm.tbmId, siteId));
        updateRecord(latest); selectTbm(latest); setNeedsReload(false);
        if (latest.tbmDate !== date) { wanted.current = String(latest.tbmId); setDate(latest.tbmDate); }
        toast.show({ tone: 'info', message: '다른 변경과 충돌하여 최신 TBM으로 바꿨습니다. 다시 "내용 수정"을 눌러 고치세요. 자동으로 다시 저장하지 않았습니다.', duration: 8000 });
      } catch (reloadError) { setError(reloadError.message); }
    }
  };

  const write = async (action, fallback) => {
    if (pending.current || disabled) return false;
    pending.current = true; setBusy(true); setError('');
    try { await action(); return true; } catch (requestError) { await showWriteError(requestError, fallback); return false; } finally { pending.current = false; setBusy(false); }
  };

  /** 새 TBM 쓰기 (preset: 미리 고를 연결 작업 번호 목록) */
  const openNew = (presetWorkIds = []) => {
    setContent({ ...EMPTY_CONTENT, workIds: presetWorkIds.join(', ') }); setContentDate(date); setEditing('new'); setContentDirty(false); setError('');
  };
  const openEdit = () => {
    if (!selectedTbm || !editable) return;
    setContentDate(selectedTbm.tbmDate);
    setContent({
      leaderName: selectedTbm.leaderName ?? '', workIds: selectedTbm.works.map((work) => work.workId).join(', '),
      points: (selectedTbm.points ?? []).join('\n'), healthCheck: selectedTbm.healthCheck ?? '',
      teamId: selectedTbm.teamId == null ? '' : String(selectedTbm.teamId), zoneId: selectedTbm.zoneId == null ? '' : String(selectedTbm.zoneId),
    });
    setEditing('edit'); setContentDirty(false); setError('');
  };
  const closeEditor = () => { setEditing(null); setContentDirty(false); };
  const setField = (field, value) => { setContent((current) => ({ ...current, [field]: value })); setContentDirty(true); };

  const saveContent = () => {
    if (needsReload) return Promise.resolve(false);
    if (editing === 'new') {
      return write(async () => {
        const saved = await createTbm(siteId, tbmContentBody({ date: contentDate, ...content, attendees: [] }));
        if (saved.tbmDate !== date) { wanted.current = String(saved.tbmId); setDate(saved.tbmDate); }
        setRecords((current) => [saved, ...current.filter((record) => record.tbmId !== saved.tbmId)]);
        selectTbm(saved);
        say('TBM 초안을 작성했습니다. 참석자를 저장한 뒤 실시 완료하세요.');
      }, 'TBM을 작성하지 못했습니다.');
    }
    if (!selectedTbm || !editable) return Promise.resolve(false);
    return write(async () => {
      const saved = await updateTbm(selectedTbm.tbmId, tbmContentBody({ date: contentDate, ...content, attendees }, selectedTbm), siteId);
      updateRecord(saved); selectTbm(saved);
      if (saved.tbmDate !== date) { wanted.current = String(saved.tbmId); setDate(saved.tbmDate); }
      say('TBM 내용·연결 작업·참석자를 저장했습니다.');
    }, 'TBM 내용을 저장하지 못했습니다.');
  };

  const saveAttendees = () => {
    if (!selectedTbm || needsReload || !editable || (editing && contentDirty)) return;
    void write(async () => {
      const saved = await saveTbmAttendees(selectedTbm.tbmId, { lockVersion: selectedTbm.lockVersion, attendees }, siteId);
      updateRecord(saved);
      setAttendees(saved.attendees.map(({ workerId, healthOk }) => ({ workerId, healthOk })));
      setAttendeesSaved(true);
      say('참석자 목록을 저장했습니다.');
    }, 'TBM 참석자를 저장하지 못했습니다.');
  };

  const finish = () => {
    if (!selectedTbm || needsReload || !editable || (editing && contentDirty)) return;
    if (!attendeesSaved) { setError('실시 완료 전에 참석자 목록을 먼저 저장하세요.'); return; }
    void write(async () => {
      const saved = await completeTbm(selectedTbm.tbmId, completeTbmBody(selectedTbm, heldAt, attendeeCount), siteId);
      updateRecord(saved); selectTbm(saved);
      say('TBM 실시를 완료했습니다. 확인 요청(승인)은 별도 절차입니다.');
    }, 'TBM 실시 완료 요청에 실패했습니다.');
  };

  const changeStatus = (action, success) => {
    if (!selectedTbm || needsReload || !canRequest) return;
    if (!attendeesSaved || (editing && contentDirty)) { setError('저장하지 않은 내용·참석자를 먼저 저장하세요.'); return; }
    void write(async () => { const saved = await action(selectedTbm.tbmId, siteId); updateRecord(saved); selectTbm(saved); say(success); }, 'TBM 상태 변경에 실패했습니다.');
  };

  const toggleAttendee = (workerId, checked) => {
    setAttendees((current) => (checked ? [...current, { workerId, healthOk: null }] : current.filter((person) => person.workerId !== workerId)));
    setAttendeesSaved(false);
  };
  const setHealth = (workerId, value) => {
    setAttendees((current) => current.map((person) => (person.workerId === workerId ? { ...person, healthOk: value } : person)));
    setAttendeesSaved(false);
  };

  return {
    span, spans: SPANS, setSpan: (next) => { if (!SPANS.includes(next)) return; setSpanState(next); try { window.sessionStorage.setItem(spanKey(siteId), String(next)); } catch { /* 저장 못 해도 화면은 그대로 */ } },
    date, changeDate: (next) => { if (next) { wanted.current = ''; setDate(next); } }, records, loading, listError: loading ? '' : listState.error,
    reload: () => { wanted.current = tbmId; setRevision((value) => value + 1); },
    selectedTbm, select: (record) => { wanted.current = String(record.tbmId); selectTbm(record); },
    editable, approvalPending, canRequest,
    workers, workersLoaded, workerError, reloadWorkers: () => { setWorkersLoaded(false); setWorkerRevision((value) => value + 1); },
    attendees, attendeesSaved, toggleAttendee, setHealth, attendeeCount, setAttendeeCount, heldAt, setHeldAt,
    editing, content, contentDate, setContentDate: (value) => { setContentDate(value); setContentDirty(true); }, setField, contentDirty, openNew, openEdit, closeEditor, saveContent,
    needsReload, busy, error, locked: disabled || busy || loading || needsReload,
    saveAttendees, finish,
    submit: () => changeStatus(submitTbm, 'TBM 확인 요청을 보냈습니다. 승인함에서 확인하며, 승인 완료를 뜻하지 않습니다.'),
    reopen: () => changeStatus(reopenTbm, 'TBM을 작성 중으로 되돌렸습니다.'),
  };
}
