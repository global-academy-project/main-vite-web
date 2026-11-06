// 현장 설정 화면 입력 검사와 저장 본문 (서버 검사 규칙을 미리 알려 주는 용도, 최종 판단은 서버)

export const SITE_TABS = Object.freeze([
  { key: 'site', label: '현장 정보' }, { key: 'zones', label: '구역' }, { key: 'equipment', label: '설비' },
  { key: 'workers', label: '작업자' }, { key: 'teams', label: '팀·협력업체' },
]);
export const SITE_MODE_LABELS = Object.freeze({ VERIFY: '검증 모드', GUIDE: '안내 모드' });
export const EMPLOYMENT_LABELS = Object.freeze({ DIRECT: '직영', CONTRACTOR: '협력업체', DAILY: '일용' });
export const TEAM_TYPE_LABELS = Object.freeze({ INTERNAL: '사내', EXTERNAL: '외부 업체' });

export const tabOf = (value) => (SITE_TABS.some((tab) => tab.key === value) ? value : 'site');

/** "HH:mm:ss" → "HH:mm" (time 입력칸용) */
export const hhmm = (value) => (typeof value === 'string' ? value.slice(0, 5) : '');

export function settingsForm(settings) {
  return {
    industry: settings?.industry ?? '', employeeCount: settings?.employeeCount == null ? '' : String(settings.employeeCount), address: settings?.address ?? '',
    tbmDeadline: hhmm(settings?.tbmDeadline), dailyLogDeadline: hhmm(settings?.dailyLogDeadline),
    approvalDueMinutes: settings ? String(settings.approvalDueMinutes) : '', nearMissWarnDays: settings ? String(settings.nearMissWarnDays) : '',
  };
}

/** 검사 + 본문. 문제 있으면 { error } */
export function settingsBody(form) {
  const errors = {};
  if (!/^\d{2}:\d{2}$/.test(form.tbmDeadline)) errors.tbmDeadline = 'TBM 마감 시각을 입력하세요.';
  if (!/^\d{2}:\d{2}$/.test(form.dailyLogDeadline)) errors.dailyLogDeadline = '안전일지 마감 시각을 입력하세요.';
  if (!errors.tbmDeadline && !errors.dailyLogDeadline && form.tbmDeadline >= form.dailyLogDeadline) errors.dailyLogDeadline = '안전일지 마감은 TBM 마감보다 늦어야 합니다.';
  const minutes = Number(form.approvalDueMinutes);
  if (!Number.isInteger(minutes) || minutes < 5 || minutes > 1440) errors.approvalDueMinutes = '5~1440분 사이로 입력하세요.';
  const days = Number(form.nearMissWarnDays);
  if (!Number.isInteger(days) || days < 1 || days > 365) errors.nearMissWarnDays = '1~365일 사이로 입력하세요.';
  const employees = form.employeeCount === '' ? null : Number(form.employeeCount);
  if (employees !== null && (!Number.isInteger(employees) || employees < 0)) errors.employeeCount = '0 이상의 정수로 입력하세요.';
  if (form.industry.trim().length > 50) errors.industry = '50자 이하로 입력하세요.';
  if (form.address.trim().length > 255) errors.address = '255자 이하로 입력하세요.';
  if (Object.keys(errors).length) return { errors };
  return {
    body: {
      tbmDeadline: form.tbmDeadline, dailyLogDeadline: form.dailyLogDeadline, approvalDueMinutes: minutes, nearMissWarnDays: days,
      industry: form.industry.trim() || null, employeeCount: employees, address: form.address.trim() || null,
    },
  };
}

export const EMPTY_EQUIPMENT = Object.freeze({ code: '', name: '', equipmentType: '', zoneId: '', nextInspectionDate: '', active: true });

export function equipmentForm(entry) {
  if (!entry) return { ...EMPTY_EQUIPMENT };
  return {
    equipmentId: entry.equipmentId, code: entry.code, name: entry.name, equipmentType: entry.equipmentType,
    zoneId: entry.zoneId == null ? '' : String(entry.zoneId), nextInspectionDate: entry.nextInspectionDate ?? '', active: entry.active,
  };
}

export function equipmentBody(form) {
  const errors = {};
  const code = form.code.trim();
  const name = form.name.trim();
  const equipmentType = form.equipmentType.trim().toUpperCase();
  if (!code || code.length > 30) errors.code = '설비 코드는 1~30자로 입력하세요.';
  if (!name || name.length > 100) errors.name = '설비 이름은 1~100자로 입력하세요.';
  if (!/^[A-Z][A-Z0-9_]*$/.test(equipmentType) || equipmentType.length > 30) errors.equipmentType = '영문 대문자로 시작하고 대문자·숫자·_ 만 씁니다. 예: CRANE, GAS_DETECTOR';
  if (Object.keys(errors).length) return { errors };
  return {
    body: {
      code, name, equipmentType, zoneId: form.zoneId ? Number(form.zoneId) : null, nextInspectionDate: form.nextInspectionDate || null,
      active: form.equipmentId ? Boolean(form.active) : null,
    },
  };
}

export const EMPTY_ZONE = Object.freeze({ code: '', name: '', zoneType: '', confined: false, hazardNote: '', active: true });

export function zoneBody(form) {
  const errors = {};
  const code = form.code.trim();
  const name = form.name.trim();
  if (!code || code.length > 30) errors.code = '구역 코드는 1~30자로 입력하세요.';
  if (!name || name.length > 100) errors.name = '구역 이름은 1~100자로 입력하세요.';
  if (form.hazardNote.trim().length > 500) errors.hazardNote = '500자 이하로 입력하세요.';
  if (Object.keys(errors).length) return { errors };
  return {
    body: { code, name, zoneType: form.zoneType.trim() || null, confined: Boolean(form.confined), hazardNote: form.hazardNote.trim() || null, active: form.zoneId ? Boolean(form.active) : null },
  };
}

export const EMPTY_TEAM = Object.freeze({ name: '', teamType: 'INTERNAL', businessNo: '', active: true });

export function teamBody(form) {
  const errors = {};
  const name = form.name.trim();
  const businessNo = form.businessNo.replaceAll('-', '').trim();
  if (!name || name.length > 100) errors.name = '팀 이름은 1~100자로 입력하세요.';
  if (form.teamType === 'EXTERNAL' && businessNo && !/^\d{10}$/.test(businessNo)) errors.businessNo = '사업자등록번호는 숫자 10자리입니다.';
  if (Object.keys(errors).length) return { errors };
  return { body: { name, teamType: form.teamType, businessNo: form.teamType === 'EXTERNAL' ? businessNo || null : null, active: form.teamId ? Boolean(form.active) : null } };
}

/** 표 검색: 이름·코드에 검색어가 들어간 것 */
export function matches(entry, query, fields) {
  const text = query.trim().toLocaleLowerCase('ko-KR');
  if (!text) return true;
  return fields.some((field) => String(entry[field] ?? '').toLocaleLowerCase('ko-KR').includes(text));
}
