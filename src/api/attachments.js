import { api } from './client.js';
import { jobId, jobWrite } from './jobs.js';

const RESULTS = ['PASS', 'FAIL', 'UNSURE'];

/** 첨부 응답 한 건 확인. check 는 서버 사진 확인 결과(없으면 null) */
function requirePhoto(photo) {
  if (!photo || !Number.isSafeInteger(photo.attachmentId) || photo.attachmentId < 1 || typeof photo.url !== 'string') {
    throw new Error('사진 응답 형식이 올바르지 않습니다.');
  }
  const check = photo.check ?? null;
  if (check !== null && (!RESULTS.includes(check.result) || !Array.isArray(check.messages))) {
    throw new Error('사진 확인 결과 형식이 올바르지 않습니다. 최신 서버 배포 여부를 확인하세요.');
  }
  return { ...photo, check: check && { ...check, boxes: Array.isArray(check.boxes) ? check.boxes : [] } };
}

const requirePhotos = (list) => {
  if (!Array.isArray(list)) throw new Error('사진 목록 응답 형식이 올바르지 않습니다.');
  return list.map(requirePhoto);
};

export async function getTbmPhotos(tbmId) {
  return requirePhotos(await api(`/api/v1/tbm/${jobId(tbmId)}/photos`));
}

/** 사진 속 인원과 참석자 명부 비교 (서버 판정, 알림만) */
export async function getTbmPhotoSummary(tbmId) {
  const summary = await api(`/api/v1/tbm/${jobId(tbmId)}/photos/summary`);
  if (!summary || !Number.isInteger(summary.photoCount) || !Number.isInteger(summary.rosterCount) || typeof summary.message !== 'string'
    || (summary.result !== null && !RESULTS.includes(summary.result))) {
    throw new Error('사진 인원 요약 응답 형식이 올바르지 않습니다.');
  }
  return summary;
}

/** TBM 사진 한 장 올리기. 서버가 올리면서 촬영 날짜·같은 사진 확인과 사진 인식(켜져 있으면)을 해서 check 로 돌려준다 */
export async function uploadTbmPhoto(tbmId, file) {
  const id = jobId(tbmId);
  const form = new FormData();
  form.append('file', file);
  return jobWrite(async () => requirePhoto(await api(`/api/v1/tbm/${id}/photos`, { method: 'POST', body: form })));
}

/** TBM 날짜를 바꾼 뒤 사진 다시 확인 */
export async function recheckTbmPhotos(tbmId) {
  const id = jobId(tbmId);
  return jobWrite(async () => requirePhotos(await api(`/api/v1/tbm/${id}/photos/check`, { method: 'POST' })));
}

/** 작성자가 사진을 보고 확인 결과 고치기 (사유 필수). 고친 결과가 담긴 사진을 돌려준다 */
export async function correctPhotoCheck(attachmentId, body) {
  const id = jobId(attachmentId);
  return jobWrite(async () => requirePhoto(await api(`/api/v1/attachments/${id}/check`, { method: 'PUT', body })));
}

export async function deleteAttachment(attachmentId) {
  const id = jobId(attachmentId);
  return jobWrite(() => api(`/api/v1/attachments/${id}`, { method: 'DELETE' }));
}

/** 사진 파일 (로그인 토큰이 필요해 img src 에 주소를 바로 못 넣는다) */
export async function photoBlob(photo) {
  if (!/^\/api\/v1\/attachments\/\d+\/file$/.test(photo.url)) throw new Error('사진 주소가 올바르지 않습니다.');
  return api(photo.url, { responseType: 'blob' });
}
