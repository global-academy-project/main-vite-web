// 작업허가 "말·문장으로 채우기": 서버 추출 응답(POST /extract/rule-input) → 측정값 칸에 채울 값과 칸별 표시
// 판단(무엇이 빠졌는지, 기준 밖인지)은 서버 규칙엔진의 미리 판정(previews)을 그대로 쓴다. 웹은 표시만 한다.

/** 칸 이름에서 빠른 입력 말: "산소 (%)" → "산소" */
export const shortLabel = (label) => String(label).split(' (')[0];

/** 빠른 입력 버튼에 넣을 말 (그 허가 종류의 측정 항목 + 감시인). 숫자는 사람이 쓴다 */
export function quickTerms(fields = []) {
  return [...fields.map((field) => shortLabel(field.label)), '감시인'];
}

// 안내 예시용 값 (실제 측정값이 아니라 입력 모양을 보여 주는 숫자)
const SAMPLE = { O2: '20.9', CO2: '0.5', CO: '5', H2S: '3', LEL: '0', NH3: '0', CL2: '0' };

/** 입력창 안내 예시: 그 허가 종류 칸 이름 + 예시 숫자, 끝에 감시인 (예: "산소 20.9 탄산가스 0.5 … 감시인 김도윤") */
export function exampleText(fields = []) {
  return [...fields.slice(0, 5).map((field) => `${shortLabel(field.label)} ${SAMPLE[field.code] ?? '0'}`), '감시인 김도윤'].join(' ');
}

/** 입력창 커서 자리에 말을 넣는다: 앞뒤 띄어쓰기를 맞춰 [새 글, 새 커서 위치] */
export function insertTerm(text, term, start = text.length, end = start) {
  const before = text.slice(0, start);
  const after = text.slice(end);
  const lead = before && !/\s$/.test(before) ? ' ' : '';
  const piece = `${lead}${term} `;
  return [`${before}${piece}${after.replace(/^\s+/, '')}`, before.length + piece.length];
}

const targetCode = (target) => (typeof target === 'string' && target.startsWith('measurement.') ? target.slice('measurement.'.length) : null);

/**
 * 추출 응답 → 칸 채우기 결과.
 *  values: { 코드: '값' } (그 허가 종류 칸만), filled: 채운 코드, missing: 서버가 "누락"으로 본 칸(채운 칸 제외),
 *  out: { 코드: { expected, actual, message } } 기준 밖, notes: 서버가 준 확인할 점, watcher: 찾은 감시인 이름
 */
export function extractFill(response, type, fields = []) {
  const codes = new Set(fields.map((field) => field.code));
  const values = {};
  (response?.extraction?.measurements ?? []).forEach((value) => {
    if (codes.has(value.item)) values[value.item] = String(value.value);
  });
  const filled = Object.keys(values);
  const checks = (response?.previews ?? []).find((preview) => preview.workType === type)?.check?.checks ?? [];
  const missing = [];
  const out = {};
  checks.forEach((check) => {
    const code = targetCode(check.target);
    if (!code || !codes.has(code)) return;
    if (check.status === 'MISSING' && !values[code] && !missing.includes(code)) missing.push(code);
    if (check.status === 'FAIL') out[code] = { expected: check.expected, actual: check.actual, message: check.message };
  });
  const watcher = typeof response?.input?.form?.watcher_name === 'string' ? response.input.form.watcher_name : null;
  return { values, filled, missing, out, notes: response?.extraction?.notes ?? [], watcher };
}

/** 칸 하나의 표시: 'filled' 문장에서 채움(값을 고치지 않았을 때) / 'missing' 입력 필요 / 'out' 기준 밖 / null */
export function fieldHint(fill, code, currentValue) {
  if (!fill) return null;
  const now = String(currentValue ?? '').trim();
  if (fill.out[code] && now === fill.values[code]) return { kind: 'out', ...fill.out[code] };
  if (fill.missing.includes(code) && !now) return { kind: 'missing' };
  if (fill.filled.includes(code) && now === fill.values[code]) return { kind: 'filled' };
  return null;
}
