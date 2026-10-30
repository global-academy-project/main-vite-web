import { useState } from 'react';
import JobDraftForm from './job-work-form';

function TbmFields() {
  // TODO: BACKEND CONTRACT REQUIRED: TBM DRAFT -> ATTENDEE signatures -> DONE -> APPROVED
  const [attendees, setAttendees] = useState('');
  const [photoName, setPhotoName] = useState('');
  const attendeeCount = attendees.split('\n').filter((name) => name.trim()).length;

  return (
    <>
      <div className="job-fields">
        <label>회의명<input required /></label>
        <label>실시 일시<input required type="datetime-local" /></label>
        <label>장소<input required /></label>
        <label>진행자<input required /></label>
        <label className="job-field-wide">교육 내용<textarea required rows={4} /></label>
        <label className="job-field-wide">참석자 메모 (한 줄에 한 명, 작업자 배치 아님)<textarea required rows={4} value={attendees} onChange={(event) => setAttendees(event.target.value)} /></label>
        <label className="job-field-wide">사진 선택 (업로드되지 않음)<input type="file" accept="image/*" onChange={(event) => setPhotoName(event.target.files?.[0]?.name ?? '')} /></label>
      </div>
      <p className="job-help">입력한 참석자: {attendeeCount}명{photoName ? ` · 선택한 사진: ${photoName}` : ''}</p>
      <p className="job-help">사진의 날짜·현장·인원 AI 검증과 서명 수집은 아직 연결되지 않았습니다.</p>
      <p className="job-help">정식 TBM 기록은 작업 ID·참석 작업자 ID와 연결되어야 합니다. 현재 이름 메모는 tbm_attendees에 저장되지 않습니다.</p>
    </>
  );
}

export default function JobTbm() {
  return <JobDraftForm title="TBM" description="작업 전 안전회의의 교육 내용과 참석자를 기록합니다."><TbmFields /></JobDraftForm>;
}
