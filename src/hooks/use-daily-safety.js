import { useCallback, useEffect, useRef, useState } from 'react';
import { getSafetyDashboard } from '../api/dashboard';
import {
  createDailySafetyLogDraft, getDailySafetyLog, getDailySafetyLogs, submitDailySafetyLog, updateDailySafetyLog,
} from '../api/records';
import { useToast } from '../components/ui/toast-context.js';

export function dailyLogError(error) {
  if (error?.code === 'CONFLICT_MODIFIED') return '다른 사용자가 일지를 수정했습니다. 최신 내용을 다시 불러와 주세요.';
  if (error?.code === 'INVALID_STATE') return '현재 상태에서는 이 작업을 할 수 없습니다. 최신 일지 상태를 확인하세요.';
  return error?.message || '안전일지를 처리하지 못했습니다.';
}

/**
 * 안전일지 상태와 동작. 기존 job-daily-safety.jsx 의 규칙을 그대로 옮겼다.
 *  - 날짜를 바꾸면 그날 일지(목록 → 상세)와 현장 집계(대시보드)를 다시 받는다
 *  - 초안 만들기는 서버 집계, 요약 저장은 lockVersion 으로 충돌 검사, 승인 요청 전 고친 요약이 있으면 먼저 저장
 *  - 변경은 한 번에 하나
 */
export function useDailySafety(siteId, date, period = null) {
  const toast = useToast();
  const [state, setState] = useState({ key: null, log: null, error: '' });
  const [dash, setDash] = useState({ key: null, data: null });
  const [summary, setSummary] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const pending = useRef(false);
  const key = `${siteId}:${date}:${revision}`;
  const dashKey = `${siteId}:${date}`;
  const loading = Boolean(siteId && date) && state.key !== key;
  const log = state.key === key ? state.log : null;
  const dirty = Boolean(log) && summary !== (log.summary || '');

  useEffect(() => {
    if (!siteId || !date) return undefined;
    let active = true;
    (async () => {
      try {
        const logs = await getDailySafetyLogs(siteId, { from: date, to: date });
        const list = Array.isArray(logs) ? logs : [];
        const selected = list.find((item) => item.date === date) || list[0];
        const detail = selected?.dailyLogId ? await getDailySafetyLog(selected.dailyLogId) : null;
        if (active) {
          setState({ key, log: detail, error: '' });
          setSummary(detail?.summary || '');
          setError('');
        }
      } catch (requestError) {
        if (active) { setState({ key, log: null, error: dailyLogError(requestError) }); setSummary(''); }
      }
    })();
    return () => { active = false; };
  }, [siteId, date, key]);

  useEffect(() => {
    if (!siteId || !date) return undefined;
    let active = true;
    getSafetyDashboard(siteId, date).then((data) => { if (active) setDash({ key: dashKey, data }); })
      .catch(() => { if (active) setDash({ key: dashKey, data: null }); });
    return () => { active = false; };
  }, [siteId, date, dashKey]);

  // 기간(from~to, 이틀 이상)으로 볼 때 그 기간의 일지 목록 (날짜를 고르는 용도). 하루면 부르지 않는다
  const from = period?.from ?? date;
  const to = period?.to ?? date;
  const multiDay = Boolean(from && to && from !== to);
  const rangeKey = `${siteId}:${from}:${to}:${revision}`;
  const [range, setRange] = useState({ key: null, logs: [], error: '' });
  useEffect(() => {
    if (!siteId || !multiDay) return undefined;
    let active = true;
    getDailySafetyLogs(siteId, { from, to })
      .then((logs) => { if (active) setRange({ key: rangeKey, logs: [...(Array.isArray(logs) ? logs : [])].sort((a, b) => String(b.date).localeCompare(String(a.date))), error: '' }); })
      .catch((requestError) => { if (active) setRange({ key: rangeKey, logs: [], error: dailyLogError(requestError) }); });
    return () => { active = false; };
  }, [siteId, from, to, multiDay, rangeKey]);

  const reload = useCallback(() => setRevision((value) => value + 1), []);

  const run = async (action, success) => {
    if (pending.current || !siteId) return;
    pending.current = true; setBusy(true); setError('');
    try {
      await action();
      if (success) toast.show({ tone: 'success', message: success });
    } catch (requestError) { setError(dailyLogError(requestError)); } finally { pending.current = false; setBusy(false); }
  };

  const createDraft = () => run(async () => {
    await createDailySafetyLogDraft(siteId, { date });
    reload();
  }, '서버 집계로 안전일지 초안을 만들었습니다.');

  const applyLog = (next) => { setState({ key, log: next, error: '' }); setSummary(next.summary || ''); };

  const saveSummary = () => log && run(async () => {
    applyLog(await updateDailySafetyLog(log.dailyLogId, { lockVersion: log.lockVersion, summary }));
  }, '요약을 저장했습니다.');

  const submit = () => log && run(async () => {
    let latest = log;
    if (dirty) latest = await updateDailySafetyLog(log.dailyLogId, { lockVersion: log.lockVersion, summary });
    const submitted = await submitDailySafetyLog(latest.dailyLogId, latest.lockVersion);
    setState({ key, log: submitted, error: '' }); setSummary(submitted.summary || summary);
  }, '승인 요청을 보냈습니다. 결과는 승인함 "내 요청"에서 볼 수 있습니다.');

  return {
    loading, loadError: state.key === key ? state.error : '', log, summary, setSummary, dirty, busy, error,
    dashboard: dash.key === dashKey ? dash.data : null, dashboardLoading: Boolean(siteId && date) && dash.key !== dashKey,
    rangeLogs: range.key === rangeKey ? range.logs : [], rangeLoading: multiDay && range.key !== rangeKey, rangeError: range.key === rangeKey ? range.error : '', rangeFrom: from, rangeTo: to, multiDay,
    reload, createDraft, saveSummary, submit,
  };
}
