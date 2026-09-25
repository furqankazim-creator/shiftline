/**
 * Domain types for the roster planner.
 *
 * Nothing in `src/domain` imports React or touches the DOM — the scheduling
 * engine is plain data-in / data-out so it can be tested exhaustively against
 * the client's real September sheet.
 */

/** 0 = Sunday … 6 = Saturday (matches JS `Date.getDay`). */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

/** The literal written into a roster cell when somebody is not working. */
export const OFF = '-';

/**
 * A shift code is user-defined data, not a hard-coded union.
 *
 * The client's sheet uses more codes than its own legend shows: the
 * `Total Head Counts` formulas reference MT/ML/ET/EL/NT/NL alongside M/E/N,
 * and `FLRT` appears as a whole-month status. So the code set has to be
 * editable at runtime.
 */
export interface ShiftCode {
  /** The token written into the grid, e.g. "M", "E", "N", "GS", "P". */
  id: string;
  /** Human name, e.g. "Morning". */
  label: string;
  /** Free-text timing shown in the legend, e.g. "06:00 – 15:00". */
  timing: string;
  /** Palette key driving the cell colour. */
  tone: ShiftTone;
  /** Minimum people required on this shift every working day. */
  minHeadcount: number;
  /**
   * Counted in the "Engineers Count" rows. The client's sheet excludes
   * MT/ML-style codes from engineers but includes them in total headcount.
   */
  countsAsEngineer: boolean;
  /** Included in the fair auto-rotation pool (M/E/N yes; GS/P no). */
  rotates: boolean;
  /** A non-working status (leave, training) rather than a worked shift. */
  isStatus?: boolean;
  /**
   * Which roster this code belongs to, as a `RosterMonth.id`
   * (`${lineId}:${year}-${month}`).
   *
   * Undefined means a standard code available everywhere. Codes invented by
   * an Excel import are scoped to the month they came from, so a one-off code
   * on one sheet does not turn up on the brush of every other month.
   */
  scope?: string;
  order: number;
}

export type ShiftTone = 'morning' | 'evening' | 'night' | 'general' | 'project' | 'leave' | 'off';

/** A production line / team. Each owns its own people and rosters. */
export interface Line {
  id: string;
  name: string;
  /** Shown in exported sheet titles, e.g. "SLV" → "SLV_Line 5_Roster_SEP_2026". */
  prefix: string;
  order: number;
}

/**
 * A mid-month shift change, expressed as an inclusive day-of-month range.
 *
 * The client already rotates within a month — Abdul Saeed runs N for days
 * 1–12, E for 13–26, then M for 27–30 — so a person's shift is a schedule,
 * not a single value.
 */
export interface RotationRule {
  fromDay: number; // inclusive, 1-based
  toDay: number; // inclusive, 1-based
  code: string; // ShiftCode.id
}

/** A leave / vacation / training block, as an inclusive ISO date range. */
export interface LeaveBlock {
  id: string;
  employeeId: string;
  from: string; // "2026-09-20"
  to: string; // "2026-09-30"
  code: string; // ShiftCode.id of a status code, e.g. "LV" or "FLRT"
  note?: string;
}

export interface Employee {
  id: string;
  lineId: string;
  name: string;
  contact: string;
  /** Operational role, e.g. "PIC", "MP", "CM" — populated when importing an operational roster. */
  role?: string;
  /** Row order in the grid. The client groups his sheet by shift. */
  order: number;
  /** Shift used on any working day not covered by a rotation rule. */
  defaultShift: string;
  /**
   * The person's fixed weekly rest-day pair.
   *
   * This is the key that makes the whole month generatable: every employee in
   * the client's sheet works a strict 5-on / 2-off weekly cycle with a fixed
   * pair of rest weekdays.
   */
  restDays: Weekday[];
  /** Per-month mid-month shift changes, keyed "YYYY-MM". */
  rotations?: Record<string, RotationRule[]>;
  /** Excluded from auto-rotation (fixed GS/project staff). */
  pinned?: boolean;
  active?: boolean;
}

/** One resolved grid cell. */
export interface Cell {
  code: string; // ShiftCode.id, or OFF
  /** How this value was decided — drives the "locked" affordance in the UI. */
  source: 'manual' | 'leave' | 'rest' | 'rotation' | 'default';
}

/**
 * A generated month for one line.
 *
 * `cells[employeeId]` is an array with one entry per day of the month,
 * index 0 = the 1st.
 */
export interface RosterMonth {
  id: string; // `${lineId}:${year}-${month}`
  lineId: string;
  year: number;
  month: number; // 1-12
  cells: Record<string, Cell[]>;
  /** Hand edits, kept separate so regenerating never destroys them. */
  overrides: Record<string, Record<number, string>>; // empId -> dayIndex -> code
  updatedAt: number;
}

export type Severity = 'error' | 'warning';

export interface Issue {
  id: string;
  severity: Severity;
  rule: IssueRule;
  message: string;
  employeeId?: string;
  /** 0-based day index within the month. */
  dayIndex?: number;
  shiftCode?: string;
}

export type IssueRule =
  | 'below-minimum'
  | 'empty-shift'
  | 'night-to-morning'
  | 'too-many-consecutive'
  | 'rest-days-violated'
  | 'working-while-on-leave';

/** Per-day headcount totals — the client's sheet rows 27–32. */
export interface DaySummary {
  /** Working engineers per shift code. */
  engineers: Record<string, number>;
  /** All heads per shift code, engineers + support categories. */
  total: Record<string, number>;
  off: number;
  onLeave: number;
}
