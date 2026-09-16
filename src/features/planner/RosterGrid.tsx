import { motion } from 'framer-motion';
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

interface Props {
  /** The shift code being painted, or null for select-mode. */
  brush: string | null;
  /** Bumped by the Generate action to replay the reveal animation. */
  revealKey: number;
}

export function RosterGrid({ brush, revealKey }: Props) {
  const {
    roster, employees, codes, columns, days, issues, settings, paintCell, paintRange,
  } = useStore();

  const [focus, setFocus] = useState<Focus | null>(null);
  const [picker, setPicker] = useState<{ focus: Focus; x: number; y: number } | null>(null);
  const drag = useRef<{ employeeId: string; from: number; to: number } | null>(null);
  const [dragPreview, setDragPreview] = useState<{ employeeId: string; from: number; to: number } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const codeById = useMemo(() => new Map(codes.map((c) => [c.id, c])), [codes]);
  const today = todayIndex(settings.activeYear, settings.activeMonth);

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
    <>
      <div ref={scrollRef} className="flex-1 overflow-auto">
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
                    </motion.button>
                  );
                })}
              </div>
            );
          })}

          {/* ---------------------------------------------------- summary */}
          <SummaryRail
            // Only tally shifts that matter here: ones with a minimum to police,
            // or ones actually in use this month. Showing a row of dots for every
            // configured support code would just eat grid height.
            codes={codes.filter(
              (c) =>
                !c.isStatus &&
                (c.minHeadcount > 0 || days.some((d) => (d.total[c.id] ?? 0) > 0)),
            )}
            days={days}
            columns={columns}
            nameWidth={NAME_COL}
            cellWidth={CELL_W}
            revealKey={revealKey}
          />
        </div>
      </div>

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
    </>
  );
}

/**
 * The headcount rows at the foot of the grid.
 *
 * These are the client's own rows 27–32, except they recompute live instead of
 * being re-tallied by hand, and a cell below its minimum paints itself red.
 */
function SummaryRail({
  codes,
  days,
  columns,
  nameWidth,
  cellWidth,
  revealKey,
}: {
  codes: ShiftCode[];
  days: ReturnType<typeof import('@/domain/summary').summarise>;
  columns: ReturnType<typeof import('@/domain/calendar').buildColumns>;
  nameWidth: number;
  cellWidth: number;
  revealKey: number;
}) {
  return (
    <div className="sticky bottom-0 z-30 bg-[var(--surface)]/97 backdrop-blur border-t-2 border-[var(--line-strong)]">
      {codes.map((code) => {
        const tone = toneVars(code.tone);
        return (
          <div key={code.id} className="flex border-b border-[var(--line)] last:border-b-0">
            <div
              className="sticky left-0 z-10 flex items-center gap-2 px-3 bg-[var(--surface)] border-r border-[var(--line-strong)]"
              style={{ width: nameWidth, minWidth: nameWidth, height: 26 }}
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
  );
}
