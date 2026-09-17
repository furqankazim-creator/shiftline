import { AnimatePresence, motion } from 'framer-motion';
import { useMemo, useState } from 'react';

import { useStore } from '@/app/store';
import { useViewport } from '@/app/useViewport';
import { toneVars } from '@/app/tones';
import { Button, Segmented, cx } from '@/components/ui';
import { monthTotals } from '@/domain/summary';
import type { Issue } from '@/domain/types';
import { suggestCover } from '@/domain/validate';

type Tab = 'issues' | 'coverage' | 'fairness';

export function InsightsDrawer({
  open,
  onClose,
  onJump,
}: {
  open: boolean;
  onClose: () => void;
  onJump: (employeeId: string | undefined, dayIndex: number | undefined) => void;
}) {
  const [tab, setTab] = useState<Tab>('issues');
  const { issues } = useStore();
  const viewport = useViewport();
  const overlay = viewport !== 'desktop';

  const errors = issues.filter((i) => i.severity === 'error').length;

  const panel = (
    <div className={overlay ? 'w-full h-full flex flex-col' : 'w-[336px] h-full flex flex-col'}>
            <header className="flex items-center gap-2 px-4 h-14 border-b border-[var(--line)]">
              <h2 className="text-[13px] font-semibold">Insights</h2>
              {errors > 0 && (
                <span className="rounded-full bg-[var(--sh-leave-bg)] px-1.5 py-0.5 font-mono text-[10.5px] text-[var(--danger)]">
                  {errors}
                </span>
              )}
              <Button size="sm" onClick={onClose} className="ml-auto px-2">✕</Button>
            </header>

            <div className="px-4 py-3 border-b border-[var(--line)]">
              <Segmented<Tab>
                value={tab}
                onChange={setTab}
                options={[
                  { value: 'issues', label: 'Issues' },
                  { value: 'coverage', label: 'Coverage' },
                  { value: 'fairness', label: 'Fairness' },
                ]}
              />
            </div>

            <div className="flex-1 overflow-y-auto">
              {tab === 'issues' && <IssuesTab onJump={onJump} />}
              {tab === 'coverage' && <CoverageTab />}
              {tab === 'fairness' && <FairnessTab />}
            </div>
    </div>
  );

  // Small screens: slide over the grid with a scrim instead of pushing it.
  if (overlay) {
    return (
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
              className="no-print fixed inset-0 z-40 bg-black/50"
            />
            <motion.aside
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', stiffness: 380, damping: 38 }}
              className="no-print fixed inset-y-0 right-0 z-50 w-full max-w-[400px] border-l border-[var(--line)] bg-[var(--surface)] shadow-pop"
              style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
            >
              {panel}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    );
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.aside
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: 336, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 380, damping: 36 }}
          className="no-print shrink-0 overflow-hidden border-l border-[var(--line)] bg-[var(--surface)]"
        >
          {panel}
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

/* ------------------------------------------------------------------ Issues */

function IssuesTab({ onJump }: { onJump: (e: string | undefined, d: number | undefined) => void }) {
  const { issues, roster, employees, codes, leave, paintCell } = useStore();
  const [expanded, setExpanded] = useState<string | null>(null);

  const grouped = useMemo(() => {
    const errors = issues.filter((i) => i.severity === 'error');
    const warnings = issues.filter((i) => i.severity === 'warning');
    return { errors, warnings };
  }, [issues]);

  if (issues.length === 0) {
    return (
      <div className="p-6 text-center">
        <div className="mx-auto mb-3 grid h-10 w-10 place-items-center rounded-full bg-[var(--sh-gs-bg)] text-[var(--ok)]">
          ✓
        </div>
        <p className="text-[13px] font-medium">No problems found</p>
        <p className="mt-1 text-[12px] text-ink-3 leading-relaxed">
          Every shift meets its minimum, rest days are honoured and nobody is double-booked.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <p className="px-4 py-2.5 text-[11.5px] leading-snug text-ink-3 border-b border-[var(--line)]">
        Checked on every edit. Click an item to jump to that day on the grid.
      </p>
      {(['errors', 'warnings'] as const).map((key) => {
        const list = grouped[key];
        if (list.length === 0) return null;
        return (
          <section key={key}>
            <div className="sticky top-0 z-10 flex items-center gap-2 bg-[var(--surface)] px-4 py-2 border-b border-[var(--line)]">
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: key === 'errors' ? 'var(--danger)' : 'var(--warn)' }}
              />
              <span className="text-[10.5px] font-semibold uppercase tracking-wider text-ink-3">
                {key === 'errors' ? 'Must fix' : 'Worth a look'} · {list.length}
              </span>
            </div>

            {list.map((issue) => {
              const canSuggest =
                issue.rule === 'below-minimum' || issue.rule === 'empty-shift';
              const isOpen = expanded === issue.id;
              const suggestions =
                canSuggest && isOpen && roster && issue.dayIndex !== undefined && issue.shiftCode
                  ? suggestCover(roster, employees, codes, issue.dayIndex, issue.shiftCode, leave)
                  : [];

              return (
                <div key={issue.id} className="border-b border-[var(--line)]">
                  <button
                    onClick={() => {
                      onJump(issue.employeeId, issue.dayIndex);
                      setExpanded(isOpen ? null : issue.id);
                    }}
                    className="w-full px-4 py-2.5 text-left hover:bg-[var(--surface-2)] transition-colors"
                  >
                    <p className="text-[12.5px] leading-snug">{issue.message}</p>
                    {canSuggest && (
                      <span className="mt-1 inline-block text-[11px] text-[var(--accent)]">
                        {isOpen ? 'Hide suggestions' : 'Show who can cover →'}
                      </span>
                    )}
                  </button>

                  {isOpen && suggestions.length > 0 && (
                    <div className="px-4 pb-3 flex flex-col gap-1">
                      <p className="text-[11px] text-ink-3 mb-0.5">
                        Off that day, not on leave, lightest month first:
                      </p>
                      {suggestions.map((emp) => (
                        <button
                          key={emp.id}
                          onClick={() => {
                            if (issue.dayIndex === undefined || !issue.shiftCode) return;
                            paintCell(emp.id, issue.dayIndex, issue.shiftCode);
                            setExpanded(null);
                          }}
                          className="flex items-center justify-between rounded-md bg-[var(--surface-2)] px-2.5 py-1.5 text-[12px] hover:bg-[var(--surface-3)] transition-colors"
                        >
                          <span className="truncate">{emp.name}</span>
                          <span className="text-[11px] text-[var(--accent)] shrink-0 ml-2">
                            Assign {issue.shiftCode}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}

                  {isOpen && canSuggest && suggestions.length === 0 && (
                    <p className="px-4 pb-3 text-[11.5px] text-ink-3">
                      Nobody is free that day — this needs a leave change or extra headcount.
                    </p>
                  )}
                </div>
              );
            })}
          </section>
        );
      })}
    </div>
  );
}

/* ---------------------------------------------------------------- Coverage */

function CoverageTab() {
  const { days, codes, columns } = useStore();
  const totals = useMemo(() => monthTotals(days), [days]);
  const worked = codes.filter((c) => !c.isStatus);

  return (
    <div className="p-4 flex flex-col gap-4">
      <p className="text-[11.5px] leading-snug text-ink-3">
        People on each shift, day by day. A red bar is a day below that shift's minimum.
      </p>
      <div className="grid grid-cols-2 gap-2">
        <MiniStat label="Shift days" value={Object.values(totals.shiftDays).reduce((a, b) => a + b, 0)} />
        <MiniStat label="Rest days" value={totals.offDays} />
        <MiniStat label="On leave" value={totals.leaveDays} />
        <MiniStat label="Days in month" value={columns.length} />
      </div>

      {worked.map((code) => {
        const tone = toneVars(code.tone);
        const counts = days.map((d) => d.total[code.id] ?? 0);
        const peak = Math.max(1, ...counts);
        const min = Math.min(...counts);
        const avg = counts.reduce((a, b) => a + b, 0) / (counts.length || 1);

        return (
          <div key={code.id}>
            <div className="mb-1.5 flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: tone.accent }} />
              <span className="text-[12px] font-medium">{code.label}</span>
              <span className="ml-auto font-mono text-[11px] text-ink-3">
                avg {avg.toFixed(1)} · low {min}
              </span>
            </div>
            <div className="flex items-end gap-[2px] h-11 rounded-lg bg-[var(--surface-2)] px-1.5 py-1">
              {counts.map((n, i) => {
                const short = code.minHeadcount > 0 && n < code.minHeadcount;
                return (
                  <span
                    key={i}
                    title={`Day ${i + 1}: ${n}`}
                    className="flex-1 rounded-[1px] min-h-[2px]"
                    style={{
                      height: `${(n / peak) * 100}%`,
                      background: short ? 'var(--danger)' : tone.accent,
                      opacity: short ? 1 : 0.7,
                    }}
                  />
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ---------------------------------------------------------------- Fairness */

function FairnessTab() {
  const { fairnessRows, codes } = useStore();
  const { rows, spread } = fairnessRows;
  const peak = Math.max(1, ...rows.map((r) => r.nights));
  const nightTone = toneVars(codes.find((c) => c.tone === 'night')?.tone ?? 'night');

  return (
    <div className="p-4 flex flex-col gap-4">
      <p className="text-[11.5px] leading-snug text-ink-3">
        Night shifts worked per person across the months in the tool. Auto-rotate uses this to decide who moves off nights next.
      </p>
      <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-2)] p-3.5">
        <div className="text-[10.5px] font-semibold uppercase tracking-wider text-ink-3">
          Night-shift spread
        </div>
        <div
          className="mt-1 font-mono text-[22px] leading-none"
          style={{ color: spread > 10 ? 'var(--warn)' : 'var(--ok)' }}
        >
          {spread}
        </div>
        <p className="mt-1.5 text-[11.5px] text-ink-3 leading-snug">
          {spread === 0
            ? 'Night duty is split evenly across the rotating pool.'
            : `The gap between the most and least nights worked is ${spread} shifts. Auto-rotate will narrow it.`}
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        {rows.map((row) => (
          <div key={row.employee.id} className="flex items-center gap-2.5">
            <span className="w-[108px] shrink-0 truncate text-[12px]">{row.employee.name}</span>
            <div className="flex-1 h-[7px] rounded-full bg-[var(--surface-3)] overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{ width: `${(row.nights / peak) * 100}%`, background: nightTone.accent }}
              />
            </div>
            <span className="w-6 shrink-0 text-right font-mono text-[11px] text-ink-3">
              {row.nights}
            </span>
          </div>
        ))}
      </div>

      {rows.length === 0 && (
        <p className="text-[12px] text-ink-3">
          No history yet — generate a month or two and the balance will appear here.
        </p>
      )}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className={cx('rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2')}>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-ink-3">{label}</div>
      <div className="mt-0.5 font-mono text-[17px] leading-none text-ink">{value}</div>
    </div>
  );
}

export type { Issue };
