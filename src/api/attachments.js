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
  return { ...photo, check };
}

const requirePhotos = (list) => {
  if (!Array.isArray(list)) throw new Error('사진 목록 응답 형식이 올바르지 않습니다.');
  return list.map(requirePhoto);
};

export async function getTbmPhotos(tbmId) {
  return requirePhotos(await api(`/api/v1/tbm/${jobId(tbmId)}/photos`));
}

/** TBM 사진 한 장 올리기. 서버가 올리면서 촬영 날짜·같은 사진을 확인해 check 로 돌려준다 */
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

export async function deleteAttachment(attachmentId) {
  const id = jobId(attachmentId);
  return jobWrite(() => api(`/api/v1/attachments/${id}`, { method: 'DELETE' }));
}

/** 사진 파일 (로그인 토큰이 필요해 img src 에 주소를 바로 못 넣는다) */
export async function photoBlob(photo) {
  if (!/^\/api\/v1\/attachments\/\d+\/file$/.test(photo.url)) throw new Error('사진 주소가 올바르지 않습니다.');
  return api(photo.url, { responseType: 'blob' });
}
