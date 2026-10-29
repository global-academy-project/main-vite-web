import { useEffect, useRef, useState } from 'react';
import { api, getCurrentUser } from './client';
import { setLastSite } from './users';
import { useEffect, useState } from 'react';
import { getCurrentUser } from './client';
import { setLastSite } from './users';

export var typeClass = { 화기: 'type-hot', 밀폐: 'type-closed', 고소: 'type-height', 일반: 'type-normal', TBM: 'type-tbm' };

export const workTypes = { GENERAL: '일반', HOT: '화기', CONFINED: '밀폐공간', HEIGHT: '고소' };
export const typeClass = { GENERAL: 'type-normal', HOT: 'type-hot', CONFINED: 'type-closed', HEIGHT: 'type-height' };
export const statusClass = { BLOCKED: 'status-blocked', PENDING: 'status-waiting', APPROVED: 'status-approved' };
export const siteRoles = { ADMIN: '회사 관리자', WRITER: '작성자', APPROVER: '승인자', SITE_ADMIN: '현장 관리자' };

// Only existing public APIs are used here; work CRUD is not available yet.
export function checkWorkRules({ siteId, workType, input }) {
  return api('/api/v1/rules/check', {
    method: 'POST',
    body: { siteId, workType, input },
  });
}

export function useWorkSite() {
  const [account, setAccount] = useState(null);
  const [loading, setLoading] = useState(true);
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
    getCurrentUser().then((data) => {
      if (!data?.user || !Array.isArray(data.sites)) {
        throw new Error('사용자·현장 응답 형식이 올바르지 않습니다.');
      }
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
      if (mounted.current) setAccount((current) => ({ ...current, currentSiteId: site.siteId }));
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
    reload: () => { setAccount(null); setLoading(true); setError(''); setRevision((value) => value + 1); },
  };
}
export function useWorkSite() {
  const [account, setAccount] = useState(null);
  const [selectedSiteId, setSelectedSiteId] = useState('');
  const [loading, setLoading] = useState(true);
  const [selecting, setSelecting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    getCurrentUser()
      .then((currentAccount) => {
        if (cancelled) return;
        const sites = Array.isArray(currentAccount?.sites) ? currentAccount.sites : [];
        setAccount(currentAccount);
        setSelectedSiteId(String(sites[0]?.siteId ?? ''));
      })
      .catch((requestError) => {
        if (!cancelled) setError(requestError.message || '현장 정보를 불러오지 못했습니다.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const sites = Array.isArray(account?.sites) ? account.sites : [];
  const currentSite = sites.find((site) => String(site.siteId) === selectedSiteId) ?? null;

  const selectSite = async (siteId) => {
    setSelecting(true);
    setError('');
    try {
      await setLastSite(siteId);
      setSelectedSiteId(String(siteId));
    } catch (requestError) {
      setError(requestError.message || '현장을 변경하지 못했습니다.');
    } finally {
      setSelecting(false);
    }
  };

  return { account, currentSite, loading, selecting, error, selectSite };
}

