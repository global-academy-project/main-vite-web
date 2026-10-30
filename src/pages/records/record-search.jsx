import { Link } from 'react-router-dom';
import SafetyPageLayout from '../../components/safety-page-layout';
import '../../style/records.css';

// ROUTE: /records/search
// FLOW: 기록 조회는 직접 목록 API가 아니라 작업 대시보드의 기록 질문 탭으로 통합
// TODO: API NOT CONNECTED: POST /api/v1/agent/record-query
export default function RecordSearch() {
  return <SafetyPageLayout title="기록 질문">{(site) => (
    <section className="panel records-question" aria-labelledby="record-query-unavailable-title">
      <h1 id="record-query-unavailable-title">기록 질문</h1>
      <p>기록 조회는 현장 권한과 실행 이력을 보장하기 위해 작업 등록 화면의 기록 질문 탭에서 처리합니다.</p>
      <p className="dashboard-error" role="status">기록 질문 에이전트 API가 아직 연결되지 않았습니다.</p>
      <Link className="secondary-button" to="/job/dashboard">작업 대시보드로 이동</Link>
      <p className="job-help">서버 API가 배포되면 질문·답변·근거 기록 링크·조회 조건·진행 과정·0건 결과를 해당 탭에서 표시합니다.</p>
      {site.currentSite && <p className="job-help">현재 선택 현장: {site.currentSite.name}</p>}
    </section>
  )}</SafetyPageLayout>;
}
