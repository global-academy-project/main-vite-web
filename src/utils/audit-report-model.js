export function numericStats(stats = {}) {
  return Object.entries(stats).filter(([, value]) => typeof value === 'number' && Number.isFinite(value)).map(([key, value]) => ({ key, value }));
}

export function verificationLabel(item) {
  return item?.verificationStatus === 'MATCH' ? '수치 일치' : '수치 불일치';
}

export function canExport(report) {
  return report?.status === 'REVIEWED' && report?.overallVerification === 'PASS'
    && report?.items?.every((item) => item.verificationStatus === 'MATCH');
}

export function allItemsMatch(report) {
  return Boolean(report?.items?.length) && report.items.every((item) => item.verificationStatus === 'MATCH');
}
