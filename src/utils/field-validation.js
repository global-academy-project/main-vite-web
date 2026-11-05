/**
 * 어떤 칸의 오류를 지금 보여 줄지 정한다 (순수 함수, 테스트용으로 따로 둔다).
 * - 입력 중에는 보이지 않는다: 칸을 벗어났거나(touched) 저장을 눌렀을 때(submitted)만
 * - 서버 오류(serverErrors)는 사용자가 그 칸을 다시 고치기 전까지 보인다
 * - 고쳐서 규칙을 통과하면 바로 사라진다
 */
export function visibleErrors({ values, rules, touched, submitted, serverErrors = {} }) {
  const result = {};
  for (const [field, rule] of Object.entries(rules)) {
    if (!submitted && !touched[field]) continue;
    const message = rule(values[field], values);
    if (message) result[field] = message;
  }
  for (const [field, message] of Object.entries(serverErrors)) {
    if (!result[field] && message) result[field] = message;
  }
  return result;
}

/** 규칙을 모두 돌려 첫 번째 문제 칸 이름을 돌려준다. 없으면 null */
export function firstInvalid(values, rules, order = Object.keys(rules)) {
  return order.find((field) => rules[field]?.(values[field], values)) ?? null;
}
