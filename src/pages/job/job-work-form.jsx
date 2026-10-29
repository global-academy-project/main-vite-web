import { useState } from 'react';
import { siteRoles, useWorkSite } from '../../api/workers';

export function JobSiteSelector({ context }) {
  const { account, currentSite, loading, selecting, error, selectSite, reload } = context;
  return (
    <section className="panel job-example" aria-label="작업 현장 선택">
      {error && <p className="dashboard-error" role="alert">{error} <button type="button" disabled={loading || selecting} onClick={reload}>다시 조회</button></p>}
      {loading ? <p role="status">현장 정보를 불러오는 중입니다...</p> : (
        account?.sites.length ? (
          <div className="job-fields">
            <label>현장
              <select value={currentSite?.siteId ?? ''} disabled={selecting} onChange={(event) => selectSite(event.target.value)}>
                <option value="" disabled>현장을 선택해 주세요</option>
                {account.sites.map((site) => <option key={site.siteId} value={site.siteId}>{site.name}</option>)}
              </select>
            </label>
            <p className="job-help">{selecting ? '선택한 현장을 저장 중입니다...' : `현장 역할: ${siteRoles[currentSite?.role] ?? '미선택'}`}</p>
          </div>
        ) : account && <p className="job-help">접근 가능한 현장이 없습니다. 관리자에게 현장 권한을 요청하세요.</p>
      )}
    </section>
  );
}

function WorkFormFields({ context, title, children }) {
  const [reviewed, setReviewed] = useState(false);
  return (
    <form className="panel job-form" onChange={() => setReviewed(false)} onSubmit={(event) => { event.preventDefault(); setReviewed(true); }}>
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
    <>
      <div className="page-heading"><h1>{title}</h1><p>{description}</p></div>
      <JobSiteSelector context={context} />
      <p className="job-demo-notice">업무 기록의 저장·조회·제출 API는 아직 제공되지 않습니다. 입력값은 현재 화면에서만 유지되며 승인 또는 정식 기록이 아닙니다.</p>
      <WorkFormFields key={context.currentSite?.siteId ?? 'no-site'} context={context} title={title}>{children}</WorkFormFields>
    </>
  );
}
