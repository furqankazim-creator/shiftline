import { useLiveQuery } from 'dexie-react-hooks';
import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
  type ReactNode,
} from 'react';

import { DEFAULT_SETTINGS, db, ensureSeeded, newId, patchSettings, type Settings } from '@/data/db';
import { buildColumns, daysInMonth, monthKey, shiftMonth } from '@/domain/calendar';
import {
  generateMonth, rosterId, setCell as setCellPure, setRange as setRangePure,
} from '@/domain/generator';
import { autoRotate, buildHistory, fairness, type AutoRotateResult } from '@/domain/rotation';
import { summarise } from '@/domain/summary';
import type {
  Employee, Issue, LeaveBlock, Line, RosterMonth, ShiftCode,
} from '@/domain/types';
import { validate } from '@/domain/validate';

interface RosterStore {
  ready: boolean;
  settings: Settings;
  lines: Line[];
  codes: ShiftCode[];
  employees: Employee[];
  leave: LeaveBlock[];
  roster: RosterMonth | null;
  columns: ReturnType<typeof buildColumns>;
  days: ReturnType<typeof summarise>;
  issues: Issue[];
  fairnessRows: ReturnType<typeof fairness>;
  canUndo: boolean;
  canRedo: boolean;
  saveStatus: 'saved' | 'saving';
  /** Persists the month and downloads an Excel backup; resolves to the filename. */
  saveRoster: () => Promise<string>;

  setMonth(year: number, month: number): void;
  stepMonth(delta: number): void;
  setLine(lineId: string): void;
  setTheme(theme: 'dark' | 'light'): void;
  updateSettings(patch: Partial<Settings>): Promise<void>;

  paintCell(employeeId: string, dayIndex: number, code: string): void;
  paintRange(employeeId: string, from: number, to: number, code: string): void;
  regenerate(options?: { respectOverrides?: boolean }): Promise<void>;
  applyRotation(result: AutoRotateResult, targetYear: number, targetMonth: number): Promise<void>;
  previewRotation(aggressiveness: number): AutoRotateResult;
  undo(): void;
  redo(): void;

  saveEmployee(employee: Employee): Promise<void>;
  removeEmployee(id: string): Promise<void>;
  addEmployee(partial?: Partial<Employee>): Promise<Employee>;
  reorderEmployees(ids: string[]): Promise<void>;

  saveCode(code: ShiftCode): Promise<void>;
  removeCode(id: string): Promise<void>;
  saveLine(line: Line): Promise<void>;
  removeLine(id: string): Promise<void>;

  saveLeave(block: LeaveBlock): Promise<void>;
  removeLeave(id: string): Promise<void>;
}

const Ctx = createContext<RosterStore | null>(null);

export function useStore(): RosterStore {
  const store = useContext(Ctx);
  if (!store) throw new Error('useStore must be used inside <StoreProvider>');
  return store;
}

const UNDO_LIMIT = 50;

export function StoreProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    ensureSeeded().then(() => setReady(true));
  }, []);

  const rawSettings = useLiveQuery(() => db.settings.get('app'), [], undefined);
  const settings: Settings = useMemo(
    () => ({ ...DEFAULT_SETTINGS, ...rawSettings }),
    [rawSettings],
  );
  const lines = useLiveQuery(() => db.lines.orderBy('order').toArray(), [], []) ?? [];
  const codes = useLiveQuery(() => db.codes.orderBy('order').toArray(), [], []) ?? [];
  const leave = useLiveQuery(() => db.leave.toArray(), [], []) ?? [];

  const { activeLineId, activeYear, activeMonth } = settings;

  const employees = useLiveQuery(
    async () =>
      (await db.employees.where('lineId').equals(activeLineId).toArray()).sort(
        (a, b) => a.order - b.order,
      ),
    [activeLineId],
    [],
  ) ?? [];

  const lineLeave = useMemo(() => {
    const ids = new Set(employees.map((e) => e.id));
    return leave.filter((l) => ids.has(l.employeeId));
  }, [leave, employees]);

  // ---- the active month's grid ------------------------------------------
  const [roster, setRoster] = useState<RosterMonth | null>(null);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving'>('saved');
  const undoStack = useRef<RosterMonth[]>([]);
  const redoStack = useRef<RosterMonth[]>([]);
  const [, forceRender] = useState(0);

  const id = rosterId(activeLineId, activeYear, activeMonth);

  /**
   * Loads the stored grid for the active month, or generates one on the fly.
   *
   * A month the client has never opened still shows a complete roster — that
   * is the whole point of the tool, so there is no "empty month" state.
   */
  useEffect(() => {
    if (!ready || employees.length === 0) return;
    let cancelled = false;

    (async () => {
      const stored = await db.rosters.get(id);
      const next = generateMonth({
        year: activeYear, month: activeMonth, lineId: activeLineId,
        employees, leaveBlocks: lineLeave, overrides: stored?.overrides ?? {},
      });
      if (cancelled) return;
      undoStack.current = [];
      redoStack.current = [];
      setRoster(next);

      // Persist a month the first time it is opened. Rotation fairness reads
      // night-shift debt out of stored months, so a roster that was generated
      // but never saved would leave everyone looking like they had worked zero
      // nights.
      if (!stored) await db.rosters.put(next);
    })();

    return () => {
      cancelled = true;
    };
    // `employees`/`lineLeave` identity changes whenever the underlying rows do,
    // which is exactly when the grid should be rebuilt.
  }, [ready, id, activeLineId, activeYear, activeMonth, employees, lineLeave]);

  const persist = useCallback(async (next: RosterMonth) => {
    setSaveStatus('saving');
    try {
      await db.rosters.put(next);
      setSaveStatus('saved');
    } catch {
      setSaveStatus('saved');
    }
  }, []);

  /**
   * Explicit Save: persist the month (already auto-saved on every edit) and
   * also hand the supervisor a file — the full Excel backup, which restores
   * exactly. Returns the downloaded filename.
   */
  const saveRoster = useCallback(async () => {
    if (!roster) return '';
    setSaveStatus('saving');
    await db.rosters.put(roster);
    setSaveStatus('saved');
    const [{ getFullBackupData }, { downloadBackupXlsx }] = await Promise.all([
      import('@/data/db'),
      import('@/io/exportXlsx'),
    ]);
    return downloadBackupXlsx(await getFullBackupData(), {
      activeLineId: roster.lineId,
      activeYear: roster.year,
      activeMonth: roster.month,
    });
  }, [roster]);

  const commit = useCallback(
    (next: RosterMonth) => {
      setRoster((prev) => {
        if (prev) {
          undoStack.current = [...undoStack.current, prev].slice(-UNDO_LIMIT);
          redoStack.current = [];
        }
        return next;
      });
      void persist(next);
      forceRender((n) => n + 1);
    },
    [persist],
  );

  const columns = useMemo(
    () => buildColumns(activeYear, activeMonth, settings.weekendDays as never),
    [activeYear, activeMonth, settings.weekendDays],
  );

  const nDays = daysInMonth(activeYear, activeMonth);

  const days = useMemo(
    () => (roster ? summarise(roster, codes, nDays) : []),
    [roster, codes, nDays],
  );

  const issues = useMemo(
    () =>
      roster
        ? validate({
            roster, employees, codes, leaveBlocks: lineLeave,
            nDays, maxConsecutive: settings.maxConsecutive,
          })
        : [],
    [roster, employees, codes, lineLeave, nDays, settings.maxConsecutive],
  );

  // ---- history for fairness + rotation ----------------------------------
  const pastRosters = useLiveQuery(
    () => db.rosters.where('lineId').equals(activeLineId).toArray(),
    [activeLineId],
    [],
  ) ?? [];

  const history = useMemo(
    () =>
      buildHistory(
        pastRosters.filter(
          (r) => r.year * 12 + r.month <= activeYear * 12 + activeMonth,
        ),
      ),
    [pastRosters, activeYear, activeMonth],
  );

  const fairnessRows = useMemo(
    () => fairness(history, employees, codes),
    [history, employees, codes],
  );

  // ---- actions ----------------------------------------------------------
  const setMonth = useCallback((year: number, month: number) => {
    void patchSettings({ activeYear: year, activeMonth: month });
  }, []);

  const stepMonth = useCallback(
    (delta: number) => {
      const next = shiftMonth(activeYear, activeMonth, delta);
      void patchSettings({ activeYear: next.year, activeMonth: next.month });
    },
    [activeYear, activeMonth],
  );

  const paintCell = useCallback(
    (employeeId: string, dayIndex: number, code: string) => {
      if (!roster) return;
      commit(setCellPure(roster, employeeId, dayIndex, code));
    },
    [roster, commit],
  );

  const paintRange = useCallback(
    (employeeId: string, from: number, to: number, code: string) => {
      if (!roster) return;
      commit(setRangePure(roster, employeeId, from, to, code));
    },
    [roster, commit],
  );

  const regenerate = useCallback(
    async (options?: { respectOverrides?: boolean }) => {
      const next = generateMonth({
        year: activeYear, month: activeMonth, lineId: activeLineId,
        employees, leaveBlocks: lineLeave,
        overrides: options?.respectOverrides === false ? {} : roster?.overrides ?? {},
        respectOverrides: options?.respectOverrides ?? true,
      });
      commit(next);
    },
    [activeYear, activeMonth, activeLineId, employees, lineLeave, roster, commit],
  );

  const previewRotation = useCallback(
    (aggressiveness: number) => {
      const target = shiftMonth(activeYear, activeMonth, 1);
      return autoRotate({
        year: target.year, month: target.month,
        employees, codes, history, aggressiveness,
      });
    },
    [activeYear, activeMonth, employees, codes, history],
  );

  /**
   * Writes a rotation result into the target month.
   *
   * The new shift is stored as that month's rotation rule rather than by
   * rewriting `defaultShift`, so past months keep rendering as they were and
   * the client can still see why a person sat where they did.
   */
  const applyRotation = useCallback(
    async (result: AutoRotateResult, targetYear: number, targetMonth: number) => {
      const key = monthKey(targetYear, targetMonth);
      const span = daysInMonth(targetYear, targetMonth);

      await db.transaction('rw', db.employees, db.rosters, async () => {
        for (const employee of employees) {
          const code = result.assignments[employee.id];
          if (!code) continue;
          await db.employees.update(employee.id, {
            rotations: {
              ...(employee.rotations ?? {}),
              [key]: [{ fromDay: 1, toDay: span, code }],
            },
          });
        }
        await db.rosters.delete(rosterId(activeLineId, targetYear, targetMonth));
      });

      void patchSettings({ activeYear: targetYear, activeMonth: targetMonth });
    },
    [employees, activeLineId],
  );

  const undo = useCallback(() => {
    const prev = undoStack.current.pop();
    if (!prev) return;
    setRoster((current) => {
      if (current) redoStack.current = [...redoStack.current, current].slice(-UNDO_LIMIT);
      return prev;
    });
    void persist(prev);
    forceRender((n) => n + 1);
  }, [persist]);

  const redo = useCallback(() => {
    const next = redoStack.current.pop();
    if (!next) return;
    setRoster((current) => {
      if (current) undoStack.current = [...undoStack.current, current].slice(-UNDO_LIMIT);
      return next;
    });
    void persist(next);
    forceRender((n) => n + 1);
  }, [persist]);

  // ---- CRUD -------------------------------------------------------------
  const saveEmployee = useCallback(async (employee: Employee) => {
    await db.employees.put(employee);
  }, []);

  const removeEmployee = useCallback(async (empId: string) => {
    await db.transaction('rw', db.employees, db.leave, async () => {
      await db.employees.delete(empId);
      await db.leave.where('employeeId').equals(empId).delete();
    });
  }, []);

  const addEmployee = useCallback(
    async (partial?: Partial<Employee>) => {
      const employee: Employee = {
        id: newId('e'),
        lineId: activeLineId,
        name: 'New employee',
        contact: '',
        order: (employees.at(-1)?.order ?? 0) + 1,
        defaultShift: codes.find((c) => c.rotates)?.id ?? 'M',
        restDays: [5, 6],
        pinned: false,
        active: true,
        ...partial,
      };
      await db.employees.put(employee);
      return employee;
    },
    [activeLineId, employees, codes],
  );

  const reorderEmployees = useCallback(async (ids: string[]) => {
    await db.transaction('rw', db.employees, async () => {
      await Promise.all(ids.map((empId, i) => db.employees.update(empId, { order: i + 1 })));
    });
  }, []);

  const saveCode = useCallback(async (code: ShiftCode) => {
    await db.codes.put(code);
  }, []);

  const removeCode = useCallback(async (codeId: string) => {
    await db.codes.delete(codeId);
  }, []);

  const saveLine = useCallback(async (line: Line) => {
    await db.lines.put(line);
  }, []);

  const removeLine = useCallback(async (lineId: string) => {
    await db.transaction('rw', db.lines, db.employees, db.rosters, async () => {
      await db.lines.delete(lineId);
      await db.employees.where('lineId').equals(lineId).delete();
      await db.rosters.where('lineId').equals(lineId).delete();
    });
  }, []);

  const saveLeave = useCallback(async (block: LeaveBlock) => {
    await db.leave.put(block);
  }, []);

  const removeLeave = useCallback(async (leaveId: string) => {
    await db.leave.delete(leaveId);
  }, []);

  const value: RosterStore = {
    ready,
    settings,
    lines,
    codes,
    employees,
    leave: lineLeave,
    roster,
    columns,
    days,
    issues,
    fairnessRows,
    canUndo: undoStack.current.length > 0,
    canRedo: redoStack.current.length > 0,
    saveStatus,
    saveRoster,

    setMonth,
    stepMonth,
    setLine: (lineId) => void patchSettings({ activeLineId: lineId }),
    setTheme: (theme) => void patchSettings({ theme }),
    updateSettings: (patch) => patchSettings(patch),

    paintCell,
    paintRange,
    regenerate,
    applyRotation,
    previewRotation,
    undo,
    redo,

    saveEmployee,
    removeEmployee,
    addEmployee,
    reorderEmployees,
    saveCode,
    removeCode,
    saveLine,
    removeLine,
    saveLeave,
    removeLeave,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
