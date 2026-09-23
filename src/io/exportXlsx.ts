import XLSX from 'xlsx-js-style';

import { EXPORT_COLORS } from '@/app/tones';
import { MONTH_ABBR, buildColumns, daysInMonth } from '@/domain/calendar';
import { OFF, type Employee, type Line, type RosterMonth, type ShiftCode } from '@/domain/types';

type Cell = XLSX.CellObject & { s?: Record<string, unknown> };

const THIN = { style: 'thin', color: { rgb: 'FFBFC5D0' } };
const BORDER = { top: THIN, bottom: THIN, left: THIN, right: THIN };

/** Spreadsheet column letters: 0 → A, 26 → AA. */
function colLetter(index: number): string {
  let s = '';
  let n = index;
  while (n >= 0) {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  }
  return s;
}

export interface ExportInput {
  roster: RosterMonth;
  employees: Employee[];
  codes: ShiftCode[];
  line: Line;
}

/**
 * Writes a workbook in the client's own layout.
 *
 * He still has to email and print this for management, so the export mirrors
 * his sheet rather than inventing a new one: merged title, legend block, day
 * and weekday header rows, colour-filled codes, and the headcount rows as live
 * COUNTIF formulas so the file keeps recalculating in Excel.
 *
 * One deliberate difference: his current file carries tens of thousands of
 * duplicated conditional-formatting rules, which is why it opens slowly. This
 * writes static fills instead, so the output is a fraction of the size.
 */
export function buildWorkbook({ roster, employees, codes, line }: ExportInput): XLSX.WorkBook {
  const { year, month } = roster;
  const nDays = daysInMonth(year, month);
  const columns = buildColumns(year, month);
  const codeById = new Map(codes.map((c) => [c.id, c]));

  const FIRST_DATA_COL = 2; // column C
  const HEADER_ROWS = 3;
  const firstEmpRow = HEADER_ROWS; // 0-based row index of the first employee
  const lastEmpRow = firstEmpRow + employees.length - 1;

  const cells: Record<string, Cell> = {};
  const put = (r: number, c: number, cell: Cell) => {
    cells[XLSX.utils.encode_cell({ r, c })] = cell;
  };

  // ---- row 1: title + legend -------------------------------------------
  put(0, 0, {
    t: 's',
    v: `${line.name}_${MONTH_ABBR[month - 1]}-${year} Roster`,
    s: {
      font: { bold: true, sz: 16, color: { rgb: 'FF1B2333' } },
      alignment: { horizontal: 'center', vertical: 'center' },
      fill: { patternType: 'solid', fgColor: { rgb: 'FFE8ECF4' } },
    },
  });

  const legend = codes
    .filter((c) => !c.isStatus)
    .map((c) => `${c.id} — ${c.label}: ${c.timing}`)
    .join('\n');
  put(0, FIRST_DATA_COL + nDays + 1, {
    t: 's',
    v: `SHIFT TIMINGS\n\n${legend}`,
    s: {
      font: { sz: 10, color: { rgb: 'FF44506B' } },
      alignment: { vertical: 'top', wrapText: true },
      border: BORDER,
    },
  });

  // ---- row 2: weekday labels -------------------------------------------
  put(1, 0, {
    t: 's',
    v: 'Days=>',
    s: {
      font: { bold: true, sz: 10 },
      alignment: { horizontal: 'center' },
      fill: { patternType: 'solid', fgColor: { rgb: 'FFE8ECF4' } },
      border: BORDER,
    },
  });
  for (const col of columns) {
    put(1, FIRST_DATA_COL + col.index, {
      t: 's',
      v: col.label,
      s: {
        font: { bold: true, sz: 9, color: { rgb: 'FF44506B' } },
        alignment: { horizontal: 'center' },
        fill: {
          patternType: 'solid',
          fgColor: { rgb: col.isWeekend ? 'FFDDE2EC' : 'FFF0F2F7' },
        },
        border: BORDER,
      },
    });
  }

  // ---- row 3: Name | Contact | day numbers ------------------------------
  const headStyle = {
    font: { bold: true, sz: 10, color: { rgb: 'FF1B2333' } },
    alignment: { horizontal: 'center' },
    fill: { patternType: 'solid', fgColor: { rgb: 'FFE8ECF4' } },
    border: BORDER,
  };
  put(2, 0, { t: 's', v: 'Name', s: { ...headStyle, alignment: { horizontal: 'left' } } });
  put(2, 1, { t: 's', v: 'Contact #', s: headStyle });
  for (const col of columns) {
    put(2, FIRST_DATA_COL + col.index, { t: 'n', v: col.day, s: headStyle });
  }

  // ---- employee rows ----------------------------------------------------
  employees.forEach((employee, i) => {
    const r = firstEmpRow + i;
    put(r, 0, {
      t: 's',
      v: employee.name,
      s: { font: { sz: 10, bold: true }, alignment: { horizontal: 'left' }, border: BORDER },
    });
    put(r, 1, {
      t: 's',
      v: employee.contact,
      s: { font: { sz: 9, color: { rgb: 'FF5A6376' } }, alignment: { horizontal: 'center' }, border: BORDER },
    });

    const row = roster.cells[employee.id] ?? [];
    for (const col of columns) {
      const code = row[col.index]?.code ?? OFF;
      const def = codeById.get(code);
      const palette = EXPORT_COLORS[def?.tone ?? 'off'];

      put(r, FIRST_DATA_COL + col.index, {
        t: 's',
        v: code === OFF ? '-' : code,
        s: {
          font: { bold: true, sz: 10, color: { rgb: palette.font } },
          alignment: { horizontal: 'center', vertical: 'center' },
          fill: { patternType: 'solid', fgColor: { rgb: palette.fill } },
          border: BORDER,
        },
      });
    }
  });

  // ---- weekday repeat row ----------------------------------------------
  const repeatRow = lastEmpRow + 1;
  for (const col of columns) {
    put(repeatRow, FIRST_DATA_COL + col.index, {
      t: 's',
      v: col.label,
      s: {
        font: { bold: true, sz: 9, color: { rgb: 'FF44506B' } },
        alignment: { horizontal: 'center' },
        fill: { patternType: 'solid', fgColor: { rgb: col.isWeekend ? 'FFDDE2EC' : 'FFF0F2F7' } },
        border: BORDER,
      },
    });
  }

  // ---- headcount rows, as live formulas --------------------------------
  const engineerCodes = codes.filter((c) => c.countsAsEngineer && !c.isStatus);
  const summaryRows: { label: string; formula: (col: string) => string }[] = [];

  for (const code of engineerCodes.filter((c) => c.rotates)) {
    summaryRows.push({
      label: `Engineers Count ${code.label}`,
      formula: (col) => `COUNTIF(${col}$${firstEmpRow + 1}:${col}$${lastEmpRow + 1},"${code.id}")`,
    });
  }
  for (const code of engineerCodes.filter((c) => c.rotates)) {
    // Total headcount adds the support categories sharing this shift's tone,
    // mirroring the client's own =COUNTIF(M)+COUNTIF(MT)+COUNTIF(ML).
    const family = codes.filter((c) => c.tone === code.tone && !c.isStatus);
    summaryRows.push({
      label: `Total Head Counts ${code.label}`,
      formula: (col) =>
        family
          .map((c) => `COUNTIF(${col}$${firstEmpRow + 1}:${col}$${lastEmpRow + 1},"${c.id}")`)
          .join('+'),
    });
  }

  const labelStyle = {
    font: { bold: true, italic: true, sz: 10, color: { rgb: 'FF1B2333' } },
    fill: { patternType: 'solid', fgColor: { rgb: 'FFE8ECF4' } },
    border: BORDER,
  };

  summaryRows.forEach((spec, i) => {
    const r = repeatRow + 1 + i;
    put(r, 0, { t: 's', v: spec.label, s: labelStyle });
    put(r, 1, { t: 's', v: '', s: labelStyle });
    for (const col of columns) {
      const letter = colLetter(FIRST_DATA_COL + col.index);
      put(r, FIRST_DATA_COL + col.index, {
        t: 'n',
        f: spec.formula(letter),
        s: {
          font: { bold: true, sz: 10 },
          alignment: { horizontal: 'center' },
          fill: { patternType: 'solid', fgColor: { rgb: 'FFF5F7FA' } },
          border: BORDER,
        },
      });
    }
  });

  // A quiet credit line under the tables.
  put(repeatRow + summaryRows.length + 2, 0, {
    t: 's',
    v: `Generated by ShiftLine · ${new Date().toISOString().slice(0, 10)}`,
    s: { font: { sz: 8, italic: true, color: { rgb: 'FF8A93A6' } } },
  });

  const lastRow = repeatRow + summaryRows.length + 2;
  const lastCol = FIRST_DATA_COL + nDays + 1;

  const sheet: XLSX.WorkSheet = {
    ...cells,
    '!ref': XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: lastRow, c: lastCol } }),
    '!merges': [
      { s: { r: 0, c: 0 }, e: { r: 0, c: FIRST_DATA_COL + nDays - 1 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 1 } },
      { s: { r: 0, c: lastCol }, e: { r: Math.min(lastRow, 12), c: lastCol } },
      ...summaryRows.map((_, i) => ({
        s: { r: repeatRow + 1 + i, c: 0 },
        e: { r: repeatRow + 1 + i, c: 1 },
      })),
    ],
    '!cols': [
      { wch: 24 },
      { wch: 12 },
      ...columns.map(() => ({ wch: 4.2 })),
      { wch: 3 },
      { wch: 30 },
    ],
    '!rows': [{ hpt: 28 }, { hpt: 16 }, { hpt: 18 }],
    // Landscape, squeezed to one page wide — it goes on a wall.
    '!margins': { left: 0.25, right: 0.25, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 },
    '!pageSetup': { orientation: 'landscape', fitToWidth: 1, fitToHeight: 1, paperSize: 8 },
  };
  (sheet as Record<string, unknown>)['!sheetPr'] = { pageSetUpPr: { fitToPage: true } };

  (sheet as Record<string, unknown>)['!freeze'] = 'C4';

  const wb = XLSX.utils.book_new();
  const sheetName = `${line.prefix}_${line.name}_${MONTH_ABBR[month - 1]}_${year}`.slice(0, 31);
  XLSX.utils.book_append_sheet(wb, sheet, sheetName);
  return wb;
}

export function downloadXlsx(input: ExportInput): string {
  const wb = buildWorkbook(input);
  const filename = `${input.line.name.replace(/\s+/g, '_')}_Roster_${
    MONTH_ABBR[input.roster.month - 1]
  }_${input.roster.year}.xlsx`;

  // Build the bytes and hand them to the browser directly. `XLSX.writeFile`
  // reaches for Node's fs/stream first, which Vite shims with a warning.
  const bytes = XLSX.write(wb, { type: 'array', bookType: 'xlsx', cellStyles: true });
  const blob = new Blob([bytes], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return filename;
}

export interface BackupData {
  lines: Line[];
  employees: Employee[];
  codes: ShiftCode[];
  leave?: import('@/domain/types').LeaveBlock[];
  rosters?: RosterMonth[];
  settings?: unknown;
}

/**
 * Hidden sheet carrying the whole backup as JSON, so restoring an .xlsx is
 * exact. The visible sheets are for reading in Excel; they don't hold enough
 * (rosters, leave, colours, rotations) to rebuild the database from.
 */
export const BACKUP_SHEET = '_ShiftLine';
const BACKUP_MARK = 'ShiftLine backup v1 — do not edit';
/** Excel caps a cell at 32,767 characters. */
const CHUNK = 30000;

export function buildBackupWorkbook(data: BackupData, active?: ActiveRosterHint): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();

  // 1. If rosters exist, append formatted roster sheets
  if (data.rosters && data.rosters.length > 0 && data.lines.length > 0) {
    // Sort: active line+month first, then newest year/month, skip empty lines
    const sortedRosters = [...data.rosters].sort((a, b) => {
      const aIsActive =
        active &&
        a.lineId === active.activeLineId &&
        a.year === active.activeYear &&
        a.month === active.activeMonth;
      const bIsActive =
        active &&
        b.lineId === active.activeLineId &&
        b.year === active.activeYear &&
        b.month === active.activeMonth;
      if (aIsActive && !bIsActive) return -1;
      if (!aIsActive && bIsActive) return 1;
      // Otherwise: same line together, then newest first
      if (a.lineId === b.lineId) {
        if (a.year !== b.year) return b.year - a.year;
        return b.month - a.month;
      }
      // Active line's other months before other lines
      if (active) {
        if (a.lineId === active.activeLineId) return -1;
        if (b.lineId === active.activeLineId) return 1;
      }
      return a.lineId.localeCompare(b.lineId);
    });

    for (const r of sortedRosters) {
      const line = data.lines.find((l) => l.id === r.lineId) ?? data.lines[0];
      const emps = data.employees.filter((e) => e.lineId === r.lineId);
      // Skip rosters where no real employees exist for this line
      if (emps.length === 0) continue;
      const rosterWb = buildWorkbook({ roster: r, employees: emps, codes: data.codes, line });
      const firstSheetName = rosterWb.SheetNames[0];
      if (firstSheetName && rosterWb.Sheets[firstSheetName]) {
        XLSX.utils.book_append_sheet(wb, rosterWb.Sheets[firstSheetName], firstSheetName);
      }
    }
  }

  // 2. Employees sheet
  const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const empRows = data.employees.map((e) => ({
    'ID': e.id,
    'Name': e.name,
    'Contact #': e.contact,
    'Line': data.lines.find((l) => l.id === e.lineId)?.name ?? e.lineId,
    'Default Shift': e.defaultShift,
    'Rest Days': e.restDays.map((d) => WEEKDAY_NAMES[d] ?? d).join(', '),
    'Active': e.active !== false ? 'Yes' : 'No',
    'Pinned': e.pinned ? 'Yes' : 'No',
  }));
  if (empRows.length > 0) {
    const empSheet = XLSX.utils.json_to_sheet(empRows);
    XLSX.utils.book_append_sheet(wb, empSheet, 'Employees');
  }

  // 3. Shift Codes sheet
  const codeRows = data.codes.map((c) => ({
    'Code': c.id,
    'Shift Label': c.label,
    'Timing': c.timing,
    'Min Headcount': c.minHeadcount,
    'Counts As Engineer': c.countsAsEngineer ? 'Yes' : 'No',
    'Rotates': c.rotates ? 'Yes' : 'No',
    'Is Status / Leave': c.isStatus ? 'Yes' : 'No',
  }));
  if (codeRows.length > 0) {
    const codeSheet = XLSX.utils.json_to_sheet(codeRows);
    XLSX.utils.book_append_sheet(wb, codeSheet, 'Shift Codes');
  }

  // 4. Lines sheet
  const lineRows = data.lines.map((l) => ({
    'Line ID': l.id,
    'Line Name': l.name,
    'Prefix': l.prefix,
  }));
  if (lineRows.length > 0) {
    const lineSheet = XLSX.utils.json_to_sheet(lineRows);
    XLSX.utils.book_append_sheet(wb, lineSheet, 'Lines');
  }

  // 5. Leave blocks
  if (data.leave && data.leave.length > 0) {
    const leaveRows = data.leave.map((l) => ({
      'Employee': data.employees.find((e) => e.id === l.employeeId)?.name ?? l.employeeId,
      'From Date': l.from,
      'To Date': l.to,
      'Status Code': l.code,
      'Note': l.note ?? '',
    }));
    const leaveSheet = XLSX.utils.json_to_sheet(leaveRows);
    XLSX.utils.book_append_sheet(wb, leaveSheet, 'Leave');
  }

  // 6. Exact copy of everything, hidden, for restore
  const json = JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), ...data });
  const chunks: string[][] = [[BACKUP_MARK]];
  for (let i = 0; i < json.length; i += CHUNK) chunks.push([json.slice(i, i + CHUNK)]);
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(chunks), BACKUP_SHEET);
  wb.Workbook ??= {};
  wb.Workbook.Sheets ??= [];
  wb.Workbook.Sheets[wb.SheetNames.indexOf(BACKUP_SHEET)] = { Hidden: 1 };

  return wb;
}

export interface ActiveRosterHint {
  activeLineId: string;
  activeYear: number;
  activeMonth: number;
}

export function downloadBackupXlsx(data: BackupData, active?: ActiveRosterHint): string {
  const wb = buildBackupWorkbook(data, active);
  const filename = `ShiftLine_Backup_${new Date().toISOString().slice(0, 10)}.xlsx`;
  const bytes = XLSX.write(wb, { type: 'array', bookType: 'xlsx', cellStyles: true });
  const blob = new Blob([bytes], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return filename;
}

