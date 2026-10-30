import { useEffect, useRef, useState } from 'react';
import { api, getCurrentUser, getToken } from './client';
import { setLastSite } from './users';
import { requireRuleEvaluation } from './jobs.js';

export const workTypes = { GENERAL: '일반', HOT: '화기', CONFINED: '밀폐공간', HEIGHT: '고소' };
export const typeClass = { GENERAL: 'type-normal', HOT: 'type-hot', CONFINED: 'type-closed', HEIGHT: 'type-height' };
export const statusClass = { BLOCKED: 'status-blocked', PENDING: 'status-waiting', APPROVED: 'status-approved' };
export const siteRoles = { ADMIN: '회사 관리자', WRITER: '작성자', APPROVER: '승인자', SITE_ADMIN: '현장 관리자' };

let accountCache = null;
let accountCacheToken = null;
let accountRequest = null;

function validAccount(data) {
  if (!data?.user || !Array.isArray(data.sites)) throw new Error('사용자·현장 응답 형식이 올바르지 않습니다.');
  return data;
}

export function getCachedCurrentUser({ force = false } = {}) {
  const token = getToken();
  if (!token) return Promise.reject(new Error('로그인이 필요합니다.'));
  if (!force && accountCache && accountCacheToken === token) return Promise.resolve(accountCache);
  if (!force && accountRequest && accountCacheToken === token) return accountRequest;
  accountCacheToken = token;
  accountRequest = getCurrentUser().then(validAccount).then((data) => {
    accountCache = data;
    return data;
  }).finally(() => { accountRequest = null; });
  return accountRequest;
}

export function clearCachedCurrentUser() {
  accountCache = null;
  accountCacheToken = null;
  accountRequest = null;
}

// Stateless preview; persisted permit evaluations use /permits/{id}/check.
export async function checkWorkRules({ siteId, workType, input }) {
  return requireRuleEvaluation(await api('/api/v1/rules/check', {
    method: 'POST',
    body: { siteId, workType, input },
  }));
}

export function useWorkSite() {
  const token = getToken();
  const cached = token && accountCacheToken === token ? accountCache : null;
  const [account, setAccount] = useState(cached);
  const [loading, setLoading] = useState(!cached);
  const [selecting, setSelecting] = useState(false);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const mounted = useRef(false);
  const selectionPending = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    getCachedCurrentUser({ force: Boolean(revision) }).then((data) => {
      if (!cancelled) {
        setAccount(data);
        setError('');
      }
    }).catch((requestError) => {
      if (!cancelled) setError(requestError.message || '현장 정보를 불러오지 못했습니다.');
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [revision]);

  const selectSite = async (value) => {
    if (selectionPending.current || loading) return;
    const site = account?.sites.find((item) => String(item.siteId) === String(value));
    if (!site) {
      setError('접근 가능한 현장을 선택해 주세요.');
      return;
    }
    selectionPending.current = true;
    setSelecting(true);
    setError('');
    try {
      await setLastSite(site.siteId);
      accountCache = { ...account, currentSiteId: site.siteId };
      if (mounted.current) setAccount(accountCache);
    } catch (requestError) {
      if (mounted.current) setError(requestError.message || '현장 선택을 저장하지 못했습니다.');
    } finally {
      selectionPending.current = false;
      if (mounted.current) setSelecting(false);
    }
  };

  const currentSite = account?.sites.find((site) => site.siteId === account.currentSiteId) ?? null;
  return {
    account, currentSite, loading, selecting, error, selectSite,
    reload: () => { accountCache = null; setAccount(null); setLoading(true); setError(''); setRevision((value) => value + 1); },
  };
}
