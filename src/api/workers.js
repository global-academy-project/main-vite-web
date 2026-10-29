import { useEffect, useRef, useState } from 'react';
import { api, getCurrentUser } from './client';
import { setLastSite } from './users';
import { requireRuleEvaluation } from './jobs.js';

export const workTypes = { GENERAL: '일반', HOT: '화기', CONFINED: '밀폐공간', HEIGHT: '고소' };
export const typeClass = { GENERAL: 'type-normal', HOT: 'type-hot', CONFINED: 'type-closed', HEIGHT: 'type-height' };
export const statusClass = { BLOCKED: 'status-blocked', PENDING: 'status-waiting', APPROVED: 'status-approved' };
export const siteRoles = { ADMIN: '회사 관리자', WRITER: '작성자', APPROVER: '승인자', SITE_ADMIN: '현장 관리자' };
export async function checkWorkRules({ siteId, workType, input }) { return requireRuleEvaluation(await api('/api/v1/rules/check', { method: 'POST', body: { siteId, workType, input } })); }
function selectInitialSite(account) { const sites = Array.isArray(account?.sites) ? account.sites : []; const lastSiteId = account?.currentSiteId ?? account?.user?.lastSiteId; return String(sites.find((site) => String(site.siteId ?? site.id) === String(lastSiteId))?.siteId ?? sites.find((site) => site.active !== false)?.siteId ?? sites[0]?.siteId ?? ''); }
export function useWorkSite() {
  const [account, setAccount] = useState(null); const [selectedSiteId, setSelectedSiteId] = useState(''); const [loading, setLoading] = useState(true); const [selecting, setSelecting] = useState(false); const [error, setError] = useState(''); const [revision, setRevision] = useState(0); const mounted = useRef(false); const selectionPending = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => { let cancelled = false; getCurrentUser().then((currentAccount) => { if (!currentAccount?.user || !Array.isArray(currentAccount.sites)) throw new Error('사용자·현장 응답 형식이 올바르지 않습니다.'); if (!cancelled) { setAccount(currentAccount); setSelectedSiteId(selectInitialSite(currentAccount)); setError(''); } }).catch((requestError) => { if (!cancelled) setError(requestError.message || '현장 정보를 불러오지 못했습니다.'); }).finally(() => { if (!cancelled) setLoading(false); }); return () => { cancelled = true; }; }, [revision]);
  const sites = Array.isArray(account?.sites) ? account.sites : []; const currentSite = sites.find((site) => String(site.siteId ?? site.id) === selectedSiteId) ?? null;
  const selectSite = async (siteId) => { if (selectionPending.current || loading) return; const site = sites.find((item) => String(item.siteId ?? item.id) === String(siteId)); if (!site) { setError('접근 가능한 현장을 선택해 주세요.'); return; } selectionPending.current = true; setSelecting(true); setError(''); try { await setLastSite(site.siteId ?? site.id); if (mounted.current) setSelectedSiteId(String(site.siteId ?? site.id)); } catch (requestError) { if (mounted.current) setError(requestError.message || '현장을 변경하지 못했습니다.'); } finally { selectionPending.current = false; if (mounted.current) setSelecting(false); } };
  return { account, sites, currentSite, loading, selecting, error, selectSite, reload: () => { setAccount(null); setSelectedSiteId(''); setError(''); setRevision((value) => value + 1); } };
}
