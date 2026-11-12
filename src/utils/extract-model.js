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
 *  required: 서버 규칙이 판정하는 측정 칸 (값이 없으면 막히는 칸),
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
  const required = [];
  const out = {};
  checks.forEach((check) => {
    const code = targetCode(check.target);
    if (!code || !codes.has(code)) return;
    if (!required.includes(code)) required.push(code);
    if (check.status === 'MISSING' && !values[code] && !missing.includes(code)) missing.push(code);
    if (check.status === 'FAIL') out[code] = { expected: check.expected, actual: check.actual, message: check.message };
  });
  const watcher = typeof response?.input?.form?.watcher_name === 'string' ? response.input.form.watcher_name : null;
  return { values, filled, missing, required, out, notes: response?.extraction?.notes ?? [], watcher };
}

/** 문장을 나눠 채울 때 보낼 수 있는 문장 수 (서버 ApplyExtractionRequest.MAX_TEXTS 와 같게) */
export const MAX_FILL_TEXTS = 10;

/**
 * 문장을 이어서 채울 때 (11/12): 앞 결과에 새 결과를 합친다. 같은 칸은 뒤 문장 값, 기준 밖 표시도 새로 채운 칸은 새 판정.
 *  texts: 보낸 문장들 (저장 때 기록), text: 줄바꿈으로 이은 원문, lastFilled: 이번 문장으로 채운 칸, notes: 이번 문장의 확인할 점
 */
export function mergeFill(previous, next, text) {
  if (!previous) return { ...next, lastFilled: next.filled, texts: [text], text };
  const out = { ...previous.out };
  next.filled.forEach((code) => { delete out[code]; });
  const texts = [...previous.texts, text];
  return {
    values: { ...previous.values, ...next.values },
    filled: [...new Set([...previous.filled, ...next.filled])],
    lastFilled: next.filled,
    missing: next.missing,
    required: [...new Set([...(previous.required ?? []), ...(next.required ?? [])])],
    out: { ...out, ...next.out },
    notes: next.notes,
    watcher: next.watcher ?? previous.watcher,
    texts,
    text: texts.join('\n'),
  };
}

/** 아직 비어 있는 필수 칸 (지금 칸 값 기준, 칸 순서대로). 문장으로 채운 적이 없으면 빈 목록 */
export function remainingCodes(fill, values = {}, fields = []) {
  const required = fill?.required ?? fill?.missing ?? [];
  return fields.map((field) => field.code)
    .filter((code) => required.includes(code) && !String(values[code] ?? '').trim());
}

/** 칸 하나의 표시: 'filled' 문장에서 채움(값을 고치지 않았을 때) / 'missing' 입력 필요 / 'out' 기준 밖 / null */
export function fieldHint(fill, code, currentValue) {
  if (!fill) return null;
  const now = String(currentValue ?? '').trim();
  if (fill.out[code] && now === fill.values[code]) return { kind: 'out', ...fill.out[code] };
  if ((fill.required ?? fill.missing).includes(code) && !now) return { kind: 'missing' };   // 지금 비어 있는 필수 칸
  if (fill.filled.includes(code) && now === fill.values[code]) return { kind: 'filled' };
  return null;
}
