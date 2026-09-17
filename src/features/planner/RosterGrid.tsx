import { AnimatePresence, motion } from 'framer-motion';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useStore } from '@/app/store';
import { toneVars } from '@/app/tones';
import { cx } from '@/components/ui';
import { todayIndex } from '@/domain/calendar';
import { OFF, type Issue, type ShiftCode } from '@/domain/types';

import { CellPicker } from './CellPicker';

const NAME_COL = 228;
const CELL_W = 38;
const CELL_H = 30;

export interface Focus {
  employeeId: string;
  dayIndex: number;
}

export interface JumpTarget {
  employeeId?: string;
  dayIndex?: number;
  /** Changes on every request so the same target can be jumped to twice. */
  nonce: number;
}

interface Props {
  /** The shift code being painted, or null for select-mode. */
  brush: string | null;
  /** Bumped by the Generate action to replay the reveal animation. */
  revealKey: number;
  /** Set by the Insights panel: scroll to and highlight this cell or day. */
  jumpTo: JumpTarget | null;
}

export function RosterGrid({ brush, revealKey, jumpTo }: Props) {
  const {
    roster, employees, codes, columns, days, issues, settings, paintCell, paintRange,
  } = useStore();

  const [focus, setFocus] = useState<Focus | null>(null);
  const [picker, setPicker] = useState<{ focus: Focus; x: number; y: number } | null>(null);
  const drag = useRef<{ employeeId: string; from: number; to: number } | null>(null);
  const [dragPreview, setDragPreview] = useState<{ employeeId: string; from: number; to: number } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollLeft, setScrollLeft] = useState(0);
  const onScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollLeft(e.currentTarget.scrollLeft);
  }, []);

  const codeById = useMemo(() => new Map(codes.map((c) => [c.id, c])), [codes]);
  const today = todayIndex(settings.activeYear, settings.activeMonth);

  // ---- jump from Insights -------------------------------------------------
  // Scrolls the requested day into the middle of the view, focuses the cell if
  // a person was named, and flashes the whole column so the eye lands on it.
  const [flashDay, setFlashDay] = useState<number | null>(null);
  useEffect(() => {
    if (!jumpTo || jumpTo.dayIndex === undefined) return;
    const el = scrollRef.current;
    if (el) {
      const x = NAME_COL + jumpTo.dayIndex * CELL_W - (el.clientWidth - NAME_COL) / 2 + CELL_W / 2;
      el.scrollTo({ left: Math.max(0, x), behavior: 'smooth' });
      if (jumpTo.employeeId) {
        const rowIdx = employees.findIndex((e) => e.id === jumpTo.employeeId);
        if (rowIdx >= 0) {
          const y = 46 + rowIdx * CELL_H - el.clientHeight / 2;
          el.scrollTo({ top: Math.max(0, y), left: Math.max(0, x), behavior: 'smooth' });
        }
      }
    }
    if (jumpTo.employeeId) setFocus({ employeeId: jumpTo.employeeId, dayIndex: jumpTo.dayIndex });
    setFlashDay(jumpTo.dayIndex);
    const t = setTimeout(() => setFlashDay(null), 1600);
    return () => clearTimeout(t);
  }, [jumpTo, employees]);

  /** Cell-level issue lookup, so a cell can paint its own warning ring. */
  const issueMap = useMemo(() => {
    const map = new Map<string, Issue>();
    for (const issue of issues) {
      if (!issue.employeeId || issue.dayIndex === undefined) continue;
      const key = `${issue.employeeId}:${issue.dayIndex}`;
      // An error outranks a warning on the same cell.
      if (!map.has(key) || issue.severity === 'error') map.set(key, issue);
    }
    return map;
  }, [issues]);

  /** Day columns that are short-staffed, for the header + summary tint. */
  const shortDays = useMemo(() => {
    const map = new Map<number, 'error' | 'warning'>();
    for (const issue of issues) {
      if (issue.employeeId || issue.dayIndex === undefined) continue;
      if (issue.severity === 'error') map.set(issue.dayIndex, 'error');
      else if (!map.has(issue.dayIndex)) map.set(issue.dayIndex, 'warning');
    }
    return map;
  }, [issues]);

  // ---- painting ---------------------------------------------------------
  const endDrag = useCallback(() => {
    const d = drag.current;
    drag.current = null;
    setDragPreview(null);
    if (!d || !brush) return;
    if (d.from === d.to) paintCell(d.employeeId, d.from, brush);
    else paintRange(d.employeeId, d.from, d.to, brush);
  }, [brush, paintCell, paintRange]);

  useEffect(() => {
    window.addEventListener('mouseup', endDrag);
    return () => window.removeEventListener('mouseup', endDrag);
  }, [endDrag]);

  const onCellDown = (employeeId: string, dayIndex: number, e: React.MouseEvent) => {
    setFocus({ employeeId, dayIndex });
    if (brush) {
      drag.current = { employeeId, from: dayIndex, to: dayIndex };
      setDragPreview({ employeeId, from: dayIndex, to: dayIndex });
    } else {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      setPicker({ focus: { employeeId, dayIndex }, x: rect.left + rect.width / 2, y: rect.bottom + 6 });
    }
  };

  const onCellEnter = (employeeId: string, dayIndex: number) => {
    if (!drag.current || drag.current.employeeId !== employeeId) return;
    drag.current.to = dayIndex;
    setDragPreview({ ...drag.current });
  };

  // ---- keyboard ---------------------------------------------------------
  useEffect(() => {
    if (!focus || !roster) return;

    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.isContentEditable) return;

      const rowIds = employees.map((emp) => emp.id);
      const r = rowIds.indexOf(focus.employeeId);
      const lastDay = columns.length - 1;

      const move = (dr: number, dc: number) => {
        e.preventDefault();
        const nr = Math.max(0, Math.min(rowIds.length - 1, r + dr));
        const nc = Math.max(0, Math.min(lastDay, focus.dayIndex + dc));
        setFocus({ employeeId: rowIds[nr], dayIndex: nc });
      };

      switch (e.key) {
        case 'ArrowUp': return move(-1, 0);
        case 'ArrowDown': return move(1, 0);
        case 'ArrowLeft': return move(0, -1);
        case 'ArrowRight': return move(0, 1);
        case 'Escape': return setFocus(null);
      }

      // Typing a shift's first letter writes it straight into the focused cell —
      // the fastest path for someone rostering a whole row by hand.
      if (e.key === '-' || e.key === '0') {
        e.preventDefault();
        paintCell(focus.employeeId, focus.dayIndex, OFF);
        return;
      }

      const typed = e.key.toUpperCase();
      const match =
        codes.find((c) => c.id === typed) ??
        codes.find((c) => c.id[0] === typed && !c.isStatus);
      if (match) {
        e.preventDefault();
        paintCell(focus.employeeId, focus.dayIndex, match.id);
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [focus, roster, employees, columns.length, codes, paintCell]);

  if (!roster) {
    return (
      <div className="flex-1 grid place-items-center text-ink-3 text-[13px]">Building roster…</div>
    );
  }

  const gridWidth = NAME_COL + columns.length * CELL_W;

  return (
    <div className="flex flex-1 min-h-0 flex-col">
      <div ref={scrollRef} onScroll={onScroll} className="flex-1 overflow-auto">
        <div style={{ width: gridWidth, minWidth: '100%' }} className="relative">
          {/* ---------------------------------------------------- header */}
          <div
            className="sticky top-0 z-30 flex bg-[var(--canvas)]/95 backdrop-blur border-b border-[var(--line-strong)]"
            style={{ height: 46 }}
          >
            <div
              className="sticky left-0 z-10 flex items-end px-3 pb-1.5 bg-[var(--canvas)] border-r border-[var(--line-strong)]"
              style={{ width: NAME_COL, minWidth: NAME_COL }}
            >
              <span className="text-[10.5px] font-semibold uppercase tracking-wider text-ink-3">
                {employees.length} people
              </span>
            </div>
            {columns.map((col) => {
              const short = shortDays.get(col.index);
              return (
                <div
                  key={col.day}
                  className={cx(
                    'flex flex-col items-center justify-end pb-1 border-r border-[var(--line)] relative',
                    col.isWeekend && 'bg-[var(--weekend-tint)]',
                  )}
                  style={{ width: CELL_W, minWidth: CELL_W }}
                >
                  <span
                    className={cx(
                      'text-[10px] uppercase tracking-wide',
                      col.isWeekend ? 'text-ink-3' : 'text-ink-3',
                    )}
                  >
                    {col.label}
                  </span>
                  <span
                    className={cx(
                      'font-mono text-[12.5px] leading-tight',
                      today === col.index ? 'text-[var(--accent)] font-bold' : 'text-ink-2',
                    )}
                  >
                    {col.day}
                  </span>
                  {short && (
                    <span
                      className="absolute bottom-0 left-1 right-1 h-[2px] rounded-full"
                      style={{ background: short === 'error' ? 'var(--danger)' : 'var(--warn)' }}
                    />
                  )}
                  {today === col.index && (
                    <span className="absolute inset-x-0 top-0 h-[2px] bg-[var(--accent)]" />
                  )}
                  {flashDay === col.index && (
                    <motion.span
                      initial={{ opacity: 0.9 }}
                      animate={{ opacity: 0 }}
                      transition={{ duration: 1.5, ease: 'easeOut' }}
                      className="pointer-events-none absolute inset-0 bg-[var(--accent)]/30"
                    />
                  )}
                </div>
              );
            })}
          </div>

          {/* ------------------------------------------------------- rows */}
          {employees.map((employee, rowIndex) => {
            const row = roster.cells[employee.id] ?? [];
            return (
              <div key={employee.id} className="flex border-b border-[var(--line)] group">
                <div
                  className="sticky left-0 z-20 flex items-center gap-2 px-3 bg-[var(--canvas)] group-hover:bg-[var(--surface)] border-r border-[var(--line-strong)] transition-colors"
                  style={{ width: NAME_COL, minWidth: NAME_COL, height: CELL_H }}
                >
                  <span
                    className="h-4 w-[3px] rounded-full shrink-0"
                    style={{ background: toneVars(codeById.get(employee.defaultShift)?.tone ?? 'off').accent }}
                  />
                  <span className="truncate text-[12.5px] font-medium">{employee.name}</span>
                  <span className="ml-auto font-mono text-[10.5px] text-ink-3 shrink-0">
                    {employee.contact}
                  </span>
                </div>

                {columns.map((col) => {
                  const cell = row[col.index];
                  const code = cell?.code ?? OFF;
                  const def = codeById.get(code);
                  const isOff = code === OFF;
                  const tone = toneVars(def?.tone ?? 'off');
                  const issue = issueMap.get(`${employee.id}:${col.index}`);
                  const focused = focus?.employeeId === employee.id && focus.dayIndex === col.index;
                  const inDrag =
                    dragPreview?.employeeId === employee.id &&
                    col.index >= Math.min(dragPreview.from, dragPreview.to) &&
                    col.index <= Math.max(dragPreview.from, dragPreview.to);

                  return (
                    <motion.button
                      key={col.day}
                      // Re-keying on generate replays the stagger, which is what
                      // makes the automation visible rather than instantaneous.
                      initial={{ opacity: 0, scale: 0.86 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{
                        duration: 0.16,
                        delay: Math.min(0.4, (rowIndex * 3 + col.index) * 0.0016),
                      }}
                      onMouseDown={(e) => onCellDown(employee.id, col.index, e)}
                      onMouseEnter={() => onCellEnter(employee.id, col.index)}
                      className={cx(
                        'relative flex items-center justify-center border-r border-[var(--line)]',
                        'font-mono text-[11.5px] font-bold tracking-tight transition-[filter,background] duration-100',
                        'hover:brightness-125 cursor-pointer',
                        def?.isStatus && 'hatch',
                        col.isWeekend && isOff && 'bg-[var(--weekend-tint)]',
                      )}
                      style={{
                        width: CELL_W,
                        minWidth: CELL_W,
                        height: CELL_H,
                        background: def?.isStatus ? undefined : tone.bg,
                        color: tone.fg,
                      }}
                      title={
                        issue
                          ? issue.message
                          : `${employee.name} · ${col.label} ${col.day} · ${def?.label ?? 'Off'}`
                      }
                    >
                      {isOff ? <span className="opacity-45">·</span> : code}

                      {/* a hand edit gets a corner tick so he can see what he changed */}
                      {cell?.source === 'manual' && (
                        <span className="absolute right-[2px] top-[2px] h-1 w-1 rounded-full bg-[var(--accent)]" />
                      )}

                      {issue && (
                        <span
                          className="pointer-events-none absolute inset-0 border"
                          style={{
                            borderColor: issue.severity === 'error' ? 'var(--danger)' : 'var(--warn)',
                          }}
                        />
                      )}

                      {(focused || inDrag) && (
                        <span
                          className="pointer-events-none absolute inset-0 border-2"
                          style={{ borderColor: 'var(--accent)' }}
                        />
                      )}
                      {flashDay === col.index && (
                        <motion.span
                          initial={{ opacity: 0.55 }}
                          animate={{ opacity: 0 }}
                          transition={{ duration: 1.5, ease: 'easeOut' }}
                          className="pointer-events-none absolute inset-0 bg-[var(--accent)]"
                        />
                      )}
                    </motion.button>
                  );
                })}
              </div>
            );
          })}

        </div>
      </div>

      {/* The headcount rail sits *below* the scroll area rather than sticky
          inside it, so it can never slide over an employee row. It keeps its
          columns lined up by mirroring the grid's horizontal scroll. */}
      <SummaryRail
        // Only tally shifts that matter here: ones with a minimum to police, or
        // ones actually in use this month.
        codes={codes.filter(
          (c) =>
            !c.isStatus &&
            (c.minHeadcount > 0 || days.some((d) => (d.total[c.id] ?? 0) > 0)),
        )}
        days={days}
        columns={columns}
        nameWidth={NAME_COL}
        cellWidth={CELL_W}
        gridWidth={gridWidth}
        revealKey={revealKey}
        scrollLeft={scrollLeft}
        issues={issues}
      />

      {picker && (
        <CellPicker
          x={picker.x}
          y={picker.y}
          current={roster.cells[picker.focus.employeeId]?.[picker.focus.dayIndex]?.code ?? OFF}
          onPick={(code) => {
            paintCell(picker.focus.employeeId, picker.focus.dayIndex, code);
            setPicker(null);
          }}
          onClose={() => setPicker(null)}
        />
      )}
    </div>
  );
}

const RAIL_KEY = 'shiftline.rail-open';

/**
 * The headcount rows at the foot of the grid.
 *
 * These are the client's own rows 27–32, except they recompute live instead of
 * being re-tallied by hand, and a cell below its minimum paints itself red.
 *
 * Collapsible: the bottom-left button opens and closes it like a shutter. When
 * closed, a one-line strip keeps the per-shift range and the error count in
 * view so the grid can take the full height without losing the signal.
 */
function SummaryRail({
  codes,
  days,
  columns,
  nameWidth,
  cellWidth,
  gridWidth,
  revealKey,
  scrollLeft,
  issues,
}: {
  codes: ShiftCode[];
  days: ReturnType<typeof import('@/domain/summary').summarise>;
  columns: ReturnType<typeof import('@/domain/calendar').buildColumns>;
  nameWidth: number;
  cellWidth: number;
  gridWidth: number;
  revealKey: number;
  scrollLeft: number;
  issues: Issue[];
}) {
  const [open, setOpen] = useState<boolean>(() => {
    try {
      return localStorage.getItem(RAIL_KEY) !== 'closed';
    } catch {
      return true;
    }
  });

  const toggle = () => {
    setOpen((v) => {
      try {
        localStorage.setItem(RAIL_KEY, v ? 'closed' : 'open');
      } catch {
        /* per-viewer convenience only */
      }
      return !v;
    });
  };

  const shortDays = issues.filter((i) => !i.employeeId && i.severity === 'error').length;

  return (
    <div className="shrink-0 border-t-2 border-[var(--line-strong)] bg-[var(--surface)]">
      {/* ---------------------------------------------------- toggle strip */}
      <div className="flex items-center h-8 border-b border-[var(--line)]">
        <button
          onClick={toggle}
          aria-expanded={open}
          className="flex h-full items-center gap-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-ink-2 hover:text-ink hover:bg-[var(--surface-2)] transition-colors border-r border-[var(--line-strong)]"
          style={{ width: nameWidth, minWidth: nameWidth }}
          title={open ? 'Hide headcount rows' : 'Show headcount rows'}
        >
          <span className="grid h-5 w-5 place-items-center rounded-md bg-[var(--surface-3)] text-ink-2">
            <BarsIcon />
          </span>
          Headcount
          <motion.span
            animate={{ rotate: open ? 0 : 180 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="text-ink-3"
          >
            <ChevronIcon />
          </motion.span>
          {shortDays > 0 && (
            <span className="ml-auto rounded-full bg-[var(--sh-leave-bg)] px-1.5 font-mono text-[10px] normal-case tracking-normal text-[var(--danger)]">
              {shortDays}
            </span>
          )}
        </button>

        {/* When shut, show each shift's range for the month so nothing is lost. */}
        {!open && (
          <div className="flex items-center gap-4 px-3 overflow-x-auto">
            {codes.map((code) => {
              const tone = toneVars(code.tone);
              const counts = days.map((d) => d.total[code.id] ?? 0);
              const lo = Math.min(...counts);
              const hi = Math.max(...counts);
              const short = code.minHeadcount > 0 && lo < code.minHeadcount;
              return (
                <span key={code.id} className="flex items-center gap-1.5 text-[11px] whitespace-nowrap">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: tone.accent }} />
                  <span className="text-ink-3">{code.label}</span>
                  <span
                    className="font-mono"
                    style={{ color: short ? 'var(--danger)' : 'var(--ink-2)', fontWeight: short ? 700 : 500 }}
                  >
                    {lo}–{hi}
                  </span>
                </span>
              );
            })}
          </div>
        )}
      </div>

      {/* ---------------------------------------------------- the shutter */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="rail"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 36, mass: 0.8 }}
            className="overflow-hidden"
          >
            <div className="overflow-hidden">
              <div style={{ width: gridWidth, transform: `translateX(-${scrollLeft}px)` }}>
                {codes.map((code) => {
                  const tone = toneVars(code.tone);
                  return (
                    <div key={code.id} className="flex border-b border-[var(--line)] last:border-b-0">
                      <div
                        className="sticky left-0 z-10 flex items-center gap-2 px-3 bg-[var(--surface)] border-r border-[var(--line-strong)]"
                        style={{ width: nameWidth, minWidth: nameWidth, height: 26, transform: `translateX(${scrollLeft}px)` }}
                      >
                        <span className="h-1.5 w-1.5 rounded-full" style={{ background: tone.accent }} />
                        <span className="text-[11px] font-medium text-ink-2">{code.label}</span>
                        {code.minHeadcount > 0 && (
                          <span className="ml-auto font-mono text-[10px] text-ink-3">min {code.minHeadcount}</span>
                        )}
                      </div>
                      {columns.map((col) => {
                        const n = days[col.index]?.total[code.id] ?? 0;
                        const short = code.minHeadcount > 0 && n < code.minHeadcount;
                        return (
                          <div
                            key={`${revealKey}-${col.day}`}
                            className={cx(
                              'flex items-center justify-center border-r border-[var(--line)] font-mono text-[11px]',
                              col.isWeekend && 'bg-[var(--weekend-tint)]',
                            )}
                            style={{
                              width: cellWidth,
                              minWidth: cellWidth,
                              height: 26,
                              background: short ? 'var(--sh-leave-bg)' : undefined,
                              color: short ? 'var(--danger)' : n === 0 ? 'var(--ink-3)' : 'var(--ink-2)',
                              fontWeight: short ? 700 : 500,
                            }}
                            title={short ? `${code.label}: ${n} of ${code.minHeadcount} required` : undefined}
                          >
                            {n || '·'}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function BarsIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <rect x="3" y="12" width="4" height="9" rx="1" />
      <rect x="10" y="6" width="4" height="15" rx="1" />
      <rect x="17" y="9" width="4" height="12" rx="1" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="m6 15 6-6 6 6" />
    </svg>
  );
}
