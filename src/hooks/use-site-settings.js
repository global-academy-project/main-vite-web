import { useEffect, useRef, useState } from 'react';
import { getSiteWorkers } from '../api/tbm';
import {
  changeWorkerAssignment, getEquipment, getJobZones, getSiteSettings, getTeams, referencePermissions,
  saveEquipment, saveSiteSettings, saveTeam, saveWorker, saveZone,
} from '../api/job-reference';
import { siteWorkerBody } from '../utils/job-forms';
import { useToast } from '../components/ui/toast-context.js';

const KINDS = ['settings', 'zones', 'equipment', 'workers', 'teams'];

/**
 * 현장 설정 화면 상태와 동작. 기존 job-reference-data.jsx 의 규칙을 그대로 옮기고 설비·현장 설정을 더했다.
 *  - 다섯 가지(현장 설정·구역·설비·작업자·팀)를 동시에 부르고, 하나가 실패해도 나머지는 보인다
 *  - 작업자·구역·설비·현장 설정 변경은 현장 관리자 이상, 팀 변경은 회사 관리자만 (최종 판단은 서버)
 *  - 저장 결과 불명·버전 충돌이면 그 종류만 새로고침 전까지 막는다
 */
export function useSiteSettings({ site, user, disabled }) {
  const toast = useToast();
  const permissions = referencePermissions(user, site);
  const [resources, setResources] = useState({});
  const [errors, setErrors] = useState({});
  const [blocked, setBlocked] = useState({});
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const pending = useRef(false);

  useEffect(() => {
    let active = true;
    const loaders = {
      settings: () => getSiteSettings(site.siteId),
      zones: () => getJobZones(site.siteId, true),
      equipment: () => getEquipment(site.siteId, true),
      workers: () => getSiteWorkers(site.siteId),
      teams: () => getTeams(true),
    };
    for (const [kind, load] of Object.entries(loaders)) {
      load().then((value) => {
        if (!active) return;
        setResources((current) => ({ ...current, [kind]: value }));
        setErrors((current) => ({ ...current, [kind]: '' }));
        setBlocked((current) => ({ ...current, [kind]: false }));
      }).catch((requestError) => { if (active) setErrors((current) => ({ ...current, [kind]: requestError.message || '불러오지 못했습니다.' })); });
    }
    return () => { active = false; };
  }, [site.siteId, revision]);

  /** 쓰기 한 번. 성공하면 목록을 다시 받는다. 성공 true / 실패 false */
  const run = async (kind, action, success) => {
    if (pending.current || disabled || blocked[kind]) return false;
    pending.current = true; setBusy(true);
    try {
      await action();
      toast.show({ tone: 'success', message: success, duration: 5000 });
      setRevision((value) => value + 1);
      return true;
    } catch (requestError) {
      toast.show({ tone: 'error', message: requestError.message || '저장하지 못했습니다.', duration: 8000 });
      if (requestError.code === 'WRITE_OUTCOME_UNKNOWN' || requestError.code === 'CONFLICT_MODIFIED') setBlocked((current) => ({ ...current, [kind]: true }));
      return false;
    } finally { pending.current = false; setBusy(false); }
  };

  const can = (kind) => !disabled && !busy && !blocked[kind] && Boolean(resources[kind])
    && (kind === 'teams' ? permissions.manageTeams : permissions.manageSite);

  return {
    permissions, resources, errors, blocked, busy, can,
    loading: (kind) => !resources[kind] && !errors[kind],
    reload: () => { setResources({}); setErrors({}); setRevision((value) => value + 1); },
    anyBlocked: KINDS.some((kind) => blocked[kind]),
    saveSettings: (body) => run('settings', () => saveSiteSettings(site.siteId, body), '현장 설정을 저장했습니다. 새 마감 시각은 다음 집계부터 적용됩니다.'),
    saveZone: (id, body) => run('zones', () => saveZone(site.siteId, id, body), id ? '구역을 수정했습니다.' : '구역을 등록했습니다.'),
    saveEquipment: (id, body) => run('equipment', () => saveEquipment(site.siteId, id, body), id ? '설비를 수정했습니다.' : '설비를 등록했습니다. 점검표에서 바로 고를 수 있습니다.'),
    saveTeam: (id, body) => run('teams', () => saveTeam(id, body), id ? '팀 정보를 수정했습니다.' : '팀을 등록했습니다.'),
    saveWorker: (worker) => run('workers', async () => { await saveWorker(site.siteId, worker.workerId, siteWorkerBody(worker)); },
      worker.workerId ? '작업자 정보를 수정했습니다.' : '작업자를 등록하고 현장에 배치했습니다.'),
    assign: (workerId, date) => run('workers', () => changeWorkerAssignment(site.siteId, workerId, 'assign', date), '현장 배치를 저장했습니다.'),
    leave: (workerId, date) => run('workers', () => changeWorkerAssignment(site.siteId, workerId, 'leave', date), '현장 떠남을 저장했습니다. TBM 참석자 목록에서 빠집니다.'),
  };
}
