import { useState } from 'react';
import { siteRoles, useWorkSite } from '../../api/workers';
import JobPageLayout, { JobPageHeading } from '../../components/job-page-layout';
import { JobSiteSelector } from './job-work-form';
import '../../style/job/job-search.css';

export default function JobSearch() {
  const context = useWorkSite();
  const [search, setSearch] = useState('');
  const sites = context.account?.sites ?? [];
  const query = search.trim().toLocaleLowerCase('ko-KR');
  const filteredSites = sites.filter((site) => `${site.name} ${site.siteId}`.toLocaleLowerCase('ko-KR').includes(query));
  return (
    <JobPageLayout title="현장목록" user={context.account?.user}>
      <JobPageHeading title="현장목록" description="로그인한 계정에 접근 권한이 있는 현장을 조회하고 현재 현장을 선택합니다." />
      <JobSiteSelector context={context} />
      <section className="panel site-list-panel" aria-label="등록된 현장 목록">
        <div className="site-list-toolbar">
          <h2>등록된 현장 <small>{sites.length}곳</small></h2>
          <label>
            <span className="sr-only">현장 검색</span>
            <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="현장명 또는 ID 검색" />
          </label>
        </div>
        {context.loading ? <p role="status">현장 목록을 불러오는 중입니다...</p> : context.account && (
          filteredSites.length ? <div className="table-scroll">
            <table>
              <thead><tr><th>현장명</th><th>현장 ID</th><th>현장 역할</th><th>현재 현장</th></tr></thead>
              <tbody>
                {filteredSites.map((site) => <tr key={site.siteId}>
                  <td>{site.name}</td>
                  <td>{site.siteId}</td>
                  <td>{siteRoles[site.role] ?? site.role}</td>
                  <td>{site.siteId === context.currentSite?.siteId ? '선택됨' : <button type="button" className="job-history-refresh"
                    disabled={context.selecting} onClick={() => context.selectSite(site.siteId)}>현장 선택</button>}</td>
                </tr>)}
              </tbody>
            </table>
          </div> : <div className="site-list-empty">
            <h3>{sites.length ? '검색 결과가 없습니다' : '등록된 현장이 없습니다'}</h3>
            <p>{sites.length ? '검색어를 바꾸어 다시 확인해 주세요.' : '관리자에게 현장 권한을 요청하세요.'}</p>
          </div>
        )}
      </section>
    </JobPageLayout>
  );
}
