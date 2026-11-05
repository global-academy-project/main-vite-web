import { api } from './client.js';
import { jobId, jobWrite } from './jobs.js';

/**
 * 점검표 API (서버 InspectionController).
 *  - 양식 목록 GET /inspection-templates, 만들기 POST /sites/{site}/inspections, 목록 GET /sites/{site}/inspections?from&to
 *  - 조회 GET /inspections/{id}, 결과 저장 PUT /inspections/{id}(보낸 항목만 바뀜, NG 는 내용 필수), 제출 POST /inspections/{id}/submit
 *  - 설비 목록 GET /sites/{site}/equipment (장비 점검 대상 고르기)
 */
const statuses = ['DRAFT', 'PENDING', 'APPROVED', 'REJECTED'];
const targets = ['ZONE', 'EQUIPMENT'];
const itemResults = ['OK', 'NG', 'NA'];

function requireInspection(inspection, siteId) {
  if (!inspection || !Number.isSafeInteger(inspection.inspectionId) || inspection.inspectionId < 1
    || !Number.isSafeInteger(inspection.siteId) || !statuses.includes(inspection.status)
    || !targets.includes(inspection.targetType) || typeof inspection.inspectDate !== 'string'
    || typeof inspection.templateCode !== 'string' || !Number.isInteger(inspection.lockVersion)
    || typeof inspection.canSubmit !== 'boolean' || !Array.isArray(inspection.items)
    || !inspection.items.every((item) => item && typeof item.itemCode === 'string' && typeof item.question === 'string'
      && (item.result == null || itemResults.includes(item.result)))) {
    throw new Error('점검표 응답 형식이 올바르지 않습니다.');
  }
  if (siteId != null && inspection.siteId !== jobId(siteId)) throw new Error('선택한 현장의 점검표가 아닙니다.');
  return inspection;
}

export async function getInspectionTemplates() {
  const templates = await api('/api/v1/inspection-templates');
  if (!Array.isArray(templates) || !templates.every((template) => template && typeof template.code === 'string'
    && targets.includes(template.targetType) && Array.isArray(template.sections))) {
    throw new Error('점검표 양식 응답 형식이 올바르지 않습니다.');
  }
  return templates;
}

export async function getSiteInspections(siteId, from, to = from) {
  const query = new URLSearchParams();
  if (from) query.set('from', from);
  if (to) query.set('to', to);
  const list = await api(`/api/v1/sites/${jobId(siteId)}/inspections${query.size ? `?${query}` : ''}`);
  if (!Array.isArray(list)) throw new Error('점검표 목록 응답 형식이 올바르지 않습니다.');
  return list.map((inspection) => requireInspection(inspection, siteId));
}

export async function getInspection(id, siteId) {
  return requireInspection(await api(`/api/v1/inspections/${jobId(id)}`), siteId);
}

export async function getSiteEquipment(siteId) {
  const list = await api(`/api/v1/sites/${jobId(siteId)}/equipment`);
  if (!Array.isArray(list) || !list.every((entry) => entry && Number.isSafeInteger(entry.equipmentId) && typeof entry.name === 'string')) {
    throw new Error('설비 목록 응답 형식이 올바르지 않습니다.');
  }
  return list;
}

/** body: { targetType, zoneId, equipmentId, workId, inspectDate, templateCode } */
export function createInspection(siteId, body) {
  return jobWrite(async () => requireInspection(
    await api(`/api/v1/sites/${jobId(siteId)}/inspections`, { method: 'POST', body }), siteId,
  ));
}

/** body: { lockVersion, inspectDate?, items: [{ itemCode, result, note }] } */
export function saveInspection(id, body, siteId) {
  return jobWrite(async () => requireInspection(
    await api(`/api/v1/inspections/${jobId(id)}`, { method: 'PUT', body }), siteId,
  ));
}

export function submitInspection(id, siteId) {
  return jobWrite(async () => requireInspection(
    await api(`/api/v1/inspections/${jobId(id)}/submit`, { method: 'POST' }), siteId,
  ));
}
