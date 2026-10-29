import JobDraftForm from './job-work-form';
import { getTagEntries, sampleNearMiss } from '../../utils/agentic-rag-tags';

export default function JobIncidents() {
  return (
    <>
      <JobDraftForm title="위험·근접 사고" description="발견한 위험요인과 아차사고의 발생 상황, 즉시 조치를 기록합니다.">
        <div className="job-fields">
          <label>보고 제목<input required placeholder="발생 상황을 간단히 입력하세요" /></label>
          <label>기록 유형<input value="아차사고 (near_misses)" readOnly /></label>
          <label>발생 장소<input required placeholder="현장·작업구역" /></label>
          <label>발생 일시<input required type="datetime-local" /></label>
          <label>작업 유형<select><option value="GENERAL">일반</option><option value="HOT">화기</option><option value="CONFINED">밀폐공간</option><option value="HEIGHT">고소</option></select></label>
          <label>보고자<input required /></label>
          <label className="job-field-wide">발생 상황<textarea required rows={4} /></label>
          <label className="job-field-wide">즉시 조치<textarea rows={3} placeholder="실시한 조치가 있으면 입력하세요" /></label>
        </div>
      </JobDraftForm>
      <section className="panel job-example" aria-labelledby="incident-example-title">
        <h2 id="incident-example-title">계획서 시연 사례</h2>
        <h3>{sampleNearMiss.title}</h3>
        <p>{sampleNearMiss.description}</p>
        <div className="incident-tags">
          {getTagEntries(sampleNearMiss.tags).map(({ axis, label, values }) => (
            <div className="incident-tag-axis" key={axis}>
              <span>{label}</span>
              <div className="tag-chip-list">{values.length ? values.map(({ code, label: value }) => <span className="tag-chip" key={code}>{value}</span>) : <span className="tag-unspecified">미분류</span>}</div>
            </div>
          ))}
        </div>
        <p className="job-help">시나리오 C의 가상 사례입니다. 위 입력 내용에 자동 태깅이 실행되지는 않습니다.</p>
      </section>
    </>
  );
}
