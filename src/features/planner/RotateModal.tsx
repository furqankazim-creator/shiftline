import { useMemo, useState } from 'react';

import { useStore } from '@/app/store';
import { codeVars } from '@/app/tones';
import { Button, Modal, useToast } from '@/components/ui';
import { monthLabel, shiftMonth } from '@/domain/calendar';

/**
 * Auto-rotate: build next month's shift allocation.
 *
 * The client rotates people between Morning / Evening / Night by hand today,
 * which is where unfairness creeps in — four of his engineers sat on Night for
 * the whole of September. This proposes a balanced allocation and shows
 * exactly who moves and why before anything is written.
 */
export function RotateModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { settings, employees, codes, previewRotation, applyRotation, fairnessRows } = useStore();
  const toast = useToast();

  const [aggressiveness, setAggressiveness] = useState(1);

  const target = shiftMonth(settings.activeYear, settings.activeMonth, 1);
  const result = useMemo(
    () => (open ? previewRotation(aggressiveness) : null),
    [open, aggressiveness, previewRotation],
  );

  const codeById = useMemo(() => new Map(codes.map((c) => [c.id, c])), [codes]);

  const moves = useMemo(() => {
    if (!result) return [];
    return employees
      .filter((e) => result.assignments[e.id] && result.assignments[e.id] !== e.defaultShift)
      .map((e) => ({ employee: e, from: e.defaultShift, to: result.assignments[e.id] }));
  }, [result, employees]);

  const nightsBefore = useMemo(
    () => new Map(fairnessRows.rows.map((r) => [r.employee.id, r.nights])),
    [fairnessRows],
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      width={620}
      title={`Auto-rotate into ${monthLabel(target.year, target.month)}`}
      description="Balances night-shift load across the rotating pool, then repairs any day that would fall below its minimum."
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            disabled={!result}
            onClick={async () => {
              if (!result) return;
              await applyRotation(result, target.year, target.month);
              toast(
                `${monthLabel(target.year, target.month)} rotated — ${moves.length} people moved.`,
                'ok',
              );
              onClose();
            }}
          >
            Apply to {monthLabel(target.year, target.month)}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-2)] p-3.5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-3">
              How much to shuffle
            </span>
            <span className="font-mono text-[12px] text-ink-2">
              {moves.length} of {employees.length} move
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={1}
            step={0.1}
            value={aggressiveness}
            onChange={(e) => setAggressiveness(Number(e.target.value))}
            className="w-full accent-[var(--accent)]"
          />
          <div className="flex justify-between text-[11px] text-ink-3 mt-1">
            <span>Keep things stable</span>
            <span>Rotate everyone</span>
          </div>
        </div>

        {result && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {codes
              .filter((c) => c.rotates && !c.isStatus)
              .map((code) => {
                const worst = result.worstCoverage[code.id] ?? 0;
                const short = worst < code.minHeadcount;
                return (
                  <div
                    key={code.id}
                    className="rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2.5"
                  >
                    <div className="flex items-center gap-1.5">
                      <span
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ background: codeVars(code).accent }}
                      />
                      <span className="text-[10.5px] font-semibold uppercase tracking-wider text-ink-3">
                        {code.label}
                      </span>
                    </div>
                    <div
                      className="mt-1 font-mono text-[18px] leading-none"
                      style={{ color: short ? 'var(--danger)' : 'var(--ok)' }}
                    >
                      {worst}
                    </div>
                    <div className="mt-1 text-[10.5px] text-ink-3">
                      thinnest day · min {code.minHeadcount}
                    </div>
                  </div>
                );
              })}
          </div>
        )}

        <div>
          <div className="mb-2 text-[10.5px] font-semibold uppercase tracking-wider text-ink-3">
            Who moves
          </div>
          {moves.length === 0 ? (
            <p className="text-[12.5px] text-ink-3">
              Nobody moves at this setting — everyone stays on their current shift.
            </p>
          ) : (
            <div className="flex flex-col divide-y divide-[var(--line)] rounded-xl border border-[var(--line)] overflow-hidden">
              {moves.map(({ employee, from, to }) => (
                <div key={employee.id} className="flex items-center gap-3 px-3 py-2 bg-[var(--surface-2)]">
                  <span className="flex-1 truncate text-[12.5px]">{employee.name}</span>
                  <span className="text-[11px] text-ink-3 font-mono">
                    {nightsBefore.get(employee.id) ?? 0} nights so far
                  </span>
                  <Pill code={from} label={codeById.get(from)?.label} />
                  <span className="text-ink-3 text-[11px]">→</span>
                  <Pill code={to} label={codeById.get(to)?.label} />
                </div>
              ))}
            </div>
          )}
        </div>

        {result && result.notes.length > 0 && (
          <div>
            <div className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-ink-3">
              Why
            </div>
            <ul className="flex flex-col gap-1">
              {result.notes.map((note, i) => (
                <li key={i} className="flex gap-2 text-[12px] text-ink-2 leading-snug">
                  <span className="text-ink-3 shrink-0">·</span>
                  {note}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Modal>
  );

  function Pill({ code, label }: { code: string; label?: string }) {
    const tone = codeVars(codeById.get(code));
    return (
      <span
        title={label}
        className="rounded px-1.5 py-0.5 font-mono text-[11px] font-bold"
        style={{ background: tone.bg, color: tone.fg }}
      >
        {code}
      </span>
    );
  }
}
