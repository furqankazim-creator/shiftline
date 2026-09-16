import Dexie, { type EntityTable } from 'dexie';

import type { Employee, LeaveBlock, Line, RosterMonth, ShiftCode } from '@/domain/types';
import { SEED_CODES, SEED_EMPLOYEES, SEED_LEAVE, SEED_LINES } from './seed';

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
};

class RosterDB extends Dexie {
  lines!: EntityTable<Line, 'id'>;
  employees!: EntityTable<Employee, 'id'>;
  codes!: EntityTable<ShiftCode, 'id'>;
  leave!: EntityTable<LeaveBlock, 'id'>;
  rosters!: EntityTable<RosterMonth, 'id'>;
  settings!: EntityTable<Settings, 'key'>;

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

  await db.transaction('rw', db.lines, db.employees, db.codes, db.leave, db.settings, async () => {
    await db.lines.bulkPut(SEED_LINES);
    await db.codes.bulkPut(SEED_CODES);
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

/** Full backup — everything the app knows, as one JSON file. */
export async function exportBackup(): Promise<string> {
  const [lines, employees, codes, leave, rosters, settings] = await Promise.all([
    db.lines.toArray(),
    db.employees.toArray(),
    db.codes.toArray(),
    db.leave.toArray(),
    db.rosters.toArray(),
    getSettings(),
  ]);
  return JSON.stringify(
    { version: 1, exportedAt: new Date().toISOString(), lines, employees, codes, leave, rosters, settings },
    null,
    2,
  );
}

export async function importBackup(json: string): Promise<void> {
  const data = JSON.parse(json);
  if (!data || typeof data !== 'object' || !Array.isArray(data.employees)) {
    throw new Error('That file is not a ShiftLine backup.');
  }
  await db.transaction(
    'rw',
    [db.lines, db.employees, db.codes, db.leave, db.rosters, db.settings],
    async () => {
      await Promise.all([
        db.lines.clear(), db.employees.clear(), db.codes.clear(),
        db.leave.clear(), db.rosters.clear(),
      ]);
      await db.lines.bulkPut(data.lines ?? SEED_LINES);
      await db.codes.bulkPut(data.codes ?? SEED_CODES);
      await db.employees.bulkPut(data.employees);
      await db.leave.bulkPut(data.leave ?? []);
      await db.rosters.bulkPut(data.rosters ?? []);
      if (data.settings) await db.settings.put({ ...data.settings, key: 'app', seeded: true });
    },
  );
}

/** Wipes everything and reloads the shipped September demo. */
export async function resetToSeed(): Promise<void> {
  await db.transaction(
    'rw',
    [db.lines, db.employees, db.codes, db.leave, db.rosters, db.settings],
    async () => {
      await Promise.all([
        db.lines.clear(), db.employees.clear(), db.codes.clear(),
        db.leave.clear(), db.rosters.clear(), db.settings.clear(),
      ]);
    },
  );
  await ensureSeeded();
}

export function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}
