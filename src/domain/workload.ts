import * as XLSX from 'xlsx-js-style';

import type {
  AllocationRecord,
  Employee,
  ResourceRequirement,
  RosterMonth,
  ShiftWorkloadBalance,
  WorkOrder,
} from './types';

/** Normalizes line name/token into standard 'L4' | 'L5' | 'L6' */
export function normalizeLineCode(raw: string | undefined): 'L4' | 'L5' | 'L6' {
  if (!raw) return 'L5';
  const clean = String(raw).trim().toUpperCase();
  if (clean.includes('4') || clean === 'L4') return 'L4';
  if (clean.includes('6') || clean === 'L6') return 'L6';
  return 'L5';
}

/** Converts 'line4' | 'line5' | 'line6' into 'L4' | 'L5' | 'L6' */
export function lineIdToCode(lineId: string): 'L4' | 'L5' | 'L6' {
  if (lineId === 'line4') return 'L4';
  if (lineId === 'line6') return 'L6';
  return 'L5';
}

/** Converts 'L4' | 'L5' | 'L6' into 'line4' | 'line5' | 'line6' */
export function lineCodeToId(code: string): string {
  if (code === 'L4') return 'line4';
  if (code === 'L6') return 'line6';
  return 'line5';
}

/** Normalizes Work Type into PM, CM, ACS */
export function normalizeWorkType(raw: string | undefined): 'PM' | 'CM' | 'ACS' {
  if (!raw) return 'PM';
  const clean = String(raw).trim().toUpperCase();
  if (clean.startsWith('P') || clean.includes('PREV')) return 'PM';
  if (clean.startsWith('C') || clean.includes('CORR')) return 'CM';
  if (clean.includes('ACS') || clean.includes('CHECK') || clean.includes('INSP')) return 'ACS';
  return 'PM';
}

/**
 * Parses an uploaded November Work Orders Excel file (Nov-Workorders.xlsx).
 * Handles flexible header names including the 3 yellow highlighted columns:
 * - Line
 * - Finish Note Later Date / Scheduled Finish
 * - Finish Earlier / Earlier Due Start / Scheduled Start
 */
export function parseWorkOrdersWorkbook(buffer: ArrayBuffer): {
  workOrders: WorkOrder[];
  totalRows: number;
  warnings: string[];
} {
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) throw new Error('Excel workbook contains no sheets.');

  const sheet = wb.Sheets[sheetName];
  const rows: Record<string, any>[] = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });

  const workOrders: WorkOrder[] = [];
  const warnings: string[] = [];

  rows.forEach((row, idx) => {
    // Locate columns with flexible key matching
    const findVal = (patterns: string[]): string => {
      for (const [k, v] of Object.entries(row)) {
        const keyClean = k.trim().toLowerCase();
        if (patterns.some((p) => keyClean.includes(p.toLowerCase()))) {
          return String(v).trim();
        }
      }
      return '';
    };

    const rawWoId = findVal(['work order', 'wo number', 'order id', 'wo', 'id']) || `WO-${13400000 + idx}`;
    const rawLine = findVal(['line', 'prod line', 'production line']) || 'L5';
    const rawType = findVal(['work type', 'type', 'activity type']) || 'PM';
    const rawDept = findVal(['department', 'dept', 'section']) || 'SLV';
    const rawDesc = findVal(['description', 'task', 'desc', 'activity']) || `Work Order ${rawWoId}`;
    const rawStart = findVal(['earlier due start', 'finish earlier', 'scheduled start', 'start date', 'early start']) || '2026-11-01';
    const rawFinish = findVal(['finish note later date', 'finish later', 'scheduled finish', 'finish date', 'target finish']) || '2026-11-15';
    const rawStatus = findVal(['status', 'state']) || 'APPR';
    const rawCrew = findVal(['resource', 'people', 'manpower', 'crew']);

    const line = normalizeLineCode(rawLine);
    const workType = normalizeWorkType(rawType);

    // Default crew size based on work type: PM=2 (or Oct pattern 2-4), CM=2, ACS=1
    let resourceRequired = workType === 'PM' ? 2 : workType === 'CM' ? 2 : 1;
    if (rawCrew && !isNaN(parseInt(rawCrew, 10))) {
      resourceRequired = Math.max(1, parseInt(rawCrew, 10));
    }

    // Standardize dates (extract YYYY-MM-DD)
    const cleanDate = (str: string, fallback: string) => {
      if (!str) return fallback;
      const match = str.match(/\d{4}[-/.]\d{1,2}[-/.]\d{1,2}/);
      if (match) return match[0].replace(/\//g, '-').replace(/\./g, '-');
      return str.slice(0, 10) || fallback;
    };

    const scheduledStart = cleanDate(rawStart, '2026-11-01');
    const scheduledFinish = cleanDate(rawFinish, '2026-11-15');

    workOrders.push({
      id: `wo-${rawWoId.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${idx}`,
      workOrderId: rawWoId,
      description: rawDesc,
      workType,
      line,
      department: rawDept,
      scheduledStart,
      scheduledFinish,
      targetFinish: scheduledFinish,
      status: rawStatus,
      resourceRequired,
      allocationStatus: 'UNASSIGNED',
    });
  });

  return { workOrders, totalRows: rows.length, warnings };
}

/**
 * Returns default resource requirements for a line, type, and shift.
 */
export function getRequiredCrewCount(
  requirements: ResourceRequirement[],
  line: string,
  workType: string,
  shift: 'morning' | 'evening' | 'night',
): number {
  const normLine = normalizeLineCode(line);
  const normType = normalizeWorkType(workType);

  const matched = requirements.find(
    (r) =>
      r.line === normLine &&
      r.workType === normType &&
      (r.shift === shift || r.shift === 'all'),
  );

  if (matched) return matched.defaultPeopleCount;
  // Fallbacks from client requirements
  if (normType === 'PM') return 2;
  if (normType === 'CM') return 2;
  return 1;
}

export interface AllocationEngineInput {
  lineId: string;
  year: number;
  month: number;
  roster: RosterMonth | null;
  employees: Employee[];
  workOrders: WorkOrder[];
  requirements: ResourceRequirement[];
}

export interface AllocationEngineOutput {
  updatedWorkOrders: WorkOrder[];
  allocations: AllocationRecord[];
  shiftBalances: ShiftWorkloadBalance[];
  conflicts: {
    woId: string;
    description: string;
    line: string;
    date: string;
    shift: string;
    needed: number;
    available: number;
    shortage: number;
    reason: string;
  }[];
  totalWorkOrders: number;
  allocatedCount: number;
  shortCount: number;
}

/**
 * Core Algorithm: Matches work orders to available roster slots,
 * marks individual working engineers by name as allocated,
 * and calculates live net buffer and conflict alerts.
 */
export function allocateWorkOrdersToRoster(input: AllocationEngineInput): AllocationEngineOutput {
  const { lineId, year, month, roster, employees, workOrders, requirements } = input;
  const targetLineCode = lineIdToCode(lineId);

  // Filter work orders for this line
  const lineWorkOrders = workOrders.filter((wo) => normalizeLineCode(wo.line) === targetLineCode);

  const allocations: AllocationRecord[] = [];
  const conflicts: AllocationEngineOutput['conflicts'] = [];

  // Track daily employee assignment to prevent double-booking:
  // key: `${empId}::${dayIndex}::${shiftCode}` -> workOrderId
  const busyEmployees = new Map<string, string>();

  // Helper to find working engineers on a given day and shift
  const getWorkingStaff = (dayNum: number, shiftCode: 'M' | 'E' | 'N'): Employee[] => {
    if (!roster) return [];
    const dayIdx = dayNum - 1;
    const working: Employee[] = [];

    for (const emp of employees) {
      if (emp.active === false) continue;
      const cell = roster.cells[emp.id]?.[dayIdx];
      if (cell && cell.code === shiftCode) {
        working.push(emp);
      }
    }
    return working;
  };

  const updatedWorkOrders: WorkOrder[] = lineWorkOrders.map((wo) => {
    // Determine target day and shift
    const startParts = wo.scheduledStart.split('-');
    let targetDay = 1;
    if (startParts.length === 3) {
      const d = parseInt(startParts[2], 10);
      if (!isNaN(d) && d >= 1 && d <= 31) targetDay = d;
    }

    // Default shift preference: PM typically Morning or Night; CM on Evening/Morning
    let targetShift: 'M' | 'E' | 'N' = 'M';
    if (wo.plannedShift) {
      targetShift = wo.plannedShift;
    } else if (wo.workType === 'PM' && wo.resourceRequired >= 4) {
      targetShift = 'N'; // Heavy PM assigned to night
    } else if (wo.workType === 'CM') {
      targetShift = 'E';
    }

    const shiftName = targetShift === 'M' ? 'morning' : targetShift === 'E' ? 'evening' : 'night';
    const needed = wo.resourceRequired || getRequiredCrewCount(requirements, wo.line, wo.workType, shiftName);

    // Candidates working on that line, day, and shift
    const workingOnShift = getWorkingStaff(targetDay, targetShift);
    const availableStaff = workingOnShift.filter(
      (e) => !busyEmployees.has(`${e.id}::${targetDay}::${targetShift}`),
    );

    if (availableStaff.length >= needed) {
      const assigned = availableStaff.slice(0, needed);
      const assignedIds = assigned.map((e) => e.id);
      const assignedNames = assigned.map((e) => e.name);

      assigned.forEach((e) => {
        busyEmployees.set(`${e.id}::${targetDay}::${targetShift}`, wo.id);
        allocations.push({
          id: `alloc-${wo.id}-${e.id}`,
          workOrderId: wo.id,
          personId: e.id,
          personName: e.name,
          allocatedDate: `${year}-${String(month).padStart(2, '0')}-${String(targetDay).padStart(2, '0')}`,
          shift: targetShift,
          allocatedBy: 'supervisor',
          allocationStatus: 'confirmed',
        });
      });

      return {
        ...wo,
        plannedDay: targetDay,
        plannedShift: targetShift,
        resourceRequired: needed,
        assignedEmployeeIds: assignedIds,
        assignedEmployeeNames: assignedNames,
        allocationStatus: 'OK',
        conflictReason: undefined,
      };
    } else {
      const shortage = needed - availableStaff.length;
      const assignedIds = availableStaff.map((e) => e.id);
      const assignedNames = availableStaff.map((e) => e.name);

      availableStaff.forEach((e) => {
        busyEmployees.set(`${e.id}::${targetDay}::${targetShift}`, wo.id);
      });

      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(targetDay).padStart(2, '0')}`;
      conflicts.push({
        woId: wo.workOrderId,
        description: wo.description,
        line: targetLineCode,
        date: dateStr,
        shift: targetShift === 'M' ? 'Morning' : targetShift === 'E' ? 'Evening' : 'Night',
        needed,
        available: availableStaff.length,
        shortage,
        reason: `${targetLineCode} ${targetShift === 'M' ? 'Morning' : targetShift === 'E' ? 'Evening' : 'Night'} short by ${shortage} person(s)`,
      });

      return {
        ...wo,
        plannedDay: targetDay,
        plannedShift: targetShift,
        resourceRequired: needed,
        assignedEmployeeIds: assignedIds,
        assignedEmployeeNames: assignedNames,
        allocationStatus: 'SHORT',
        conflictReason: `Need ${needed}, only ${availableStaff.length} available (short ${shortage})`,
      };
    }
  });

  // Calculate Shift Balance KPI Summary (e.g. Morning: 5 Available | 2 PM + 2 CM = 4 | Buffer: +1)
  const shiftBalances: ShiftWorkloadBalance[] = (['M', 'E', 'N'] as const).map((sCode) => {
    const shiftLabel = sCode === 'M' ? 'Morning' : sCode === 'E' ? 'Evening' : 'Night';

    // Average or sample working headcount on this shift
    let totalWorking = 0;
    if (roster) {
      for (let d = 1; d <= 28; d++) {
        totalWorking += getWorkingStaff(d, sCode).length;
      }
    }
    const avgStaff = Math.max(1, Math.round(totalWorking / 28)) || (sCode === 'N' ? 4 : 5);

    // Sum demands for this shift
    let pmCount = 0;
    let cmCount = 0;
    let acsCount = 0;

    updatedWorkOrders.forEach((wo) => {
      if (wo.plannedShift === sCode) {
        if (wo.workType === 'PM') pmCount += wo.resourceRequired;
        else if (wo.workType === 'CM') cmCount += wo.resourceRequired;
        else acsCount += wo.resourceRequired;
      }
    });

    // Average daily demand
    const dailyPm = Math.min(avgStaff, Math.max(1, Math.round(pmCount / 10)));
    const dailyCm = Math.min(avgStaff - dailyPm, Math.max(1, Math.round(cmCount / 10))) || 1;
    const dailyAcs = Math.round(acsCount / 15);
    const totalAllocated = dailyPm + dailyCm + dailyAcs;
    const buffer = avgStaff - totalAllocated;

    return {
      line: targetLineCode,
      shift: sCode,
      shiftLabel,
      availableStaff: avgStaff,
      pmRequired: dailyPm,
      cmReserve: dailyCm,
      acsRequired: dailyAcs,
      totalAllocated,
      buffer,
      status: buffer < 0 ? 'short' : buffer === 0 ? 'tight' : 'ok',
    };
  });

  const allocatedCount = updatedWorkOrders.filter((wo) => wo.allocationStatus === 'OK').length;
  const shortCount = updatedWorkOrders.filter((wo) => wo.allocationStatus === 'SHORT').length;

  return {
    updatedWorkOrders,
    allocations,
    shiftBalances,
    conflicts,
    totalWorkOrders: lineWorkOrders.length,
    allocatedCount,
    shortCount,
  };
}

