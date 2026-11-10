import { api } from './client.js';

/** 음성 입력 켜짐 여부·최대 녹음 초 (꺼져 있으면 화면이 마이크 버튼을 숨긴다) */
export async function getSttStatus() {
  const status = await api('/api/v1/stt/status');
  if (!status || typeof status.enabled !== 'boolean' || !Number.isInteger(status.maxSeconds)) {
    throw new Error('음성 입력 상태 응답 형식이 올바르지 않습니다.');
  }
  return status;
}

/** 녹음 → 글. 서버는 녹음을 저장하지 않는다. 받아 적기만 하고 칸은 채우지 않는다 */
export async function transcribe(blob, language = 'ko') {
  const form = new FormData();
  form.append('file', blob, 'voice');
  form.append('language', language);
  const result = await api('/api/v1/stt', { method: 'POST', body: form });
  if (!result || typeof result.text !== 'string') throw new Error('받아 적기 응답 형식이 올바르지 않습니다.');
  return result;
}
