import test from 'node:test';
import assert from 'node:assert/strict';
import { createInspection, getInspection, getInspectionTemplates, getSiteEquipment, getSiteInspections, saveInspection, submitInspection } from './inspections.js';

const inspection = {
  inspectionId: 7, siteId: 1, targetType: 'ZONE', zoneId: 3, inspectDate: '2026-11-05', templateCode: 'ZONE_DAILY',
  status: 'DRAFT', lockVersion: 0, canSubmit: false, answered: 0, total: 1,
  items: [{ seq: 1, itemCode: 'TANK_ACCESS', question: '출입 통제?', result: null, note: null }],
};

test('inspection API uses server paths, bodies and site validation', async (t) => {
  const requests = [];
  let responseData = [inspection];
  t.mock.method(globalThis, 'fetch', async (path, options) => {
    requests.push({ path, method: options.method, body: options.body ? JSON.parse(options.body) : undefined });
    return new Response(JSON.stringify({ success: true, data: responseData }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  });
  const storage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => 'test-only-token' } });
  t.after(() => { if (storage) Object.defineProperty(globalThis, 'localStorage', storage); else delete globalThis.localStorage; });

  assert.deepEqual(await getSiteInspections(1, '2026-11-05'), [inspection]);
  assert.equal(requests.at(-1).path, '/api/v1/sites/1/inspections?from=2026-11-05&to=2026-11-05');

  responseData = [{ code: 'ZONE_DAILY', name: '일일', targetType: 'ZONE', sections: [] }];
  assert.equal((await getInspectionTemplates()).length, 1);
  assert.equal(requests.at(-1).path, '/api/v1/inspection-templates');
  responseData = [{ equipmentId: 4, name: '펌프', active: true }];
  assert.equal((await getSiteEquipment(1))[0].equipmentId, 4);
  assert.equal(requests.at(-1).path, '/api/v1/sites/1/equipment');

  responseData = inspection;
  const createBody = { targetType: 'ZONE', zoneId: 3, equipmentId: null, workId: null, inspectDate: '2026-11-05', templateCode: 'ZONE_DAILY' };
  await createInspection(1, createBody);
  assert.deepEqual(requests.at(-1), { path: '/api/v1/sites/1/inspections', method: 'POST', body: createBody });
  const saveBody = { lockVersion: 0, items: [{ itemCode: 'TANK_ACCESS', result: 'OK', note: null }] };
  await saveInspection(7, saveBody, 1);
  assert.deepEqual(requests.at(-1), { path: '/api/v1/inspections/7', method: 'PUT', body: saveBody });
  await submitInspection(7, 1);
  assert.deepEqual(requests.at(-1), { path: '/api/v1/inspections/7/submit', method: 'POST', body: undefined });
  await getInspection(7, 1);
  assert.equal(requests.at(-1).path, '/api/v1/inspections/7');

  await assert.rejects(() => getInspection(7, 2), /선택한 현장의 점검표가 아닙니다/);
  responseData = { ...inspection, items: [{ itemCode: 'X', question: 'q', result: 'BAD' }] };
  await assert.rejects(() => getInspection(7, 1), /점검표 응답 형식/);
});
