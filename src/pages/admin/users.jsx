import { useEffect, useRef, useState } from 'react';
import { approveUser, getAdminUsers, replaceUserSites, userStatuses } from '../../api/admin';
import { useWorkSite } from '../../api/workers';
import JobPageLayout, { JobPageHeading } from '../../components/job-page-layout';

function MemberPermissions({ member, sites, onSaved }) {
  const [role, setRole] = useState('MEMBER');
  const [permissions, setPermissions] = useState(() => member.sites
    .filter((site) => site.role !== 'ADMIN').map(({ siteId, role }) => ({ siteId, role })));
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  const save = async (event) => {
    event.preventDefault();
    if (pending.current) return;
    pending.current = true;
    setBusy(true); setError(''); setMessage('');
    try {
      const saved = member.status === 'PENDING'
        ? await approveUser(member.userId, { role, sites: permissions })
        : await replaceUserSites(member.userId, permissions);
      if (mounted.current) {
        onSaved(saved);
        setMessage('서버에 반영했습니다.');
      }
    } catch (requestError) {
      if (mounted.current) setError(`${requestError.message} 응답을 받지 못했다면 회원 목록을 다시 조회해 반영 여부를 확인하세요.`);
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
  };
  const availableSites = [...sites];
  for (const assigned of member.sites) {
    if (!availableSites.some((site) => site.siteId === assigned.siteId)) availableSites.push(assigned);
  }
  return (
    <form className="panel job-form" onSubmit={save}>
      <h2>{member.name} · 가입 승인 / 현장 권한</h2>
      <p>{member.email} · {userStatuses[member.status]} · 이메일 {member.emailVerified ? '인증 완료' : '미인증'}</p>
      {error && <p role="alert" className="dashboard-error">{error}</p>}
      {message && <p role="status">{message}</p>}
      <fieldset disabled={busy || (member.role === 'ADMIN' && member.status !== 'PENDING')}>
        <legend>현장 권한 전체 설정</legend>
        {member.status === 'PENDING' && <label>승인할 계정 역할<select value={role} onChange={(event) => setRole(event.target.value)}>
          <option value="MEMBER">일반 회원</option><option value="ADMIN">회사 관리자 (모든 현장 접근)</option>
        </select></label>}
        {member.role === 'ADMIN' && <p className="job-help">회사 관리자의 sites는 실제 개별 배치가 아닌 전체 접근 현장입니다. 이 응답으로 기존 배치를 덮어쓰지 않도록 현장 권한 편집을 제공하지 않습니다.</p>}
        <div className="job-fields">
          {availableSites.map((site) => <label key={site.siteId}>{site.name} (#{site.siteId})
            <select value={permissions.find((item) => item.siteId === site.siteId)?.role ?? ''}
              onChange={(event) => setPermissions((current) => [
                ...current.filter((item) => item.siteId !== site.siteId),
                ...(event.target.value ? [{ siteId: site.siteId, role: event.target.value }] : []),
              ])}>
              <option value="">권한 없음</option><option value="WRITER">작성자</option>
              <option value="APPROVER">승인자</option><option value="SITE_ADMIN">현장 관리자</option>
            </select>
          </label>)}
        </div>
        <p className="job-help">저장하면 현장 권한을 전체 교체합니다. 권한 없음으로 바꾼 현장은 접근 권한이 회수됩니다.</p>
        {!availableSites.length && <p className="job-help">계정에서 조회 가능한 현장이 없습니다. 현장 생성 API는 제공되지 않습니다.</p>}
        <button type="submit" disabled={member.status === 'PENDING' && !member.emailVerified}>
          {member.status === 'PENDING' ? '가입 승인' : '현장 권한 전체 저장'}
        </button>
        {member.status === 'PENDING' && !member.emailVerified && <p className="job-help">이메일 인증 후 가입 승인할 수 있습니다.</p>}
      </fieldset>
    </form>
  );
}

export default function AdminUsers() {
  const context = useWorkSite();
  const [status, setStatus] = useState('PENDING');
  const [members, setMembers] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const [message, setMessage] = useState('');
  const isAdmin = context.account?.user?.role === 'ADMIN';
  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    getAdminUsers(status).then((data) => {
      if (!cancelled) { setMembers(data); setError(''); }
    }).catch((requestError) => {
      if (!cancelled) { setMembers([]); setError(requestError.message); }
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [status, revision, isAdmin]);
  const selected = members.find((member) => member.userId === selectedId);
  return (
    <JobPageLayout title="가입 승인·현장 권한" user={context.account?.user} contentClassName="job-management">
      <JobPageHeading title="가입 승인·현장 권한" description="회사 관리자용 회원 목록·가입 승인·현장 권한 관리입니다. 작업자 배치 명단과는 다릅니다." />
      {message && <p role="status" className="job-review-notice">{message}</p>}
      {context.loading ? <p role="status">계정 확인 중...</p>
        : context.error ? <p role="alert" className="dashboard-error">{context.error}<button onClick={context.reload}>계정 다시 조회</button></p>
          : !isAdmin ? <p role="alert">회사 관리자(ADMIN)만 사용할 수 있습니다.</p> : <>
            <section className="panel job-form">
              <label>회원 상태<select value={status} onChange={(event) => {
                setStatus(event.target.value); setSelectedId(null); setLoading(true); setError('');
              }}><option value="">전체</option>{Object.entries(userStatuses).map(([code, label]) => <option key={code} value={code}>{label}</option>)}</select></label>
              <button type="button" disabled={loading} onClick={() => {
                setSelectedId(null); setLoading(true); setRevision((value) => value + 1);
              }}>회원 목록 다시 조회</button>
              {error && <p role="alert" className="dashboard-error">{error}</p>}
              {loading ? <p role="status">회원 목록 조회 중...</p> : <div className="table-scroll"><table>
                <thead><tr><th>이름</th><th>이메일</th><th>계정 역할</th><th>상태</th><th>관리</th></tr></thead>
                <tbody>{members.map((member) => <tr key={member.userId}>
                  <td>{member.name}</td><td>{member.email}</td><td>{member.role}</td><td>{userStatuses[member.status]}</td>
                  <td><button type="button" onClick={() => setSelectedId(member.userId)}>권한 관리 · {member.name}</button></td>
                </tr>)}</tbody>
              </table>{!error && !members.length && <p>해당 상태의 회원이 없습니다.</p>}</div>}
            </section>
            {selected && <MemberPermissions key={selected.userId} member={selected} sites={context.account.sites} onSaved={(saved) => {
              setMembers((current) => current.map((member) => member.userId === saved.userId ? saved : member)
                .filter((member) => !status || member.status === status));
              setMessage(`${saved.name} 회원의 승인·현장 권한을 서버에 반영했습니다.`);
            }} />}
          </>}
    </JobPageLayout>
  );
}
