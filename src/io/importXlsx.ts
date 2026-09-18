import XLSX from 'xlsx-js-style';

import { MONTH_ABBR, daysInMonth } from '@/domain/calendar';
import { inferDefaultShift, inferRestDays, inferRotations } from '@/domain/generator';
import { OFF, type Employee, type LeaveBlock, type Line, type RotationRule, type ShiftCode, type Weekday } from '@/domain/types';

export interface ImportedEmployee {
  name: string;
  contact: string;
  codes: string[];
  restDays: Weekday[];
  defaultShift: string;
  rotations: RotationRule[];
  leaveRanges: { from: number; to: number }[];
}

export interface ImportResult {
  sheetName: string;
  year: number;
  month: number;
  lineName: string | null;
  employees: ImportedEmployee[];
  /** Codes seen in the sheet that the app doesn't know about yet. */
  unknownCodes: string[];
  warnings: string[];
}

const KNOWN_WORKED = ['M', 'E', 'N', 'GS', 'P', 'MT', 'ET', 'NT', 'ML', 'EL', 'NL'];

/** Parses a title like "Line 5_SEP-2026 Roster" into its parts. */
function parseTitle(title: string): { lineName: string | null; year: number | null; month: number | null } {
  // Deliberately not `\b` before the month: underscore counts as a word
  // character, so `\b` never matches in "Line 5_SEP-2026" — the exact shape
  // the client's own sheets use. The month abbreviation is validated against
  // MONTH_ABBR below, which is what keeps this from over-matching.
  const monthMatch = title.match(/(?:^|[^A-Za-z])([A-Za-z]{3})[-_ ]?(\d{4})/);
  const lineMatch = title.match(/Line\s*(\d+)/i);
  const monthIndex = monthMatch ? MONTH_ABBR.indexOf(monthMatch[1].toUpperCase()) : -1;
  return {
    lineName: lineMatch ? `Line ${lineMatch[1]}` : null,
    year: monthMatch ? Number(monthMatch[2]) : null,
    month: monthIndex >= 0 ? monthIndex + 1 : null,
  };
}

export function listSheets(buffer: ArrayBuffer): string[] {
  return XLSX.read(buffer, { type: 'array', cellStyles: true }).SheetNames;
}

/**
 * Reads one of the client's roster sheets back into planner rules.
 *
 * His sheets carry no rest-day or rotation columns — that information only
 * exists as a visual pattern. So this works backwards from the grid: where
 * `-` (or a blank) falls reveals each person's rest-day pair, where the worked
 * code changes reveals their mid-month rotation, and a red fill over an empty
 * cell reveals a leave block.
 */
export function importSheet(buffer: ArrayBuffer, sheetName?: string): ImportResult {
  const wb = XLSX.read(buffer, { type: 'array', cellStyles: true });
  const name = sheetName ?? wb.SheetNames[0];
  const sheet = wb.Sheets[name];
  if (!sheet) throw new Error(`Sheet "${name}" not found in that workbook.`);

  const range = XLSX.utils.decode_range(sheet['!ref'] ?? 'A1');
  const warnings: string[] = [];

  const at = (r: number, c: number) => sheet[XLSX.utils.encode_cell({ r, c })] as XLSX.CellObject | undefined;
  const text = (r: number, c: number) => String(at(r, c)?.v ?? '').trim();

  // ---- locate the header row (the one whose first cell is "Name") -------
  let headerRow = -1;
  for (let r = range.s.r; r <= Math.min(range.e.r, 12); r++) {
    if (text(r, 0).toLowerCase() === 'name') {
      headerRow = r;
      break;
    }
  }
  if (headerRow === -1) {
    throw new Error('Could not find a "Name" header row — is this a roster sheet?');
  }

  // ---- month and year --------------------------------------------------
  const title = text(range.s.r, 0) || name;
  let { lineName, year, month } = parseTitle(title);
  if (!year || !month) {
    const fromName = parseTitle(name);
    year ??= fromName.year;
    month ??= fromName.month;
    lineName ??= fromName.lineName;
  }
  if (!year || !month) {
    throw new Error(
      `Could not work out the month from "${title}". Expected something like "Line 5_SEP-2026 Roster".`,
    );
  }

  // ---- day columns: numeric headers on the header row ------------------
  const dayCols: { day: number; col: number }[] = [];
  for (let c = range.s.c; c <= range.e.c; c++) {
    const v = at(headerRow, c)?.v;
    const n = typeof v === 'number' ? v : Number(v);
    if (Number.isInteger(n) && n >= 1 && n <= 31) dayCols.push({ day: n, col: c });
  }
  dayCols.sort((a, b) => a.day - b.day);

  const expected = daysInMonth(year, month);
  if (dayCols.length !== expected) {
    warnings.push(
      `Found ${dayCols.length} day columns but ${MONTH_ABBR[month - 1]} ${year} has ${expected} days.`,
    );
  }

  // ---- employee rows ---------------------------------------------------
  const employees: ImportedEmployee[] = [];
  const unknown = new Set<string>();

  for (let r = headerRow + 1; r <= range.e.r; r++) {
    const rowName = text(r, 0);
    if (!rowName) continue;
    // The weekday repeat row and the headcount rows end the employee block.
    if (/count|total|days=>/i.test(rowName)) break;

    const codes: string[] = [];
    const leaveDays: number[] = [];

    for (let i = 0; i < expected; i++) {
      const entry = dayCols[i];
      const cell = entry ? at(r, entry.col) : undefined;
      let code = String(cell?.v ?? '').trim();

      // A red fill marks a leave block; the cell itself is usually empty.
      const isRed = isRedFill(cell);

      if (code.toUpperCase().startsWith('FLRT')) code = 'FLRT';
      if (isRed && (code === '' || code === OFF)) {
        code = 'LV';
        leaveDays.push(i + 1);
      }
      if (code === '') code = OFF;

      codes.push(code);
      if (code !== OFF && code !== 'LV' && code !== 'FLRT' && !KNOWN_WORKED.includes(code)) {
        unknown.add(code);
      }
    }

    // A whole-month merged status cell only stores a value in its first column.
    if (codes[0] === 'FLRT' && codes.slice(1).every((c) => c === OFF)) {
      codes.fill('FLRT');
    }

    const workedSet = new Set(KNOWN_WORKED);
    const restDays = inferRestDays(codes, year, month);
    const defaultShift = inferDefaultShift(codes, workedSet, 'GS');
    const rotations = inferRotations(codes, workedSet);

    employees.push({
      name: rowName,
      contact: text(r, 1),
      codes,
      restDays,
      defaultShift,
      rotations,
      leaveRanges: toRanges(codes),
    });
  }

  if (employees.length === 0) warnings.push('No employee rows were found under the header.');

  return {
    sheetName: name,
    year,
    month,
    lineName,
    employees,
    unknownCodes: [...unknown],
    warnings,
  };
}

/**
 * True when a cell carries a solid red background.
 *
 * SheetJS puts the fill straight on `cell.s` (`s.fgColor`), not under an
 * `s.fill` object, and reports the colour as 6-digit RGB without the ARGB
 * alpha the raw XML uses — so both shapes are accepted here.
 */
function isRedFill(cell: XLSX.CellObject | undefined): boolean {
  const s = (cell as { s?: Record<string, unknown> } | undefined)?.s;
  if (!s) return false;
  const fg =
    (s.fgColor as { rgb?: string } | undefined)?.rgb ??
    ((s.fill as { fgColor?: { rgb?: string } } | undefined)?.fgColor?.rgb);
  if (typeof fg !== 'string') return false;
  const rgb = fg.length === 8 ? fg.slice(2) : fg;
  const r = parseInt(rgb.slice(0, 2), 16);
  const g = parseInt(rgb.slice(2, 4), 16);
  const b = parseInt(rgb.slice(4, 6), 16);
  return r >= 0xc0 && g <= 0x60 && b <= 0x60;
}

/** Collapses consecutive status days into inclusive day ranges. */
function toRanges(codes: string[]): { from: number; to: number }[] {
  const ranges: { from: number; to: number }[] = [];
  let start = -1;

  codes.forEach((code, i) => {
    const isLeave = code === 'LV' || code === 'FLRT';
    if (isLeave && start === -1) start = i + 1;
    if (!isLeave && start !== -1) {
      ranges.push({ from: start, to: i });
      start = -1;
    }
  });
  if (start !== -1) ranges.push({ from: start, to: codes.length });

  return ranges;
}

/** Turns a parsed sheet into rows ready for the database. */
export function toRecords(
  result: ImportResult,
  lineId: string,
  idFor: (name: string, index: number) => string,
): { employees: Employee[]; leave: LeaveBlock[] } {
  const key = `${result.year}-${String(result.month).padStart(2, '0')}`;
  const employees: Employee[] = [];
  const leave: LeaveBlock[] = [];

  result.employees.forEach((row, i) => {
    const id = idFor(row.name, i);
    employees.push({
      id,
      lineId,
      name: row.name,
      contact: row.contact,
      order: i + 1,
      defaultShift: row.defaultShift,
      restDays: row.restDays,
      rotations: row.rotations.length ? { [key]: row.rotations } : undefined,
      pinned: !['M', 'E', 'N'].includes(row.defaultShift),
      active: true,
    });

    row.leaveRanges.forEach((range, j) => {
      const code = row.codes[range.from - 1] === 'FLRT' ? 'FLRT' : 'LV';
      leave.push({
        id: `lv-${id}-${j}`,
        employeeId: id,
        from: `${key}-${String(range.from).padStart(2, '0')}`,
        to: `${key}-${String(range.to).padStart(2, '0')}`,
        code,
        note: 'Imported from Excel',
      });
    });
  });

  return { employees, leave };
}

/**
 * Restores data from an Excel workbook (.xlsx).
 * Handles both full backup workbooks (with Employees/Codes tabs) and single/multi-month roster workbooks.
 */
export function importBackupWorkbook(buffer: ArrayBuffer): {
  employees: Employee[];
  lines?: Line[];
  codes?: ShiftCode[];
  leave?: LeaveBlock[];
} {
  const wb = XLSX.read(buffer, { type: 'array', cellStyles: true });
  const sheetNames = wb.SheetNames;

  // Case 1: Workbook contains an 'Employees' sheet (Full ShiftLine backup)
  if (sheetNames.includes('Employees')) {
    const empSheet = wb.Sheets['Employees'];
    const empRows: any[] = XLSX.utils.sheet_to_json(empSheet);
    const DAY_MAP: Record<string, Weekday> = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };

    const employees: Employee[] = empRows.map((r, i) => {
      const restText = String(r['Rest Days'] ?? '').toLowerCase();
      const restDays: Weekday[] = restText
        .split(',')
        .map((s) => s.trim().slice(0, 3))
        .filter((s) => s in DAY_MAP)
        .map((s) => DAY_MAP[s]);

      return {
        id: String(r['ID'] ?? `e${i + 1}`),
        name: String(r['Name'] ?? 'Employee'),
        contact: String(r['Contact #'] ?? r['Contact'] ?? ''),
        lineId: String(r['Line'] ?? 'line5').toLowerCase().replace(/\s+/g, ''),
        defaultShift: String(r['Default Shift'] ?? 'M'),
        restDays: restDays.length ? restDays : [5, 6],
        order: i + 1,
        active: String(r['Active'] ?? 'yes').toLowerCase() !== 'no',
        pinned: String(r['Pinned'] ?? 'no').toLowerCase() === 'yes',
      };
    });

    const lines: Line[] = sheetNames.includes('Lines')
      ? (XLSX.utils.sheet_to_json(wb.Sheets['Lines']) as any[]).map((r, i) => ({
          id: String(r['Line ID'] ?? `line${i + 1}`),
          name: String(r['Line Name'] ?? `Line ${i + 1}`),
          prefix: String(r['Prefix'] ?? 'SLV'),
          order: i + 1,
        }))
      : [];

    const codes: ShiftCode[] = sheetNames.includes('Shift Codes')
      ? (XLSX.utils.sheet_to_json(wb.Sheets['Shift Codes']) as any[]).map((r, i) => ({
          id: String(r['Code'] ?? `C${i}`),
          label: String(r['Shift Label'] ?? r['Label'] ?? r['Code']),
          timing: String(r['Timing'] ?? '08:00 – 17:00'),
          minHeadcount: Number(r['Min Headcount'] ?? 0),
          countsAsEngineer: String(r['Counts As Engineer'] ?? 'yes').toLowerCase() === 'yes',
          rotates: String(r['Rotates'] ?? 'no').toLowerCase() === 'yes',
          isStatus: String(r['Is Status / Leave'] ?? 'no').toLowerCase() === 'yes',
          tone: 'general' as const,
          order: i + 1,
        }))
      : [];

    return {
      employees,
      lines: lines.length ? lines : undefined,
      codes: codes.length ? codes : undefined,
    };
  }

  // Case 2: Standard roster workbook — parse first valid roster sheet
  const firstSheet = importSheet(buffer);
  return toRecords(firstSheet, 'line5', (_n, i) => `e${String(i + 1).padStart(2, '0')}`);
}
