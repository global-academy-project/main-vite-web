import { useState } from 'react';
import { siteRoles, useWorkSite } from '../../api/workers';
import JobPageLayout, { JobPageHeading } from '../../components/job-page-layout';

export function JobSiteSelector({ context }) {
  const { account, currentSite, loading, selecting, error, selectSite, reload } = context;
  return (
    <section className="panel job-example job-site-selector" aria-label="작업 현장 선택">
      <div className="job-site-heading"><span className="job-section-number" aria-hidden="true">01</span><div><h2>작업 현장</h2><p className="job-help">업무를 진행할 현장을 먼저 확인해 주세요.</p></div></div>
      {error && <p className="dashboard-error" role="alert">{error} <button type="button" disabled={loading || selecting} onClick={reload}>다시 조회</button></p>}
      {loading ? <p role="status">현장 정보를 불러오는 중입니다...</p> : (
        account?.sites.length ? (
          <div className="job-site-controls">
            <label>현장
              <select value={currentSite?.siteId ?? ''} disabled={selecting} onChange={(event) => selectSite(event.target.value)}>
                <option value="" disabled>현장을 선택해 주세요</option>
                {account.sites.map((site) => <option key={site.siteId} value={site.siteId}>{site.name}</option>)}
              </select>
            </label>
            <span className="job-status-badge" role="status">{selecting ? '선택 저장 중...' : `현장 역할: ${siteRoles[currentSite?.role] ?? '미선택'}`}</span>
          </div>
        ) : account && <div className="job-empty-state"><strong>선택할 수 있는 현장이 없습니다</strong><p className="job-help">{account.user?.role === 'ADMIN' ? '등록된 활성 현장이 있는지 확인해 주세요. 현장이 등록되면 이곳에 표시됩니다.' : '관리자에게 현장 권한을 요청해 주세요.'}</p></div>
      )}
    </section>
  );
}

function WorkFormFields({ context, title, children }) {
  const [reviewed, setReviewed] = useState(false);
  return (
    <form className="panel job-form" onChange={() => setReviewed(false)} onSubmit={(event) => { event.preventDefault(); setReviewed(true); }}>
      <div className="job-section-heading"><div><span className="job-eyebrow">DRAFT WORKSPACE</span><h2>{title} 작성</h2></div><span className="job-status-badge job-status-muted">화면 임시 입력</span></div>
      <fieldset disabled={context.loading || context.selecting || !context.currentSite}>
        <legend>{title} 입력</legend>
        {typeof children === 'function' ? children(context) : children}
        <div className="job-form-actions">
          <button type="submit">입력 내용 확인</button>
          <span>서버 저장 및 제출은 되지 않습니다.</span>
        </div>
        {reviewed && <p className="job-review-notice" role="status">입력 내용을 확인했습니다. 서버에는 저장되지 않았으며 승인 결과가 아닙니다.</p>}
      </fieldset>
    </form>
  );
}

export default function JobWorkForm({ title, description, children }) {
  const context = useWorkSite();
  return (
    <JobPageLayout title={title} user={context.account?.user} contentClassName="job-management">
      <JobPageHeading title={title} description={description} />
      <JobSiteSelector context={context} />
      <p className="job-demo-notice">현재 서버에는 이 업무의 저장·제출 API가 없습니다. 현장 선택만 서버에 저장되며 아래 입력은 화면을 벗어나면 사라집니다. 입력 확인은 승인이나 작업 허가가 아닙니다.</p>
      <WorkFormFields key={context.currentSite?.siteId ?? 'no-site'} context={context} title={title}>{children}</WorkFormFields>
    </JobPageLayout>
  );
}
