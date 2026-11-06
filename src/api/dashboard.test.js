import test from 'node:test';
import assert from 'node:assert/strict';
import { getSafetyDashboard, getSafetyDashboardSummary } from './dashboard.js';

test('dashboard validates the selected site and displays genuine zero counts only', async (t) => {
  const storage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => null } });
  t.after(() => {
    if (storage) Object.defineProperty(globalThis, 'localStorage', storage);
    else delete globalThis.localStorage;
  });
  const dashboard = {
    siteId: 1, date: '2026-11-02', works: { total: 0, blocked: 0, byStatus: {} },
    items: [{ type: 'TBM_NOT_HELD', count: 0, overdue: false, entries: [] }],
  };
  let data = dashboard;
  let requestedPath;
  t.mock.method(globalThis, 'fetch', async (path) => {
    requestedPath = path;
    return new Response(JSON.stringify({ success: true, data }), { headers: { 'Content-Type': 'application/json' } });
  });
  assert.deepEqual(await getSafetyDashboard(1, '2026-11-02'), dashboard);
  assert.equal(requestedPath, '/api/v1/sites/1/dashboard?date=2026-11-02');
  await getSafetyDashboard(1);
  assert.equal(requestedPath, '/api/v1/sites/1/dashboard');
  for (const invalid of [
    null, { ...dashboard, siteId: 2 }, { ...dashboard, works: { total: -1, blocked: 0, byStatus: {} } },
    { ...dashboard, items: [{ count: '0' }] },
  ]) {
    data = invalid;
    await assert.rejects(getSafetyDashboard(1), /응답/);
  }
});

test('dashboard summary validates site and counts', async (t) => {
  const storage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => null } });
  t.after(() => {
    if (storage) Object.defineProperty(globalThis, 'localStorage', storage);
    else delete globalThis.localStorage;
  });
  const summary = {
    siteId: 1, from: '2026-11-01', to: '2026-11-02',
    days: [{ date: '2026-11-01', works: 2, blocked: 1, incomplete: { TBM_MISSING: 1 } }],
    totals: { TBM_MISSING: 1 }, current: { correctiveOpen: 0, correctiveOverdue: 0, approvalOverdue: 2 },
  };
  let data = summary;
  let requestedPath;
  t.mock.method(globalThis, 'fetch', async (path) => {
    requestedPath = path;
    return new Response(JSON.stringify({ success: true, data }), { headers: { 'Content-Type': 'application/json' } });
  });
  assert.deepEqual(await getSafetyDashboardSummary(1, '2026-11-01', '2026-11-02'), summary);
  assert.equal(requestedPath, '/api/v1/sites/1/dashboard/summary?from=2026-11-01&to=2026-11-02');
  for (const invalid of [null, { ...summary, siteId: 2 }, { ...summary, days: [{ date: '2026-11-01', works: -1, blocked: 0, incomplete: {} }] }, { ...summary, current: {} }]) {
    data = invalid;
    await assert.rejects(getSafetyDashboardSummary(1, '2026-11-01', '2026-11-02'), /응답/);
  }
});
