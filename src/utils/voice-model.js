// 음성 입력: 녹음 형식 고르기, 받아 적은 글을 입력칸 글 뒤에 붙이기, 오류 안내. 판단 없음 (받아 적기만)

// 크롬·안드로이드는 webm/opus, 아이폰 사파리는 mp4 (서버가 받는 형식만)
const TYPES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];

/** 이 브라우저가 녹음할 수 있는 형식 (없으면 '' = 브라우저 기본) */
export function pickMimeType(isSupported = () => false) {
  return TYPES.find((type) => isSupported(type)) ?? '';
}

/** 받아 적은 글을 입력칸 글 뒤에 붙인다 (띄어쓰기 한 칸, 최대 길이에서 자름) */
export function appendText(text, addition, max = 2000) {
  const add = String(addition ?? '').trim();
  if (!add) return text;
  const base = String(text ?? '').replace(/\s+$/, '');
  return (base ? `${base} ${add}` : add).slice(0, max);
}

/** 녹음 시작 실패 안내 */
export function micError(error, secure = true) {
  if (!secure) return '마이크는 https 주소에서만 쓸 수 있습니다. 직접 적어 주세요.';
  if (error?.name === 'NotAllowedError' || error?.name === 'SecurityError') return '마이크 사용이 막혀 있습니다. 브라우저 주소창의 권한 설정에서 마이크를 허용해 주세요.';
  if (error?.name === 'NotFoundError') return '마이크를 찾지 못했습니다.';
  return '녹음을 시작하지 못했습니다. 직접 적어 주세요.';
}

/** 남은 시간 표시 (예: 0:07 / 0:30) */
export function clock(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
