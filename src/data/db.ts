import Dexie, { type EntityTable } from 'dexie';

import type { Employee, LeaveBlock, Line, RosterMonth, SheetLayout, ShiftCode } from '@/domain/types';
import { SEED_CODES, SEED_EMPLOYEES, SEED_LEAVE, SEED_LINES } from './seed';

export type FontSize = 'xs' | 'compact' | 'normal' | 'large' | 'xl';
export type FontFamily =
  | 'default'
  | 'roboto'
  | 'segoe'
  | 'apple'
  | 'open-sans'
  | 'plex'
  | 'mono'
  | 'calibri'
  | 'serif'
  | 'system'
  | 'sans';

export interface Settings {
  key: 'app';
  theme: 'dark' | 'light';
  activeLineId: string;
  activeYear: number;
  activeMonth: number;
  /** Weekday columns tinted as the weekend. The client runs Fri/Sat. */
  weekendDays: number[];
  maxConsecutive: number;
  seeded: boolean;
  zoomLevel: number;
  fontSize: FontSize;
  fontFamily: FontFamily;
  /**
   * The month each line was last on, keyed by line id.
   *
   * Lines cover different periods — one sheet is imported for August, another
   * for October — so switching line returns to where that line was rather
   * than carrying the current month across.
   */
  lineMonths?: Record<string, { year: number; month: number }>;
}

export const DEFAULT_SETTINGS: Settings = {
  key: 'app',
  theme: 'dark',
  activeLineId: 'line5',
  activeYear: 2026,
  activeMonth: 9,
  weekendDays: [5, 6],
  maxConsecutive: 6,
  seeded: false,
  zoomLevel: 100,
  fontSize: 'normal',
  fontFamily: 'default',
  lineMonths: {},
};

/**
 * Primary key for a shift code.
 *
 * Codes are identified in the grid by their token ("M", "H"), but a token is
 * only unique within its scope: two imported sheets may each define their own
 * "H". The stored row therefore carries a surrogate key combining the two.
 */
export function codeKey(id: string, scope?: string): string {
  return `${scope ?? '*'}::${id}`;
}

/** The starter set a newly created line is given, as its own private copy. */
export async function seedCodesForLine(lineId: string): Promise<void> {
  const template = await db.shiftCodes.filter((c) => !c.scope).toArray();
  const source = template.length ? template : SEED_CODES;
  await db.shiftCodes.bulkPut(
    source.map(({ key: _k, ...c }: ShiftCode & { key?: string }) => ({
      ...c, scope: lineId, key: codeKey(c.id, lineId),
    })),
  );
}

/** Extra codes switched on for one month via the brush's "+" picker. */
export interface StoredMonthCodes {
  rosterId: string;
  codeIds: string[];
}

/** An imported sheet's layout, keyed by the roster it belongs to. */
export interface StoredLayout {
  rosterId: string;
  layout: SheetLayout;
}

/** A ShiftCode as stored: the surrogate primary key is added on write. */
export type StoredShiftCode = ShiftCode & { key: string };

class RosterDB extends Dexie {
  lines!: EntityTable<Line, 'id'>;
  employees!: EntityTable<Employee, 'id'>;
  /**
   * Named `shiftCodes` rather than `codes` because the primary key changed
   * from the bare token to (scope, token), and IndexedDB cannot re-key a
   * store in place — the rows are copied into this table and the old one is
   * dropped. See v3/v4 below.
   */
  shiftCodes!: EntityTable<StoredShiftCode, 'key'>;
  leave!: EntityTable<LeaveBlock, 'id'>;
  rosters!: EntityTable<RosterMonth, 'id'>;
  settings!: EntityTable<Settings, 'key'>;
  /** Source-file shape per roster, so Export can mirror an imported template. */
  layouts!: EntityTable<StoredLayout, 'rosterId'>;
  /** Codes added to a single month's brush that its grid does not use yet. */
  monthCodes!: EntityTable<StoredMonthCodes, 'rosterId'>;

  constructor() {
    super('shiftline');
    this.version(1).stores({
      lines: 'id, order',
      employees: 'id, lineId, order',
      codes: 'id, order',
      leave: 'id, employeeId, from, to',
      rosters: 'id, lineId, [year+month]',
      settings: 'key',
    });

    // v2: add ML / EL / NL to existing databases so they appear globally on all
    // lines — not just on lines where an import happened to create them.
    this.version(2).stores({}).upgrade(async (tx) => {
      const EXTRA: ShiftCode[] = [
        { id: 'ML', label: 'Morning Late', timing: '07:00 – 18:00', tone: 'morning', minHeadcount: 0, countsAsEngineer: false, rotates: false, order: 11 },
        { id: 'EL', label: 'Evening Late', timing: '15:00 – 00:00', tone: 'evening', minHeadcount: 0, countsAsEngineer: false, rotates: false, order: 12 },
        { id: 'NL', label: 'Night Late',   timing: '19:00 – 07:00', tone: 'night',   minHeadcount: 0, countsAsEngineer: false, rotates: false, order: 13 },
      ];
      const codesTable = tx.table<ShiftCode, string>('codes');
      for (const code of EXTRA) {
        const existing = await codesTable.get(code.id);
        if (!existing) await codesTable.put(code);
      }
    });

    // v3: codes become keyed by (scope, id), so an imported sheet can own a
    // code token without it appearing on every other month's brush.
    //
    // IndexedDB cannot change a store's primary key, so the rows are copied
    // into a new `shiftCodes` store here and the old `codes` store is dropped
    // in v4. Existing codes have no scope, so they stay global — nothing
    // disappears on upgrade.
    this.version(3).stores({
      shiftCodes: 'key, id, scope, order',
    }).upgrade(async (tx) => {
      const old = await tx.table('codes').toArray();
      if (old.length) {
        await tx.table('shiftCodes').bulkPut(
          old.map((c) => ({ ...c, key: codeKey(c.id, c.scope) })),
        );
      }
    });

    // v4: drop the re-keyed store, and remember the layout of an imported
    // workbook so Export can write the month back in that same shape.
    this.version(4).stores({ codes: null, layouts: 'rosterId' });

    // v5: a month can switch on an existing code without a private copy of it.
    // Earlier builds cloned the code instead, which listed it twice in Setup;
    // those duplicates are dropped here.
    this.version(5).stores({ monthCodes: 'rosterId' }).upgrade(async (tx) => {
      const table = tx.table('shiftCodes');
      const all = await table.toArray();
      const globalIds = new Set(all.filter((c) => !c.scope).map((c) => c.id));
      const perMonth = new Map<string, string[]>();
      for (const c of all) {
        if (!c.scope || !globalIds.has(c.id)) continue;
        perMonth.set(c.scope, [...(perMonth.get(c.scope) ?? []), c.id]);
        await table.delete(c.key);
      }
      for (const [rosterId, codeIds] of perMonth) {
        await tx.table('monthCodes').put({ rosterId, codeIds });
      }
    });

    // v6: each line keeps its own shift codes, so editing one line's Night
    // minimum no longer changes every other line's. The unscoped rows stay as
    // the template new lines are copied from.
    this.version(6).stores({}).upgrade(async (tx) => {
      const table = tx.table('shiftCodes');
      const lines = await tx.table('lines').toArray();
      const all = await table.toArray();
      const template = all.filter((c) => !c.scope);

      for (const line of lines) {
        // Anything previously scoped to one of this line's months becomes a
        // code of the line itself.
        const fromMonths = all.filter((c) => c.scope?.startsWith(`${line.id}:`));
        const own = new Map<string, Record<string, unknown>>();
        for (const c of template) own.set(c.id, { ...c });
        for (const c of fromMonths) own.set(c.id, { ...c });
        for (const c of own.values()) {
          await table.put({ ...c, scope: line.id, key: codeKey(c.id as string, line.id) });
        }
      }
      // Drop the month-scoped rows now that the line owns them.
      for (const c of all) {
        if (c.scope && c.scope.includes(':')) await table.delete(c.key);
      }
    });
  }
}

export const db = new RosterDB();

/**
 * Loads the client's real September roster on first run.
 *
 * Opening onto his own data rather than an empty grid is deliberate — he can
 * see the tool working against something he recognises before entering
 * anything himself.
 */
export async function ensureSeeded(): Promise<void> {
  const existing = await db.settings.get('app');
  if (existing?.seeded) return;

  await db.transaction('rw', db.lines, db.employees, db.shiftCodes, db.leave, db.settings, async () => {
    await db.lines.bulkPut(SEED_LINES);
    // The unscoped rows are the template; each line gets its own copy.
    await db.shiftCodes.bulkPut(SEED_CODES.map((c) => ({ ...c, key: codeKey(c.id) })));
    for (const line of SEED_LINES) {
      await db.shiftCodes.bulkPut(
        SEED_CODES.map((c) => ({ ...c, scope: line.id, key: codeKey(c.id, line.id) })),
      );
    }
    await db.employees.bulkPut(SEED_EMPLOYEES);
    await db.leave.bulkPut(SEED_LEAVE);
    await db.settings.put({ ...DEFAULT_SETTINGS, ...existing, key: 'app', seeded: true });
  });
}

export async function getSettings(): Promise<Settings> {
  return (await db.settings.get('app')) ?? DEFAULT_SETTINGS;
}

export async function patchSettings(patch: Partial<Settings>): Promise<void> {
  const current = await getSettings();
  await db.settings.put({ ...current, ...patch, key: 'app' });
}

export async function getFullBackupData() {
  const [lines, employees, codes, leave, rosters, settings] = await Promise.all([
    db.lines.toArray(),
    db.employees.toArray(),
    db.shiftCodes.toArray(),
    db.leave.toArray(),
    db.rosters.toArray(),
    getSettings(),
  ]);
  return { lines, employees, codes, leave, rosters, settings };
}

/** Full backup — everything the app knows, as one JSON file. */
export async function exportBackup(): Promise<string> {
  const data = await getFullBackupData();
  return JSON.stringify(
    { version: 1, exportedAt: new Date().toISOString(), ...data },
    null,
    2,
  );
}

export async function importBackupData(data: any): Promise<void> {
  if (!data || typeof data !== 'object' || !Array.isArray(data.employees)) {
    throw new Error('That file is not a valid ShiftLine backup (missing employee records).');
  }
  await db.transaction(
    'rw',
    [db.lines, db.employees, db.shiftCodes, db.leave, db.rosters, db.settings],
    async () => {
      await Promise.all([
        db.lines.clear(), db.employees.clear(), db.shiftCodes.clear(),
        db.leave.clear(), db.rosters.clear(),
      ]);
      await db.lines.bulkPut(data.lines?.length ? data.lines : SEED_LINES);
      const restoredCodes: ShiftCode[] = data.codes?.length ? data.codes : SEED_CODES;
      await db.shiftCodes.bulkPut(restoredCodes.map((c) => ({ ...c, key: codeKey(c.id, c.scope) })));
      await db.employees.bulkPut(data.employees);
      await db.leave.bulkPut(data.leave ?? []);
      await db.rosters.bulkPut(data.rosters ?? []);
      if (data.settings) await db.settings.put({ ...data.settings, key: 'app', seeded: true });
    },
  );
}

export async function importBackup(json: string): Promise<void> {
  let data: any;
  try {
    data = JSON.parse(json);
  } catch {
    throw new Error('Selected file is not valid JSON. Please upload a valid ShiftLine .json backup.');
  }
  await importBackupData(data);
}

/** Wipes everything and reloads the shipped September demo. */
export async function resetToSeed(): Promise<void> {
  await db.transaction(
    'rw',
    [db.lines, db.employees, db.shiftCodes, db.leave, db.rosters, db.settings],
    async () => {
      await Promise.all([
        db.lines.clear(), db.employees.clear(), db.shiftCodes.clear(),
        db.leave.clear(), db.rosters.clear(), db.settings.clear(),
      ]);
    },
  );
  await ensureSeeded();
}

export function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}
