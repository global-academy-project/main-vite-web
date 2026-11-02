import { useEffect, useRef, useState } from 'react';
import { getSiteWorkers } from '../../api/tbm';
import {
  changeWorkerAssignment, getJobZones, getTeams, referencePermissions, saveTeam, saveWorker, saveZone,
} from '../../api/job-reference';
import { localDate, siteWorkerBody } from '../../utils/job-forms';

const emptyWorker = { name: '', phone: '', clearPhone: false, jobType: '', employmentType: 'DIRECT', teamId: '', assignedFrom: '' };
const emptyZone = { code: '', name: '', zoneType: '', confined: false, hazardNote: '', active: true };
const emptyTeam = { name: '', teamType: 'INTERNAL', businessNo: '', active: true };

export default function JobReferenceData({ site, user, disabled }) {
  const permissions = referencePermissions(user, site);
  const [resources, setResources] = useState({});
  const [errors, setErrors] = useState({});
  const [worker, setWorker] = useState(emptyWorker);
  const [zone, setZone] = useState(emptyZone);
  const [team, setTeam] = useState(emptyTeam);
  const [assignmentId, setAssignmentId] = useState('');
  const [assignmentDate, setAssignmentDate] = useState(localDate);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [blocked, setBlocked] = useState('');
  const [revision, setRevision] = useState(0);
  const pending = useRef(false);

  useEffect(() => {
    let active = true;
    const loaders = { workers: () => getSiteWorkers(site.siteId), zones: () => getJobZones(site.siteId, true), teams: () => getTeams(true) };
    for (const [kind, load] of Object.entries(loaders)) {
      load().then((list) => {
        if (active) {
          setResources((current) => ({ ...current, [kind]: list }));
          setErrors((current) => ({ ...current, [kind]: '' }));
          setBlocked((current) => current === kind ? '' : current);
        }
      }).catch((requestError) => { if (active) setErrors((current) => ({ ...current, [kind]: requestError.message })); });
    }
    return () => { active = false; };
  }, [site.siteId, revision]);

  const run = async (kind, action, success) => {
    if (pending.current || disabled || blocked === kind) return;
    pending.current = true; setBusy(true); setError(''); setMessage('');
    try {
      await action();
      setMessage(success); setRevision((value) => value + 1);
    } catch (requestError) {
      setError(requestError.message || '기준 정보 저장에 실패했습니다.');
      if (requestError.code === 'WRITE_OUTCOME_UNKNOWN' || requestError.code === 'CONFLICT_MODIFIED') setBlocked(kind);
    } finally { pending.current = false; setBusy(false); }
  };
  const refresh = () => {
    setWorker(emptyWorker); setZone(emptyZone); setTeam(emptyTeam);
    setResources({}); setErrors({}); setRevision((value) => value + 1);
  };
  const locked = disabled || busy;
  const workerLocked = locked || !permissions.manageSite || blocked === 'workers' || !resources.workers;
  const zoneLocked = locked || !permissions.manageSite || blocked === 'zones' || !resources.zones;
  const teamLocked = locked || !permissions.manageTeams || blocked === 'teams' || !resources.teams;

  return <section aria-label="현장 기준 정보 관리">
    <h2>작업자·현장 배치·구역·팀 관리</h2>
    <p className="job-help">작업자·구역 변경은 현장 관리자 이상, 팀·협력업체 변경은 회사 관리자만 가능합니다.</p>
    <button type="button" disabled={locked} onClick={refresh}>기준 정보 전체 새로고침 (편집 초기화)</button>
    {message && <p role="status">{message}</p>}{error && <p className="dashboard-error" role="alert">{error}</p>}
    {blocked && <p role="alert">저장 결과 또는 최신 버전 확인이 필요합니다. 목록을 새로고침해 반영 여부를 확인하세요.</p>}
    {Object.entries(errors).filter(([, text]) => text).map(([kind, text]) => <p className="dashboard-error" role="alert" key={kind}>{kind} 조회: {text}</p>)}

    <section className="panel job-form">
      <h3>현장 작업자</h3>
      {resources.workers?.some((entry) => !Number.isInteger(entry.lockVersion))
        && <p className="job-help">작업자 수정은 lockVersion이 포함된 최신 서버 응답이 필요합니다. 현재 버전 없는 항목은 수정 버튼을 비활성화했습니다.</p>}
      {!resources.workers && !errors.workers && <p role="status">작업자 조회 중...</p>}
      {resources.workers && <div className="table-scroll"><table>
        <thead><tr><th>ID / 이름</th><th>직종 / 고용 형태</th><th>팀</th><th>배치 기간</th><th>편집</th></tr></thead>
        <tbody>{resources.workers.map((entry) => <tr key={entry.workerId}>
          <td>#{entry.workerId} {entry.name}</td><td>{entry.jobType} / {entry.employmentType}</td>
          <td>{entry.teamName ?? '미지정'}</td><td>{entry.assignedFrom} ~ {entry.assignedTo ?? '배치 중'}</td>
          <td><button type="button" disabled={workerLocked || !Number.isInteger(entry.lockVersion)} onClick={() => {
            setWorker({ ...emptyWorker, ...entry, phone: '', jobType: entry.jobType ?? '', teamId: entry.teamId == null ? '' : String(entry.teamId) });
          }}>작업자 수정</button></td>
        </tr>)}</tbody>
      </table></div>}
      <form onSubmit={(event) => {
        event.preventDefault();
        if (workerLocked) return;
        void run('workers', async () => {
          await saveWorker(site.siteId, worker.workerId, siteWorkerBody(worker)); setWorker(emptyWorker);
        }, '작업자 정보를 저장했습니다. 목록에서 확인하세요.');
      }}>
        <fieldset disabled={workerLocked}>
          <legend>{worker.workerId ? `작업자 #${worker.workerId} 수정` : '작업자 신규 등록 + 현장 배치'}</legend>
          <div className="job-fields">
            <label>작업자 이름<input required maxLength={50} value={worker.name} onChange={(e) => setWorker({ ...worker, name: e.target.value })} /></label>
            <label>연락처{worker.workerId ? ' (미입력 시 기존 값 유지)' : ' (선택)'}<input type="tel" maxLength={20}
              disabled={worker.clearPhone} value={worker.phone} onChange={(e) => setWorker({ ...worker, phone: e.target.value })} /></label>
            {worker.workerId && <label><input type="checkbox" checked={worker.clearPhone}
              onChange={(e) => setWorker({ ...worker, clearPhone: e.target.checked })} />기존 연락처 삭제</label>}
            <label>직종<input maxLength={50} value={worker.jobType ?? ''} onChange={(e) => setWorker({ ...worker, jobType: e.target.value })} /></label>
            <label>고용 형태<select value={worker.employmentType} onChange={(e) => setWorker({ ...worker, employmentType: e.target.value })}>
              <option value="DIRECT">직영</option><option value="CONTRACTOR">협력업체</option><option value="DAILY">일용</option>
            </select></label>
            <label>작업자 팀<select value={worker.teamId} disabled={!resources.teams || Boolean(errors.teams)}
              onChange={(e) => setWorker({ ...worker, teamId: e.target.value })}>
              <option value="">미지정</option>
              {resources.teams?.filter((entry) => entry.active).map((entry) => <option key={entry.teamId} value={entry.teamId}>{entry.name}</option>)}
              {worker.teamId && !resources.teams?.some((entry) => entry.active && String(entry.teamId) === String(worker.teamId))
                && <option value={worker.teamId}>기존 팀 #{worker.teamId} (사용 여부 확인 필요)</option>}
            </select></label>
            {!worker.workerId && <label>배치 시작일 (미입력 시 서버 기본값)<input type="date" value={worker.assignedFrom} onChange={(e) => setWorker({ ...worker, assignedFrom: e.target.value })} /></label>}
          </div>
          {worker.workerId && <p className="job-help">연락처는 조회되지 않으며 미입력하면 유지됩니다. 삭제 선택 시에만 지웁니다. 미지정 팀은 기존 팀 연결을 제거합니다.</p>}
          <button type="submit">작업자 저장</button>
          <button type="button" onClick={() => setWorker(emptyWorker)}>새 작업자 / 편집 초기화</button>
        </fieldset>
      </form>
      <fieldset disabled={workerLocked}>
        <legend>기존 작업자 현장 배치 / 떠남</legend>
        <div className="job-fields">
          <label>기존 작업자 ID<input inputMode="numeric" value={assignmentId} onChange={(e) => setAssignmentId(e.target.value)} /></label>
          <label>배치·떠남 날짜 (비우면 오늘)<input type="date" value={assignmentDate} onChange={(e) => setAssignmentDate(e.target.value)} /></label>
        </div>
        <button type="button" onClick={() => {
          void run('workers', () => changeWorkerAssignment(site.siteId, assignmentId, 'assign', assignmentDate), '현장 배치를 저장했습니다.');
        }}>기존 작업자 배치</button>
        <button type="button" onClick={() => {
          if (!window.confirm('이 작업자를 현장 배치에서 종료합니까? 떠난 작업자는 TBM 선택 목록에서 제외됩니다.')) return;
          void run('workers', () => changeWorkerAssignment(site.siteId, assignmentId, 'leave', assignmentDate), '현장 떠남을 저장했습니다.');
        }}>현장 떠남 처리</button>
      </fieldset>
    </section>

    <section className="panel job-form">
      <h3>현장 구역 (사용 중지 포함)</h3>
      {resources.zones?.map((entry) => <p key={entry.zoneId}>{entry.code} · {entry.name} · {entry.active ? '사용 중' : '사용 중지'}
        <button type="button" disabled={zoneLocked} onClick={() => setZone({ ...entry, zoneType: entry.zoneType ?? '', hazardNote: entry.hazardNote ?? '' })}>구역 수정</button>
      </p>)}
      <form onSubmit={(event) => {
        event.preventDefault(); if (zoneLocked) return;
        void run('zones', async () => {
          const body = { code: zone.code.trim(), name: zone.name.trim(), zoneType: zone.zoneType.trim() || null,
            confined: zone.confined, hazardNote: zone.hazardNote.trim() || null, active: zone.zoneId ? zone.active : null };
          if (!body.code || !body.name) throw new Error('구역 코드·이름을 입력하세요.');
          await saveZone(site.siteId, zone.zoneId, body); setZone(emptyZone);
        }, '구역을 저장했습니다.');
      }}>
        <fieldset disabled={zoneLocked}>
          <legend>{zone.zoneId ? `구역 #${zone.zoneId} 수정` : '구역 등록'}</legend>
          <div className="job-fields">
            <label>구역 코드<input required maxLength={30} value={zone.code} onChange={(e) => setZone({ ...zone, code: e.target.value })} /></label>
            <label>구역 이름<input required maxLength={100} value={zone.name} onChange={(e) => setZone({ ...zone, name: e.target.value })} /></label>
            <label>구역 유형<input maxLength={30} value={zone.zoneType} placeholder="예: PROCESS" onChange={(e) => setZone({ ...zone, zoneType: e.target.value })} /></label>
            <label>유해·위험 참고<textarea maxLength={500} value={zone.hazardNote} onChange={(e) => setZone({ ...zone, hazardNote: e.target.value })} /></label>
            <label><input type="checkbox" checked={zone.confined} onChange={(e) => setZone({ ...zone, confined: e.target.checked })} />밀폐공간</label>
            {zone.zoneId && <label><input type="checkbox" checked={zone.active} onChange={(e) => setZone({ ...zone, active: e.target.checked })} />구역 사용 중</label>}
          </div>
          <button type="submit">구역 저장</button><button type="button" onClick={() => setZone(emptyZone)}>새 구역 / 편집 초기화</button>
        </fieldset>
      </form>
    </section>

    <section className="panel job-form">
      <h3>팀·협력업체 (사용 중지 포함)</h3>
      {resources.teams?.map((entry) => <p key={entry.teamId}>{entry.name} · {entry.teamType} · {entry.active ? '사용 중' : '사용 중지'}
        <button type="button" disabled={teamLocked} onClick={() => setTeam({ ...entry, businessNo: entry.businessNo ?? '' })}>팀 수정</button>
      </p>)}
      <form onSubmit={(event) => {
        event.preventDefault(); if (teamLocked) return;
        void run('teams', async () => {
          const businessNo = team.businessNo.replaceAll('-', '').trim();
          if (!team.name.trim()) throw new Error('팀 이름을 입력하세요.');
          if (team.teamType === 'EXTERNAL' && businessNo && !/^\d{10}$/.test(businessNo)) throw new Error('사업자등록번호는 숫자 10자리여야 합니다.');
          await saveTeam(team.teamId, { name: team.name.trim(), teamType: team.teamType,
            businessNo: team.teamType === 'EXTERNAL' ? businessNo || null : null, active: team.teamId ? team.active : null });
          setTeam(emptyTeam);
        }, '팀·협력업체 정보를 저장했습니다.');
      }}>
        <fieldset disabled={teamLocked}>
          <legend>{team.teamId ? `팀 #${team.teamId} 수정` : '팀 등록'}</legend>
          <div className="job-fields">
            <label>팀·업체 이름<input required maxLength={100} value={team.name} onChange={(e) => setTeam({ ...team, name: e.target.value })} /></label>
            <label>팀 유형<select value={team.teamType} onChange={(e) => setTeam({ ...team, teamType: e.target.value })}>
              <option value="INTERNAL">사내</option><option value="EXTERNAL">외부 업체</option>
            </select></label>
            {team.teamType === 'EXTERNAL' && <label>사업자등록번호<input maxLength={12} value={team.businessNo} onChange={(e) => setTeam({ ...team, businessNo: e.target.value })} /></label>}
            {team.teamId && <label><input type="checkbox" checked={team.active} onChange={(e) => setTeam({ ...team, active: e.target.checked })} />팀 사용 중</label>}
          </div>
          <button type="submit">팀 저장</button><button type="button" onClick={() => setTeam(emptyTeam)}>새 팀 / 편집 초기화</button>
        </fieldset>
      </form>
    </section>
  </section>;
}
