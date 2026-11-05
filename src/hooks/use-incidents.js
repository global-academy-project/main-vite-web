import { useEffect, useRef, useState } from 'react';
import {
  createIncident, getIncident, getIncidents, getSiteZones, getTagCodes, reviewIncidentTags, searchIncidents,
} from '../api/incidents';
import { toIncidentFilters } from '../utils/agentic-rag-tags';
import { useToast } from '../components/ui/toast-context.js';

/**
 * 아차사고 화면 상태와 동작. 기존 job-incidents.jsx 의 규칙을 그대로 옮겼다.
 *  - 태그 코드표·구역·최근 보고 목록을 같이 받는다 (현장이 바뀌면 다시)
 *  - 변경은 한 번에 하나. 응답을 못 받으면(WRITE_OUTCOME_UNKNOWN) 목록을 다시 받고, 확인 전까지 저장을 잠근다
 *  - 다른 현장의 보고는 열지 않는다
 *  - 태그 저장은 전체 교체(lockVersion 충돌 시 서버 오류 그대로), 중대도는 하나만
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
  const mounted = useRef(false);
  const pending = useRef(false);
  // 주소로 들어온 보고 번호는 처음 한 번만 연다 (이후 열기·닫기는 open/close 로, 목록을 다시 받지 않는다)
  const [startId] = useState(initialId);
  const key = `${siteId}:${revision}`;
  const loading = loadState.key !== key;

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

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
      toast.show({ tone: 'success', message: `보고 #${saved.nearMissId}을 저장했습니다. 태그는 열어서 직접 검토해 주세요.` });
    });
    return ok ? saved : null;
  };

  const saveTags = () => run(async () => {
    if (tags.filter((tag) => tag.axis === 'SEVERITY').length > 1) throw new Error('중대도(SEVERITY)는 하나만 선택할 수 있습니다.');
    const reviewed = await reviewIncidentTags(selected.nearMissId, selected.lockVersion, tags);
    if (mounted.current) { apply(reviewed); toast.show({ tone: 'success', message: '검토한 태그를 저장했습니다.' }); }
  });

  const searchRelated = (query) => run(async () => {
    const found = await searchIncidents({ siteId, zoneId: selected.zoneId, query, filters: toIncidentFilters(tags), limit: 5 });
    if (mounted.current) setRelated(found);
  });

  const tagsDirty = Boolean(selected) && JSON.stringify(tags) !== JSON.stringify(selected.tags);

  return {
    loading, loadError: loading ? '' : loadState.error, resources, error, busy, uncertain,
    locked: disabled || busy || loading || !resources || uncertain,
    selected, tags, tagsDirty, related,
    setTags: (next) => { setTags(next); setRelated(null); },
    close: () => { setSelected(null); setRelated(null); setError(''); },
    reload: () => setRevision((value) => value + 1),
    unlock: () => { setUncertain(false); setError(''); },
    open, create, saveTags, searchRelated,
  };
}
