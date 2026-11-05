// 기록 검색(기록 질문) 화면 계산

// 근거·조회 종류 이름. 모르는 값은 그대로 보인다.
export const RECORD_TYPE_LABELS = Object.freeze({
  WORK: '작업', RISK: '위험성평가', PERMIT: '작업허가', TBM: 'TBM', APPROVAL: '결재', NEAR_MISS: '아차사고',
  DAILY_LOG: '안전일지', INSPECTION: '점검표', CORRECTIVE_ACTION: '개선조치',
});

/** 근거 기록을 종류별로 묶는다 (처음 나온 순서 유지, 같은 기록은 한 번만) */
export function groupEvidence(evidence = []) {
  const groups = new Map();
  const seen = new Set();
  for (const item of evidence ?? []) {
    if (!item?.type) continue;
    const key = `${item.type}:${item.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (!groups.has(item.type)) groups.set(item.type, { type: item.type, label: RECORD_TYPE_LABELS[item.type] ?? item.type, items: [] });
    groups.get(item.type).items.push(item);
  }
  return [...groups.values()];
}

export const RUN_STATUS_LABELS = Object.freeze({ PROCESSING: '처리 중', WAITING_INPUT: '답을 기다림', FAILED: '실패' });

/** 지난 대화 제목 (없으면 대화 번호) */
export const conversationTitle = (item) => (item?.title?.trim() ? item.title.trim() : `대화 #${item?.conversationId}`);

const DAY_LABELS = ['오늘', '어제', '이전'];
/** 지난 대화를 마지막 메시지 날짜로 오늘 / 어제 / 이전 묶음 (빈 묶음 제외, 순서 유지) */
export function groupConversations(items = [], now = new Date(), bucketOf) {
  const groups = DAY_LABELS.map((label) => ({ label, items: [] }));
  for (const item of items) groups[bucketOf(item.lastMessageAt, now)].items.push(item);
  return groups.filter((group) => group.items.length);
}
