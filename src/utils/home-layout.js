// 홈 배치 기억 (11/14 정함): 이 브라우저에만, 사용자 번호별로 저장한다. 서버에는 저장하지 않는다.
// 위 3칸 순서 · AI 도우미 폭·위치·접힘 · 일정 보기. 저장 못 해도(사생활 보호 창 등) 화면은 기본 배치로 동작한다.

export const TOP_CARDS = Object.freeze(['status', 'todo', 'side']);
// AI 폭: 최소 300(입력칸·초안 카드가 깨지지 않는 폭). 최대는 화면에 따라 "아래 줄 폭 − 일정 최소 폭" (aiMaxWidth).
// max 는 저장값 상한일 뿐이고, 실제 폭은 그때 화면에서 다시 줄인다 (창을 줄여도 일정이 사라지지 않게)
export const AI_WIDTH = Object.freeze({ min: 300, max: 1600, base: 380 });
export const SCHEDULE_MIN = 560;
export const SPLIT_WIDTH = 12;

/** 아래 줄 폭에서 AI 가 쓸 수 있는 최대 폭 */
export const aiMaxWidth = (rowWidth) => Math.max(AI_WIDTH.min, Math.round(rowWidth - SPLIT_WIDTH - SCHEDULE_MIN));
// 모바일 카드 펼침 (11/16): 처음엔 AI 도우미만 펼치고 나머지는 접는다. PC 배치와 따로 기억, "기본 배치로" 대상 아님
export const MOBILE_CARDS = Object.freeze(['ai', 'todo', 'status', 'side', 'schedule']);
export const DEFAULT_MOBILE_OPEN = Object.freeze({ ai: true, todo: false, status: false, side: false, schedule: false });
export const DEFAULT_LAYOUT = Object.freeze({ top: TOP_CARDS, aiWidth: AI_WIDTH.base, aiSide: 'right', aiFolded: false, view: 'day', mobileOpen: DEFAULT_MOBILE_OPEN });
const VIEWS = ['day', 'week', 'month', 'list'];

export const layoutKey = (userId) => `home-layout:${userId ?? 'guest'}`;

/** 저장된 값이 망가졌거나 예전 모양이면 기본값으로 메운다 */
export function sanitizeLayout(raw) {
  const value = raw && typeof raw === 'object' ? raw : {};
  const top = Array.isArray(value.top) && value.top.length === TOP_CARDS.length && TOP_CARDS.every((key) => value.top.includes(key)) ? [...value.top] : [...TOP_CARDS];
  const width = Number(value.aiWidth);
  return {
    top,
    aiWidth: Number.isFinite(width) ? Math.round(Math.min(AI_WIDTH.max, Math.max(AI_WIDTH.min, width))) : AI_WIDTH.base,
    aiSide: value.aiSide === 'left' ? 'left' : 'right',
    aiFolded: value.aiFolded === true,
    view: VIEWS.includes(value.view) ? value.view : 'day',
    mobileOpen: Object.fromEntries(MOBILE_CARDS.map((key) => [key, typeof value.mobileOpen?.[key] === 'boolean' ? value.mobileOpen[key] : DEFAULT_MOBILE_OPEN[key]])),
  };
}

/** 기본 배치와 다른가 ("기본 배치로" 버튼은 바꾼 사람에게만). 일정 보기 종류는 배치로 치지 않는다 */
export function isCustomLayout(layout) {
  return layout.top.join() !== TOP_CARDS.join() || layout.aiWidth !== AI_WIDTH.base || layout.aiSide !== 'right' || layout.aiFolded;
}

export function readLayout(storage, userId) {
  try { return sanitizeLayout(JSON.parse(storage?.getItem(layoutKey(userId)) ?? 'null')); } catch { return sanitizeLayout(null); }
}

export function writeLayout(storage, userId, layout) {
  try { storage?.setItem(layoutKey(userId), JSON.stringify(layout)); return true; } catch { return false; }
}

/** 위 칸 두 개 자리 바꾸기 */
export function swapTop(top, from, to) {
  const next = [...top];
  const [a, b] = [next.indexOf(from), next.indexOf(to)];
  if (a < 0 || b < 0 || a === b) return next;
  [next[a], next[b]] = [next[b], next[a]];
  return next;
}

/** 키보드로 한 칸 옮기기 (step -1 왼쪽 / +1 오른쪽) */
export function moveTop(top, key, step) {
  const index = top.indexOf(key);
  const target = index + step;
  if (index < 0 || target < 0 || target >= top.length) return [...top];
  return swapTop(top, key, top[target]);
}
