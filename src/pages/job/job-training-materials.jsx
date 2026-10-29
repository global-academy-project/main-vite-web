import { useState } from 'react';
import JobDraftForm from './job-work-form';

function TrainingFields() {
  const [file, setFile] = useState(null);

  return (
    <>
      <div className="job-fields">
        <label>자료 제목<input required placeholder="예: 화기 작업 전 안전교육" /></label>
        <label>분류<select><option>일반 안전</option><option>화기</option><option>밀폐공간</option><option>고소</option><option>화학물질</option></select></label>
        <label>출처·발행 기관<input required placeholder="기관명 또는 사내 부서" /></label>
        <label>원문 URL<input type="url" placeholder="https://..." /></label>
        <label>이용허락·라이선스<input placeholder="원문에서 확인한 이용 조건" /></label>
        <label>개정일<input required type="date" /></label>
        <label className="job-field-wide">자료 설명<textarea required rows={4} /></label>
        <label className="job-field-wide">파일 선택 (업로드되지 않음)<input type="file" accept=".pdf,.ppt,.pptx,.doc,.docx,.hwp,.hwpx,.txt" required onChange={(event) => setFile(event.target.files?.[0] ?? null)} /></label>
      </div>
      <p className="job-help">교육자료 분류는 화면용입니다. 지식 원본·청크·MSDS는 AI 서비스 소유이며, 브라우저에서 지식 DB나 외부 API 인증키로 직접 접근하지 않습니다.</p>
      <p className="job-help">공공 데이터 연동 대상은 물질안전보건자료(MSDS), 코샤가이드, 사망사고 고위험요인(SIF)입니다. AI 서버의 수집·검색 API가 연결되기 전까지 이 화면에서는 조회하거나 파일을 전송하지 않습니다.</p>
      {file && (
        <section className="job-file-summary" aria-label="선택한 자료 정보">
          <h2>선택한 파일</h2>
          <p>{file.name} · {(file.size / 1024).toLocaleString('ko-KR', { maximumFractionDigits: 1 })} KB</p>
          <p className="job-help">파일 내용은 전송되지 않습니다. 자료 저장·검색·다운로드 API는 아직 연결되지 않았습니다.</p>
        </section>
      )}
    </>
  );
}

export default function JobTrainingMaterials() {
  return <JobDraftForm title="교육자료 관리" description="작업 유형에 맞는 교육자료의 분류와 파일 정보를 입력합니다."><TrainingFields /></JobDraftForm>;
}
