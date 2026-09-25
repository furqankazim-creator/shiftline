import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { describe, expect, it } from 'vitest';

/**
 * Upgrading a database that already holds data.
 *
 * The v3 change re-keys shift codes by (scope, id). IndexedDB cannot change a
 * store's primary key in place, and getting this wrong throws on open — the
 * app then hangs on "Loading roster…" with every month inaccessible. This
 * walks the real upgrade path rather than starting from an empty database.
 */
describe('upgrading a v2 database', () => {
  it('opens, keeps every code, and makes them global', async () => {
    // ---- a database as shipped before the scoping change -----------------
    const old = new Dexie('shiftline');
    old.version(1).stores({
      lines: 'id, order',
      employees: 'id, lineId, order',
      codes: 'id, order',
      leave: 'id, employeeId, from, to',
      rosters: 'id, lineId, [year+month]',
      settings: 'key',
    });
    old.version(2).stores({});
    await old.open();
    await old.table('codes').bulkPut([
      { id: 'M', label: 'Morning', timing: '06:00 – 15:00', tone: 'morning', minHeadcount: 2, countsAsEngineer: true, rotates: true, order: 1 },
      { id: 'N', label: 'Night', timing: '22:00 – 07:00', tone: 'night', minHeadcount: 2, countsAsEngineer: true, rotates: true, order: 3 },
      { id: 'H', label: 'Holiday', timing: '', tone: 'off', minHeadcount: 0, countsAsEngineer: false, rotates: false, order: 99 },
    ]);
    await old.table('employees').put({
      id: 'e01', lineId: 'line5', name: 'Abdul Saeed', contact: '', order: 1,
      defaultShift: 'M', restDays: [5, 6],
    });
    old.close();

    // ---- open with the current schema ------------------------------------
    const { db, codeKey } = await import('@/data/db');
    await db.open();

    const codes = await db.shiftCodes.toArray();
    expect(codes.map((c) => c.id).sort()).toEqual(['H', 'M', 'N']);
    // Pre-existing codes carry no scope, so they stay on every month's brush.
    expect(codes.every((c) => c.scope === undefined)).toBe(true);
    expect((await db.shiftCodes.get(codeKey('H')))?.label).toBe('Holiday');

    // The rest of the data is untouched and the old store is gone.
    expect((await db.employees.get('e01'))?.name).toBe('Abdul Saeed');
    expect(db.tables.map((t) => t.name)).not.toContain('codes');
    expect(db.verno).toBe(4);

    db.close();
  });
});
