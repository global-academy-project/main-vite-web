import { useEffect, useRef, useState } from 'react';
import {
  autoTagIncident, createIncident, getAutoTagRun, getIncident, getIncidents, getSiteZones, getTagCodes, reviewIncidentTags, searchIncidents,
} from '../api/incidents';
import { toIncidentFilters } from '../utils/agentic-rag-tags';
import { useToast } from '../components/ui/toast-context.js';

// 자동 태깅 결과 기다리기: 1.5초마다, 최대 2분 (AI 서버가 늦으면 "최신 보고 다시 받기"로 나중에 확인)
const AUTO_TAG_POLL_MS = 1500;
const AUTO_TAG_MAX_POLLS = 80;
const wait = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });

/**
 * 아차사고 화면 상태와 동작. 기존 job-incidents.jsx 의 규칙을 그대로 옮겼다.
 *  - 태그 코드표·구역·최근 보고 목록을 같이 받는다 (현장이 바뀌면 다시)
 *  - 변경은 한 번에 하나. 응답을 못 받으면(WRITE_OUTCOME_UNKNOWN) 목록을 다시 받고, 확인 전까지 저장을 잠근다
 *  - 다른 현장의 보고는 열지 않는다
 *  - 태그 저장은 전체 교체(lockVersion 충돌 시 서버 오류 그대로), 중대도는 하나만
 *  - 자동 태깅: 보고를 저장하면 바로 시작하고, 열린 보고에서 다시 받을 수 있다. 결과는 제안(AI 출처)이라 저장해야 확정
 */
export function useIncidents({ siteId, initialId, disabled }) {
  const toast = useToast();
  const [resources, setResources] = useState(null);
  const [loadState, setLoadState] = useState({ key: null, error: '' });
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState('');
  const [uncertain, setUncertain] = useState(false);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState(null);
  const [tags, setTags] = useState([]);
  const [related, setRelated] = useState(null);
  const [autoTagging, setAutoTagging] = useState(null);   // 자동 태깅 중인 보고 번호
  const mounted = useRef(false);
  const openedId = useRef(null);
  const pending = useRef(false);
  // 주소로 들어온 보고 번호는 처음 한 번만 연다 (이후 열기·닫기는 open/close 로, 목록을 다시 받지 않는다)
  const [startId] = useState(initialId);
  const key = `${siteId}:${revision}`;
  const loading = loadState.key !== key;

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  // 자동 태깅 결과가 늦게 와도 지금 열려 있는 보고에만 반영한다
  useEffect(() => { openedId.current = selected?.nearMissId ?? null; }, [selected]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getTagCodes(), getSiteZones(siteId), getIncidents(siteId)])
      .then(async ([codes, zones, incidents]) => {
        if (!Array.isArray(codes) || !Array.isArray(zones) || !Array.isArray(incidents)) {
          throw new Error('태그·구역·보고 목록 응답 형식이 올바르지 않습니다.');
        }
        let opened = null;
        if (startId && revision === 0) {
          opened = await getIncident(startId);
          if (opened.siteId !== siteId) throw new Error('원본 보고의 현장을 먼저 선택해 주세요.');
        }
        if (!cancelled) {
          setResources({ codes, zones, incidents });
          if (opened) { setSelected(opened); setTags(opened.tags); setRelated(null); }
          setLoadState({ key, error: '' });
        }
      })
      .catch((requestError) => { if (!cancelled) setLoadState({ key, error: requestError.message || '아차사고 목록을 불러오지 못했습니다.' }); });
    return () => { cancelled = true; };
  }, [siteId, startId, revision, key]);

  const apply = (incident) => {
    openedId.current = incident.nearMissId;
    setSelected(incident);
    setTags(incident.tags);
    setRelated(null);
    setResources((current) => current && ({
      ...current,
      incidents: [incident, ...current.incidents.filter((item) => item.nearMissId !== incident.nearMissId)],
    }));
  };

  const run = async (action) => {
    if (pending.current || disabled || loading || uncertain) return false;
    pending.current = true;
    setBusy(true);
    setError('');
    try {
      await action();
      return true;
    } catch (requestError) {
      if (mounted.current) {
        setError(requestError.message || '요청에 실패했습니다.');
        if (requestError.code === 'WRITE_OUTCOME_UNKNOWN') {
          setUncertain(true);
          setRevision((value) => value + 1);
        }
      }
      return false;
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
  };

  const open = (id) => run(async () => {
    const incident = await getIncident(id);
    if (incident.siteId !== siteId) throw new Error('선택한 현장의 보고가 아닙니다.');
    if (mounted.current) apply(incident);
  });

  /** form: 화면 입력값(문자열). 성공하면 저장된 보고를 돌려준다 */
  const create = async (form) => {
    let saved = null;
    const ok = await run(async () => {
      saved = await createIncident({
        ...form, title: form.title.trim(), siteId,
        zoneId: form.zoneId ? Number(form.zoneId) : null,
        workId: form.workId ? Number(form.workId) : null,
      });
      if (!mounted.current) return;
      apply(saved);
      toast.show({ tone: 'success', message: `보고 #${saved.nearMissId}을 저장했습니다. AI 태그 제안을 받는 중입니다.` });
    });
    if (ok && saved && mounted.current) void autoTag(saved);
    return ok ? saved : null;
  };

  /**
   * 자동 태깅: 시작하고 끝날 때까지 기다린 뒤 보고를 다시 받는다. 기다리는 동안에도 다른 화면 동작은 막지 않는다.
   * 실패하면 이유를 보여 주고 태그를 직접 고르게 한다 (보고는 그대로)
   */
  const autoTag = async (incident) => {
    if (autoTagging || disabled || uncertain || !incident || incident.status !== 'REPORTED') return false;
    const id = incident.nearMissId;
    setAutoTagging(id);
    setError('');
    try {
      const { runId } = await autoTagIncident(id, incident.lockVersion);
      for (let poll = 0; poll < AUTO_TAG_MAX_POLLS; poll += 1) {
        await wait(AUTO_TAG_POLL_MS);
        if (!mounted.current) return false;
        const runState = await getAutoTagRun(runId, id);
        if (runState.status === 'FAILED') {
          throw new Error(`자동 태깅에 실패했습니다${runState.errorMessage ? ` (${runState.errorMessage})` : ''}. 태그를 직접 골라 저장해 주세요.`);
        }
        if (runState.status === 'DONE') {
          const fresh = await getIncident(id);
          if (!mounted.current) return false;
          // 그 사이 다른 보고를 열었으면 목록만 고친다
          if (openedId.current === id) apply(fresh);
          else setResources((current) => current && ({ ...current, incidents: current.incidents.map((item) => (item.nearMissId === id ? fresh : item)) }));
          const { savedCount, skipped = [], model } = runState.result;
          toast.show({
            tone: 'success', duration: 7000,
            message: `AI 태그 제안 ${savedCount}개를 받았습니다${model ? '' : ' (규칙만 사용)'}${skipped.length ? `, 쓸 수 없는 제안 ${skipped.length}개는 뺐습니다` : ''}. 확인하고 저장해야 확정됩니다.`,
          });
          return true;
        }
      }
      throw new Error('자동 태깅이 아직 끝나지 않았습니다. 잠시 뒤 "최신 보고 다시 받기"로 확인해 주세요.');
    } catch (requestError) {
      if (mounted.current) {
        setError(requestError.message || '자동 태깅을 시작하지 못했습니다.');
        if (requestError.code === 'WRITE_OUTCOME_UNKNOWN') setRevision((value) => value + 1);
      }
      return false;
    } finally {
      if (mounted.current) setAutoTagging(null);
    }
  };

  const saveTags = () => run(async () => {
    if (tags.filter((tag) => tag.axis === 'SEVERITY').length > 1) throw new Error('중대도(SEVERITY)는 하나만 선택할 수 있습니다.');
    const reviewed = await reviewIncidentTags(selected.nearMissId, selected.lockVersion, tags);
    if (mounted.current) { apply(reviewed); toast.show({ tone: 'success', message: '태그를 저장해 확정했습니다.' }); }
  });

  const searchRelated = (query) => run(async () => {
    const found = await searchIncidents({ siteId, zoneId: selected.zoneId, query, filters: toIncidentFilters(tags), limit: 5 });
    if (mounted.current) setRelated(found);
  });

  const tagsDirty = Boolean(selected) && JSON.stringify(tags) !== JSON.stringify(selected.tags);

  return {
    loading, loadError: loading ? '' : loadState.error, resources, error, busy, uncertain,
    locked: disabled || busy || loading || !resources || uncertain || autoTagging != null,
    autoTagging,
    selected, tags, tagsDirty, related,
    setTags: (next) => { setTags(next); setRelated(null); },
    close: () => { setSelected(null); setRelated(null); setError(''); },
    reload: () => setRevision((value) => value + 1),
    unlock: () => { setUncertain(false); setError(''); },
    open, create, saveTags, searchRelated, autoTag: () => autoTag(selected),
  };
}
