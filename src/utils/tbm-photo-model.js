// TBM 사진 확인 결과 표시. 판단은 서버(photo_checks)가 하고 웹은 보여 주기만 한다. 결과는 알림이고 제출을 막지 않는다.

export const PHOTO_ACCEPT = 'image/jpeg,image/png,image/heic,image/heif,.heic,.heif';

const CHECK = {
  PASS: { label: '확인됨', tone: 'done' },
  FAIL: { label: '맞지 않음', tone: 'block' },
  UNSURE: { label: '확인 못 함', tone: 'warn' },
};

/** 결과 칩: { label, tone }. 확인 전이면 '확인 전' */
export function checkChip(check) {
  return CHECK[check?.result] ?? { label: '확인 전', tone: 'neutral' };
}

/** 사진 목록 요약: 전체·확인됨·맞지 않음·확인 못 함·확인 전 */
export function photoSummary(photos = []) {
  const out = { total: photos.length, pass: 0, fail: 0, unsure: 0, unchecked: 0 };
  photos.forEach((photo) => {
    const result = photo.check?.result;
    if (result === 'PASS') out.pass += 1;
    else if (result === 'FAIL') out.fail += 1;
    else if (result === 'UNSURE') out.unsure += 1;
    else out.unchecked += 1;
  });
  return out;
}

/** 한 줄 요약 (작업 허브·결재 미리보기) */
export function summaryText(summary) {
  if (!summary.total) return '사진 없음';
  const parts = [`사진 ${summary.total}장`];
  if (summary.fail) parts.push(`맞지 않음 ${summary.fail}`);
  if (summary.unsure) parts.push(`확인 못 함 ${summary.unsure}`);
  if (!summary.fail && !summary.unsure && !summary.unchecked) parts.push('모두 확인됨');
  return parts.join(' · ');
}

/** 확인할 때의 TBM 날짜가 지금 TBM 날짜와 다르면 다시 확인해야 한다 */
export function isStale(photo, tbmDate) {
  const checked = photo.check?.checkedTbmDate;
  return Boolean(checked && tbmDate && checked !== tbmDate);
}

/** 고른 파일 중 올릴 수 있는 것과 아닌 것 (서버도 다시 확인한다) */
export function splitFiles(files, maxBytes = 20 * 1024 * 1024) {
  const ok = [];
  const rejected = [];
  Array.from(files ?? []).forEach((file) => {
    const name = String(file.name ?? '');
    const image = /^image\//.test(file.type ?? '') || /\.(jpe?g|png|heic|heif)$/i.test(name);
    if (!image) rejected.push(`${name || '파일'}: 사진 파일이 아닙니다.`);
    else if (file.size > maxBytes) rejected.push(`${name}: ${Math.round(maxBytes / 1024 / 1024)}MB 를 넘습니다.`);
    else ok.push(file);
  });
  return { ok, rejected };
}
