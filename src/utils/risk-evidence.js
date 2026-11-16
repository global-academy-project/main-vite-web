// 위험성평가 화면의 "기존 초안 근거·검토 정보"를 사람이 읽는 모양으로 바꾼다 (React 없이 테스트할 수 있게 분리).
// 서버가 저장한 formData(에이전트가 만든 초안 근거)를 읽기만 한다. 저장·전송 값은 바꾸지 않는다 (job-forms.riskAssessmentBody는 formData를 보내지 않는다).
// 화면에는 위험요인·감소대책·근거(종류, 출처 이름, 본문 앞부분)만 보인다. docId·refId·kbCollection·sourceType 같은 내부 값은 쓰지 않는다.

/** 위험요인 하나에 바로 보이는 근거 개수. 나머지는 "더 보기" 안에 둔다 (서버도 위험요인당 최대 3개를 담는다) */
export const MAX_CITATIONS = 3;
/** 근거 본문 미리보기 글자 수. 더 길면 "더 보기"로 펼친다 */
export const SNIPPET_PREVIEW = 90;

const clean = (value) => (typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '');

/** 근거 종류 이름. 모르는 값은 그냥 "근거"로 둔다 (영어 코드를 화면에 보이지 않는다) */
export function citationKind(citation) {
  if (citation.kind === 'MSDS' || citation.sourceType === 'MSDS') return '물질안전보건자료';
  if (citation.sourceType === 'SIF' || citation.kbCollection === 'kb_accidents') return '사고사례';
  if (citation.sourceType === 'LAW' || citation.kbCollection === 'kb_guides') return '법령·지침';
  return '근거';
}

/** 근거 본문 정리: 공백을 줄이고, 공단 원문의 '|' 구분을 ' · '로 바꾼다 */
export function cleanSnippet(value) {
  return clean(typeof value === 'string' ? value.replace(/\s*\|\s*/g, ' · ') : '');
}

function readCitation(raw) {
  const text = cleanSnippet(raw.snippet);
  const long = text.length > SNIPPET_PREVIEW;
  return {
    kind: citationKind(raw),
    title: clean(raw.source) || clean(raw.title),
    text,
    preview: long ? `${text.slice(0, SNIPPET_PREVIEW).trimEnd()}…` : text,
    long,
  };
}

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

function readItem(raw, index) {
  const measures = (Array.isArray(raw.measures) ? raw.measures : typeof raw.measures === 'string' ? [raw.measures] : []).map(clean).filter(Boolean);
  const citations = (Array.isArray(raw.citations) ? raw.citations : []).filter(isObject).map(readCitation);
  return {
    seq: Number.isInteger(raw.seq) && raw.seq > 0 ? raw.seq : index + 1,
    hazard: clean(raw.hazard),
    measures,
    citations: citations.slice(0, MAX_CITATIONS),
    moreCitations: citations.slice(MAX_CITATIONS),
  };
}

/**
 * formData(문자열 JSON 또는 객체) → 화면용 위험요인 목록. 읽을 수 없으면 null (화면은 예전처럼 원문을 보여 준다).
 * 보여 줄 내용이 하나도 없는 항목은 뺀다.
 */
export function parseDraftEvidence(formData) {
  let value = formData;
  if (typeof formData === 'string') {
    try { value = JSON.parse(formData); } catch { return null; }
  }
  if (!isObject(value) || !Array.isArray(value.items)) return null;
  const items = value.items.filter(isObject).map(readItem).filter((item) => item.hazard || item.measures.length || item.citations.length || item.moreCitations.length);
  return items.length ? items : null;
}
