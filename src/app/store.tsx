import { useLiveQuery } from 'dexie-react-hooks';
import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
  type ReactNode,
} from 'react';

import { DEFAULT_SETTINGS, codeKey, db, ensureSeeded, newId, patchSettings, seedCodesForLine, type Settings } from '@/data/db';
import { buildColumns, daysInMonth, monthKey, shiftMonth } from '@/domain/calendar';
import {
  generateMonth, rosterId, setCell as setCellPure, setExtraHours as setExtraHoursPure,
  setRange as setRangePure,
} from '@/domain/generator';
import { employeeHours, type EmployeeHours } from '@/domain/hours';
import { autoRotate, buildHistory, fairness, type AutoRotateResult } from '@/domain/rotation';
import { summarise } from '@/domain/summary';
import { OFF } from '@/domain/types';
import type {
  AllocationRecord,
  Employee,
  Issue,
  LeaveBlock,
  Line,
  ResourceRequirement,
  RosterMonth,
  ShiftCode,
  ShiftWorkloadBalance,
  WorkOrder,
} from '@/domain/types';
import { validate } from '@/domain/validate';
import { allocateWorkOrdersToRoster, parseWorkOrdersWorkbook } from '@/domain/workload';
import { useOptionalAuth } from '@/features/auth/authStore';

interface RosterStore {
  ready: boolean;
  settings: Settings;
  lines: Line[];
  codes: ShiftCode[];
  /** Every code in the database, across all lines. */
  allCodes: ShiftCode[];
  /** Every code the active line owns, used or not. */
  lineCodes: ShiftCode[];
  /** Adds a code to this month's brush without touching any other month. */
  enableCode(codeId: string): Promise<void>;
  employees: Employee[];
  leave: LeaveBlock[];
  roster: RosterMonth | null;
  columns: ReturnType<typeof buildColumns>;
  days: ReturnType<typeof summarise>;
  issues: Issue[];
  fairnessRows: ReturnType<typeof fairness>;
  /** Worked hours and overtime per employee id, for the active month. */
  hours: Record<string, EmployeeHours>;
  canUndo: boolean;
  canRedo: boolean;
  saveStatus: 'saved' | 'saving';
  /** Persists the month and downloads an Excel backup; resolves to the filename. */
  saveRoster: () => Promise<string>;

  setMonth(year: number, month: number): void;
  /** Opens a specific line at a specific month — used after an import. */
  openSheet(lineId: string, year: number, month: number): Promise<void>;
  stepMonth(delta: number): void;
  setLine(lineId: string): void;
  setTheme(theme: 'dark' | 'light'): void;
  updateSettings(patch: Partial<Settings>): Promise<void>;

  paintCell(employeeId: string, dayIndex: number, code: string): void;
  paintRange(employeeId: string, from: number, to: number, code: string): void;
  /** Hours worked on top of that day's shift; 0 clears them. */
  setExtraHours(employeeId: string, dayIndex: number, hours: number): void;
  regenerate(options?: { respectOverrides?: boolean }): Promise<void>;
  applyRotation(result: AutoRotateResult, targetYear: number, targetMonth: number): Promise<void>;
  previewRotation(
    options?:
      | number
      | {
          aggressiveness?: number;
          targetScope?: 'leaders_only' | 'all';
          patternMode?: 'two_week_cycle' | 'monthly';
          selectedLeaderIds?: string[];
        },
  ): AutoRotateResult;
  undo(): void;
  redo(): void;

  saveEmployee(employee: Employee): Promise<void>;
  removeEmployee(id: string): Promise<void>;
  addEmployee(partial?: Partial<Employee>): Promise<Employee>;
  reorderEmployees(ids: string[]): Promise<void>;

  saveCode(code: ShiftCode): Promise<void>;
  removeCode(id: string, scope?: string): Promise<void>;
  saveLine(line: Line): Promise<void>;
  removeLine(id: string): Promise<void>;

  saveLeave(block: LeaveBlock): Promise<void>;
  removeLeave(id: string): Promise<void>;

  // Work Orders & Resource Requirements Integration
  workOrders: WorkOrder[];
  resourceRequirements: ResourceRequirement[];
  allocations: AllocationRecord[];
  shiftBalances: ShiftWorkloadBalance[];
  workloadConflicts: any[];
  uploadWorkOrders(buffer: ArrayBuffer): Promise<{ count: number }>;
  allocateResources(): Promise<void>;
  saveWorkOrder(wo: WorkOrder): Promise<void>;
  saveResourceRequirement(rr: ResourceRequirement): Promise<void>;
  removeWorkOrder(id: string): Promise<void>;
  clearWorkOrders(): Promise<void>;
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
  const allCodes = useLiveQuery(() => db.shiftCodes.orderBy('order').toArray(), [], []) ?? [];
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
   * The codes this month actually works with — what the brush offers, what the
   * headcount legend lists, and what the validator enforces minimums for.
   *
   * A sheet uses the codes that appear in its own grid, plus any an import
   * invented for it, plus any deliberately added here. Nothing else: a
   * Morning/Night operation should not be told every day that "nobody is on
   * Evening" because some other line runs an Evening shift.
   */
  const extraCodes = useLiveQuery(() => db.monthCodes.get(id), [id])?.codeIds ?? [];

  const codes = useMemo(() => {
    const used = new Set(extraCodes);
    if (roster) {
      for (const row of Object.values(roster.cells)) {
        for (const cell of row) if (cell.code && cell.code !== OFF) used.add(cell.code);
      }
    }
    return allCodes
      .filter((c) => c.scope === activeLineId && used.has(c.id))
      .sort((a, b) => a.order - b.order);
  }, [allCodes, roster, activeLineId, extraCodes.join(',')]);

  /** Every code this line owns — what Setup edits and the "+" picker offers. */
  const lineCodes = useMemo(
    () => allCodes.filter((c) => c.scope === activeLineId).sort((a, b) => a.order - b.order),
    [allCodes, activeLineId],
  );

  /**
   * Switches an existing code on for this month's brush. It is recorded
   * against the month, not copied, so Setup still lists the code once.
   */
  const enableCode = useCallback(
    async (codeId: string) => {
      const current = (await db.monthCodes.get(id))?.codeIds ?? [];
      if (current.includes(codeId)) return;
      await db.monthCodes.put({ rosterId: id, codeIds: [...current, codeId] });
    },
    [id],
  );

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
        extraHours: stored?.extraHours ?? {},
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

  const hours = useMemo(
    () =>
      roster
        ? employeeHours({ roster, employees, codes: lineCodes, standardHours: settings.standardHours })
        : {},
    [roster, employees, lineCodes, settings.standardHours],
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
  /** Moving month also records where this line is, for when we come back. */
  const goToMonth = useCallback(
    (year: number, month: number) =>
      patchSettings({
        activeYear: year,
        activeMonth: month,
        lineMonths: { ...(settings.lineMonths ?? {}), [activeLineId]: { year, month } },
      }),
    [activeLineId, settings.lineMonths],
  );

  const setMonth = useCallback(
    (year: number, month: number) => void goToMonth(year, month),
    [goToMonth],
  );

  /** Shows the sheet that was just imported, and remembers it for that line. */
  const openSheet = useCallback(
    (lineId: string, year: number, month: number) =>
      patchSettings({
        activeLineId: lineId,
        activeYear: year,
        activeMonth: month,
        lineMonths: { ...(settings.lineMonths ?? {}), [lineId]: { year, month } },
      }),
    [settings.lineMonths],
  );

  const stepMonth = useCallback(
    (delta: number) => {
      const next = shiftMonth(activeYear, activeMonth, delta);
      void goToMonth(next.year, next.month);
    },
    [activeYear, activeMonth, goToMonth],
  );

  const auth = useOptionalAuth();

  const paintCell = useCallback(
    (employeeId: string, dayIndex: number, code: string) => {
      if (!roster) return;
      commit(setCellPure(roster, employeeId, dayIndex, code));
      auth?.broadcastCellEdit(employeeId, dayIndex, code);
    },
    [roster, commit, auth],
  );

  // Real-time live collaboration sync: apply edits received from other windows/users
  useEffect(() => {
    if (!auth) return;
    return auth.subscribeToRemoteCellEdits(({ employeeId, dayIndex, code }) => {
      if (!roster) return;
      commit(setCellPure(roster, employeeId, dayIndex, code));
    });
  }, [roster, commit, auth]);

  const paintRange = useCallback(
    (employeeId: string, from: number, to: number, code: string) => {
      if (!roster) return;
      commit(setRangePure(roster, employeeId, from, to, code));
    },
    [roster, commit],
  );

  const setExtraHours = useCallback(
    (employeeId: string, dayIndex: number, value: number) => {
      if (!roster) return;
      commit(setExtraHoursPure(roster, employeeId, dayIndex, value));
    },
    [roster, commit],
  );

  const regenerate = useCallback(
    async (options?: { respectOverrides?: boolean }) => {
      const next = generateMonth({
        year: activeYear, month: activeMonth, lineId: activeLineId,
        employees, leaveBlocks: lineLeave,
        overrides: options?.respectOverrides === false ? {} : roster?.overrides ?? {},
        extraHours: roster?.extraHours ?? {},
        respectOverrides: options?.respectOverrides ?? true,
      });
      commit(next);
    },
    [activeYear, activeMonth, activeLineId, employees, lineLeave, roster, commit],
  );

  const previewRotation = useCallback(
    (
      options?:
        | number
        | {
            aggressiveness?: number;
            targetScope?: 'leaders_only' | 'all';
            patternMode?: 'two_week_cycle' | 'monthly';
            selectedLeaderIds?: string[];
          },
    ) => {
      const opts = typeof options === 'number' ? { aggressiveness: options } : options ?? {};
      const target = shiftMonth(activeYear, activeMonth, 1);
      return autoRotate({
        year: target.year,
        month: target.month,
        employees,
        codes,
        history,
        aggressiveness: opts.aggressiveness ?? 1,
        targetScope: opts.targetScope,
        patternMode: opts.patternMode,
        selectedLeaderIds: opts.selectedLeaderIds,
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
          // If result specifies exact mid-month rotation rules (e.g. 2-week cycle):
          if (result.rotationRules && result.rotationRules[employee.id]) {
            await db.employees.update(employee.id, {
              rotations: {
                ...(employee.rotations ?? {}),
                [key]: result.rotationRules[employee.id],
              },
            });
            continue;
          }

          // If this employee was deliberately kept fixed as an engineer, leave their rules intact
          if (result.engineersKeptFixed?.includes(employee.id)) {
            continue;
          }

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
    await db.shiftCodes.put({ ...code, key: codeKey(code.id, code.scope) });
  }, []);

  const removeCode = useCallback(async (codeId: string, scope?: string) => {
    await db.shiftCodes.delete(codeKey(codeId, scope));
  }, []);

  /**
   * Switching line also moves to the month that line was last on.
   *
   * Each line's sheet covers its own period — one is imported for August,
   * another for October — so carrying the current month across would land on
   * an empty month of a line that has real data elsewhere.
   */
  const switchLine = useCallback(
    async (lineId: string) => {
      const remembered = settings.lineMonths?.[lineId];
      if (remembered) {
        await patchSettings({
          activeLineId: lineId,
          activeYear: remembered.year,
          activeMonth: remembered.month,
        });
        return;
      }
      // Never visited: open the month that line actually holds data for.
      const rosters = await db.rosters.where('lineId').equals(lineId).toArray();
      const withEdits = rosters.filter((r) => Object.keys(r.overrides ?? {}).length > 0);
      const best = (withEdits.length ? withEdits : rosters)
        .reduce<typeof rosters[number] | null>((a, b) => (!a || b.updatedAt > a.updatedAt ? b : a), null);
      await patchSettings(
        best
          ? { activeLineId: lineId, activeYear: best.year, activeMonth: best.month }
          : { activeLineId: lineId },
      );
    },
    [settings.lineMonths],
  );

  const saveLine = useCallback(async (line: Line) => {
    const isNew = !(await db.lines.get(line.id));
    await db.lines.put(line);
    // A new line starts with its own copy of the standard codes, so editing
    // them never reaches another line.
    if (isNew) await seedCodesForLine(line.id);
  }, []);

  const removeLine = useCallback(async (lineId: string) => {
    await db.transaction('rw', db.lines, db.employees, db.rosters, db.shiftCodes, async () => {
      await db.lines.delete(lineId);
      await db.shiftCodes.where('scope').equals(lineId).delete();
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

  // Work Orders & Workload Integration
  const workOrders = useLiveQuery(() => db.workOrders.toArray(), [], []) ?? [];
  const resourceRequirements = useLiveQuery(() => db.resourceRequirements.toArray(), [], []) ?? [];
  const allocations = useLiveQuery(() => db.allocations.toArray(), [], []) ?? [];

  const { shiftBalances, conflicts: workloadConflicts } = useMemo(() => {
    return allocateWorkOrdersToRoster({
      lineId: activeLineId,
      year: activeYear,
      month: activeMonth,
      roster,
      employees,
      workOrders,
      requirements: resourceRequirements,
    });
  }, [activeLineId, activeYear, activeMonth, roster, employees, workOrders, resourceRequirements]);

  const uploadWorkOrders = useCallback(async (buffer: ArrayBuffer) => {
    const { workOrders: parsed } = parseWorkOrdersWorkbook(buffer);
    await db.transaction('rw', db.workOrders, async () => {
      await db.workOrders.clear();
      await db.workOrders.bulkPut(parsed);
    });
    return { count: parsed.length };
  }, []);

  const allocateResources = useCallback(async () => {
    const outcome = allocateWorkOrdersToRoster({
      lineId: activeLineId,
      year: activeYear,
      month: activeMonth,
      roster,
      employees,
      workOrders,
      requirements: resourceRequirements,
    });

    await db.transaction('rw', db.workOrders, db.allocations, async () => {
      for (const wo of outcome.updatedWorkOrders) {
        await db.workOrders.put(wo);
      }
      await db.allocations.clear();
      await db.allocations.bulkPut(outcome.allocations);
    });
  }, [activeLineId, activeYear, activeMonth, roster, employees, workOrders, resourceRequirements]);

  const saveWorkOrder = useCallback(async (wo: WorkOrder) => {
    await db.workOrders.put(wo);
  }, []);

  const saveResourceRequirement = useCallback(async (rr: ResourceRequirement) => {
    await db.resourceRequirements.put(rr);
  }, []);

  const removeWorkOrder = useCallback(async (woId: string) => {
    await db.workOrders.delete(woId);
  }, []);

  const clearWorkOrders = useCallback(async () => {
    await db.transaction('rw', db.workOrders, db.allocations, async () => {
      await db.workOrders.clear();
      await db.allocations.clear();
    });
  }, []);

  const value: RosterStore = {
    ready,
    settings,
    lines,
    codes,
    allCodes,
    lineCodes,
    enableCode,
    employees,
    leave: lineLeave,
    roster,
    columns,
    days,
    issues,
    fairnessRows,
    hours,
    canUndo: undoStack.current.length > 0,
    canRedo: redoStack.current.length > 0,
    saveStatus,
    saveRoster,

    setMonth,
    openSheet,
    stepMonth,
    setLine: (lineId) => void switchLine(lineId),
    setTheme: (theme) => void patchSettings({ theme }),
    updateSettings: (patch) => patchSettings(patch),

    paintCell,
    paintRange,
    setExtraHours,
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

    workOrders,
    resourceRequirements,
    allocations,
    shiftBalances,
    workloadConflicts,
    uploadWorkOrders,
    allocateResources,
    saveWorkOrder,
    saveResourceRequirement,
    removeWorkOrder,
    clearWorkOrders,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
