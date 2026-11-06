import { useEffect, useRef, useState } from 'react';
import {
  approveUser, changeUserRole, deactivateUser, getAdminSites, getAdminUsers, issueTemporaryPassword, reactivateUser,
  replaceUserSites, saveAdminSite, unlockUser, verifyUserEmail,
} from '../api/admin';
import { useToast } from '../components/ui/toast-context.js';

const NO_REPLY = '응답을 받지 못했다면 새로고침으로 반영 여부를 확인하세요.';

/**
 * 관리 화면(회사 관리자) 상태와 동작.
 *  - 회원은 전체를 한 번 받아 화면에서 상태별로 나눠 본다(상태별 인원 표시). 현장은 사용 중지 포함 전체
 *  - 쓰기는 한 번에 하나(두 번 누름 막기). 성공하면 받은 회원으로 목록을 바꾸고, 실패는 토스트로 알린다
 *  - 자기 자신·마지막 관리자 보호 같은 규칙은 서버가 판단한다
 */
export function useAdmin({ enabled, onSitesChanged }) {
  const toast = useToast();
  const [users, setUsers] = useState({ key: null, list: [], error: '' });
  const [sites, setSites] = useState({ key: null, list: [], error: '' });
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const key = String(revision);

  useEffect(() => {
    if (!enabled) return undefined;
    let active = true;
    getAdminUsers().then((list) => { if (active) setUsers({ key, list, error: '' }); })
      .catch((error) => { if (active) setUsers({ key, list: [], error: error.message || '회원 목록을 불러오지 못했습니다.' }); });
    getAdminSites().then((list) => { if (active) setSites({ key, list, error: '' }); })
      .catch((error) => { if (active) setSites({ key, list: [], error: error.message || '현장 목록을 불러오지 못했습니다.' }); });
    return () => { active = false; };
  }, [enabled, key]);

  const replaceUser = (saved) => setUsers((current) => ({ ...current, list: current.list.map((user) => (user.userId === saved.userId ? saved : user)) }));

  /** 쓰기 한 번. 성공하면 결과 값, 실패하면 null */
  const run = async (action, success) => {
    if (pending.current) return null;
    pending.current = true; setBusy(true);
    try {
      const result = await action();
      if (success) toast.show({ tone: 'success', message: typeof success === 'function' ? success(result) : success, duration: 6000 });
      return result ?? true;
    } catch (error) {
      toast.show({ tone: 'error', message: `${error.message || '요청에 실패했습니다.'} ${error.status ? '' : NO_REPLY}`.trim(), duration: 9000 });
      return null;
    } finally { pending.current = false; setBusy(false); }
  };
  const userWrite = (action, success) => run(async () => { const saved = await action(); replaceUser(saved); return saved; }, success);

  return {
    users: users.list, usersLoading: enabled && users.key !== key, usersError: users.key === key ? users.error : '',
    sites: sites.list, sitesLoading: enabled && sites.key !== key, sitesError: sites.key === key ? sites.error : '',
    busy, reload: () => setRevision((value) => value + 1),
    approve: (user, role, grants) => userWrite(() => approveUser(user.userId, { role, sites: grants }), `${user.name} 님 가입을 승인했습니다.`),
    saveGrants: (user, grants) => userWrite(() => replaceUserSites(user.userId, grants), `${user.name} 님의 현장 권한을 저장했습니다.`),
    changeRole: (user, role) => userWrite(() => changeUserRole(user.userId, role), `${user.name} 님 역할을 바꿨습니다.`),
    unlock: (user) => userWrite(() => unlockUser(user.userId), `${user.name} 님 잠금을 풀었습니다.`),
    verifyEmail: (user) => userWrite(() => verifyUserEmail(user.userId), `${user.name} 님 이메일을 인증 처리했습니다.`),
    deactivate: (user) => userWrite(() => deactivateUser(user.userId), `${user.name} 님을 사용 중지했습니다. 로그인 중인 세션도 끊깁니다.`),
    reactivate: (user) => userWrite(() => reactivateUser(user.userId), `${user.name} 님을 다시 사용하게 했습니다.`),
    temporaryPassword: (user) => run(() => issueTemporaryPassword(user.userId), null),
    saveSite: (siteId, body) => run(async () => {
      const saved = await saveAdminSite(siteId, body);
      setSites((current) => ({ ...current, list: siteId == null ? [...current.list, saved] : current.list.map((site) => (site.siteId === saved.siteId ? saved : site)) }));
      onSitesChanged?.();
      return saved;
    }, siteId == null ? '현장을 등록했습니다. 회원에게 현장 권한을 주면 쓸 수 있습니다.' : '현장을 수정했습니다.'),
  };
}
