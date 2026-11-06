import { useEffect, useState } from 'react';
import { getSafetyDashboard, getSafetyDashboardSummary } from '../api/dashboard';
import { rangeEnding } from '../utils/status-model.js';

const message = (error, fallback) => (error?.status === 404 ? '현황 집계 API가 연결되지 않았습니다.' : error?.message || fallback);

/**
 * 작업 현황: 고른 날짜의 현황(GET /dashboard?date)과 그날로 끝나는 기간 요약(GET /dashboard/summary)을 동시에 부른다.
 * 하나가 실패해도 다른 하나는 보인다. 날짜·기간이 바뀌면 다시 부른다.
 */
export function useWorkStatus({ siteId, initialDate, disabled }) {
  const [date, setDate] = useState(initialDate);
  const [rangeDays, setRangeDays] = useState(7);
  const [revision, setRevision] = useState(0);
  const [day, setDay] = useState({ key: null, data: null, error: '' });
  const [period, setPeriod] = useState({ key: null, data: null, error: '' });
  const dayKey = `${siteId}:${date}:${revision}`;
  const periodKey = `${siteId}:${date}:${rangeDays}:${revision}`;

  useEffect(() => {
    if (disabled) return undefined;
    let active = true;
    getSafetyDashboard(siteId, date)
      .then((data) => { if (active) setDay({ key: dayKey, data, error: '' }); })
      .catch((error) => { if (active) setDay({ key: dayKey, data: null, error: message(error, '현황을 불러오지 못했습니다.') }); });
    return () => { active = false; };
  }, [siteId, date, dayKey, disabled]);

  useEffect(() => {
    if (disabled) return undefined;
    let active = true;
    const { from, to } = rangeEnding(date, rangeDays);
    getSafetyDashboardSummary(siteId, from, to)
      .then((data) => { if (active) setPeriod({ key: periodKey, data, error: '' }); })
      .catch((error) => { if (active) setPeriod({ key: periodKey, data: null, error: message(error, '기간 요약을 불러오지 못했습니다.') }); });
    return () => { active = false; };
  }, [siteId, date, rangeDays, periodKey, disabled]);

  const dayLoading = day.key !== dayKey;
  const periodLoading = period.key !== periodKey;
  return {
    date, changeDate: (next) => { if (next) setDate(next); },
    rangeDays, setRangeDays,
    reload: () => setRevision((value) => value + 1),
    dashboard: dayLoading ? null : day.data, dayError: dayLoading ? '' : day.error, dayLoading,
    summary: periodLoading ? null : period.data, periodError: periodLoading ? '' : period.error, periodLoading,
  };
}
