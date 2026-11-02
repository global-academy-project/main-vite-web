import { useEffect, useState } from 'react';
import { getJobZones, getTeams } from '../api/job-reference';

export default function JobReferenceSelectors({ siteId, teamId, zoneId, onChange, disabled, showTeams = true }) {
  const [teams, setTeams] = useState(null);
  const [zones, setZones] = useState(null);
  const [errors, setErrors] = useState({});
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    if (showTeams) getTeams().then((data) => {
      if (active) { setTeams(data); setErrors((current) => ({ ...current, teams: '' })); }
    }).catch((error) => { if (active) setErrors((current) => ({ ...current, teams: error.message })); });
    getJobZones(siteId).then((data) => {
      if (active) { setZones(data); setErrors((current) => ({ ...current, zones: '' })); }
    }).catch((error) => { if (active) setErrors((current) => ({ ...current, zones: error.message })); });
    return () => { active = false; };
  }, [siteId, revision, showTeams]);
  return <>
    {showTeams && <label>팀<select value={teamId} disabled={disabled || !teams || Boolean(errors.teams)}
      onChange={(event) => onChange('teamId', event.target.value)}>
      <option value="">미지정</option>
      {teams?.map((team) => <option key={team.teamId} value={team.teamId}>{team.name}</option>)}
      {teamId && !teams?.some((team) => String(team.teamId) === String(teamId))
        && <option value={teamId}>기존 팀 #{teamId} (목록에 없음)</option>}
    </select></label>}
    <label>구역<select value={zoneId} disabled={disabled || !zones || Boolean(errors.zones)}
      onChange={(event) => onChange('zoneId', event.target.value)}>
      <option value="">미지정</option>
      {zones?.map((zone) => <option key={zone.zoneId} value={zone.zoneId}>{zone.code} · {zone.name}</option>)}
      {zoneId && !zones?.some((zone) => String(zone.zoneId) === String(zoneId))
        && <option value={zoneId}>기존 구역 #{zoneId} (목록에 없음)</option>}
    </select></label>
    {(errors.teams || errors.zones) && <div className="dashboard-error" role="alert">
      {errors.teams && <p>팀 조회: {errors.teams}</p>}{errors.zones && <p>구역 조회: {errors.zones}</p>}
      <button type="button" disabled={disabled} onClick={() => setRevision((value) => value + 1)}>기준 정보 다시 조회</button>
    </div>}
  </>;
}
