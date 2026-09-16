import { useRef, useState } from 'react';

import { useStore } from '@/app/store';
import { toneVars } from '@/app/tones';
import { Button, Modal, Select, Switch, cx } from '@/components/ui';
import { db, newId } from '@/data/db';
import { MONTH_NAMES, WEEKDAY_LABELS } from '@/domain/calendar';
import { rosterId } from '@/domain/generator';
import { OFF } from '@/domain/types';
import type { ImportResult } from '@/io/importXlsx';

/** The xlsx parser is ~900 kB, so it loads on first use rather than at startup. */
const loadImporter = () => import('@/io/importXlsx');

type Stage = 'pick-file' | 'pick-sheet' | 'review';

/**
 * Excel import, with a mandatory review step.
 *
 * Importing replaces the people on a line, so the client sees exactly what was
 * understood — each person's rest days, shift and detected rotation — before
 * anything is written. Nothing is silently overwritten.
 */
export function ImportModal({
  open,
  onClose,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  onDone: (count: number) => void;
}) {
  const { settings, lines, codes, setMonth } = useStore();
  const fileInput = useRef<HTMLInputElement>(null);

  const [stage, setStage] = useState<Stage>('pick-file');
  const [buffer, setBuffer] = useState<ArrayBuffer | null>(null);
  const [sheets, setSheets] = useState<string[]>([]);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [targetLine, setTargetLine] = useState(settings.activeLineId);
  const [replace, setReplace] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const codeById = new Map(codes.map((c) => [c.id, c]));

  const reset = () => {
    setStage('pick-file');
    setBuffer(null);
    setSheets([]);
    setResult(null);
    setError(null);
  };

  const onFile = async (file: File) => {
    try {
      setError(null);
      const buf = await file.arrayBuffer();
      const { listSheets } = await loadImporter();
      const names = listSheets(buf);
      setBuffer(buf);
      setSheets(names);
      if (names.length === 1) await parseSheet(buf, names[0]);
      else setStage('pick-sheet');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read that file.');
    }
  };

  const parseSheet = async (buf: ArrayBuffer, sheetName: string) => {
    try {
      setError(null);
      const { importSheet } = await loadImporter();
      setResult(importSheet(buf, sheetName));
      setStage('review');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read that sheet.');
    }
  };

  const commit = async () => {
    if (!result) return;
    const { toRecords } = await loadImporter();
    const { employees, leave } = toRecords(result, targetLine, () => newId('e'));

    await db.transaction('rw', db.employees, db.leave, db.rosters, async () => {
      if (replace) {
        const existing = await db.employees.where('lineId').equals(targetLine).toArray();
        await db.leave.where('employeeId').anyOf(existing.map((e) => e.id)).delete();
        await db.employees.where('lineId').equals(targetLine).delete();
      }
      await db.employees.bulkPut(employees);
      await db.leave.bulkPut(leave);
      // Drop the cached grid so it rebuilds from the imported rules.
      await db.rosters.delete(rosterId(targetLine, result.year, result.month));
    });

    setMonth(result.year, result.month);
    onDone(employees.length);
    reset();
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      width={660}
      title="Import from Excel"
      description="Reads one of your existing roster sheets and works out each person's shift, rest days, rotation and leave."
      footer={
        <>
          <Button
            onClick={() => {
              reset();
              onClose();
            }}
          >
            Cancel
          </Button>
          {stage === 'review' && result && (
            <Button variant="primary" onClick={commit}>
              Import {result.employees.length} people
            </Button>
          )}
        </>
      }
    >
      {error && (
        <div className="mb-3 rounded-lg border border-[var(--danger)] bg-[var(--sh-leave-bg)] px-3 py-2.5 text-[12.5px] text-[var(--danger)]">
          {error}
        </div>
      )}

      {stage === 'pick-file' && (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const file = e.dataTransfer.files[0];
            if (file) void onFile(file);
          }}
          className="rounded-xl border-2 border-dashed border-[var(--line-strong)] bg-[var(--surface-2)] px-6 py-10 text-center"
        >
          <p className="text-[13px] font-medium">Drop an .xlsx roster here</p>
          <p className="mt-1 text-[12px] text-ink-3">or</p>
          <Button variant="outline" size="sm" className="mt-2.5" onClick={() => fileInput.current?.click()}>
            Choose a file
          </Button>
          <input
            ref={fileInput}
            type="file"
            accept=".xlsx,.xls"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void onFile(file);
            }}
          />
          <p className="mt-4 text-[11.5px] text-ink-3 leading-relaxed max-w-sm mx-auto">
            Works with sheets laid out like yours: a title such as{' '}
            <span className="font-mono text-ink-2">Line 5_SEP-2026 Roster</span>, a{' '}
            <span className="font-mono text-ink-2">Name</span> header row, and one column per day.
          </p>
        </div>
      )}

      {stage === 'pick-sheet' && buffer && (
        <div className="flex flex-col gap-2">
          <p className="text-[12.5px] text-ink-2">That workbook has several sheets. Which one?</p>
          {sheets.map((name) => (
            <button
              key={name}
              onClick={() => void parseSheet(buffer, name)}
              className="rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2.5 text-left text-[13px] hover:border-[var(--accent)] transition-colors"
            >
              {name}
            </button>
          ))}
        </div>
      )}

      {stage === 'review' && result && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface-2)] p-3.5">
            <div>
              <div className="text-[10.5px] font-semibold uppercase tracking-wider text-ink-3">Month</div>
              <div className="text-[13px] font-medium">
                {MONTH_NAMES[result.month - 1]} {result.year}
              </div>
            </div>
            <div>
              <div className="text-[10.5px] font-semibold uppercase tracking-wider text-ink-3">People</div>
              <div className="text-[13px] font-medium font-mono">{result.employees.length}</div>
            </div>
            <div className="ml-auto flex items-center gap-3">
              <label className="flex flex-col gap-1">
                <span className="text-[10.5px] font-semibold uppercase tracking-wider text-ink-3">
                  Import into
                </span>
                <Select value={targetLine} onChange={(e) => setTargetLine(e.target.value)} className="h-7 text-[12px]">
                  {lines.map((l) => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </Select>
              </label>
            </div>
          </div>

          <Switch
            checked={replace}
            onChange={setReplace}
            label="Replace the people already on this line"
          />

          {result.warnings.map((w, i) => (
            <p key={i} className="text-[12px] text-[var(--warn)]">{w}</p>
          ))}

          {result.unknownCodes.length > 0 && (
            <p className="text-[12px] text-[var(--warn)] leading-snug">
              Unrecognised codes in this sheet:{' '}
              <span className="font-mono">{result.unknownCodes.join(', ')}</span>. They will be
              imported as-is — add them in Setup to give them a colour and timing.
            </p>
          )}

          <div>
            <div className="mb-2 text-[10.5px] font-semibold uppercase tracking-wider text-ink-3">
              What was understood
            </div>
            <div className="rounded-xl border border-[var(--line)] overflow-hidden">
              <div className="grid grid-cols-[1fr_58px_78px_1fr] gap-2 bg-[var(--surface-3)] px-3 py-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-ink-3">
                <span>Name</span>
                <span>Shift</span>
                <span>Rest days</span>
                <span>Rotation</span>
              </div>
              <div className="max-h-[240px] overflow-y-auto divide-y divide-[var(--line)]">
                {result.employees.map((row, i) => {
                  const tone = toneVars(codeById.get(row.defaultShift)?.tone ?? 'off');
                  return (
                    <div
                      key={i}
                      className="grid grid-cols-[1fr_58px_78px_1fr] items-center gap-2 px-3 py-1.5 bg-[var(--surface-2)]"
                    >
                      <span className="truncate text-[12px]">{row.name}</span>
                      <span
                        className="justify-self-start rounded px-1.5 py-0.5 font-mono text-[11px] font-bold"
                        style={{ background: tone.bg, color: tone.fg }}
                      >
                        {row.defaultShift}
                      </span>
                      <span className="font-mono text-[11px] text-ink-2">
                        {row.restDays.length
                          ? row.restDays.map((d) => WEEKDAY_LABELS[d].slice(0, 2)).join('+')
                          : '—'}
                      </span>
                      <span className="truncate font-mono text-[10.5px] text-ink-3">
                        {row.rotations.length
                          ? row.rotations.map((r) => `${r.code}:${r.fromDay}-${r.toDay}`).join(' ')
                          : 'none'}
                        {row.leaveRanges.length > 0 && (
                          <span className="text-[var(--sh-leave-ink)]">
                            {' '}· {row.leaveRanges.length} leave
                          </span>
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <details className="rounded-xl border border-[var(--line)] bg-[var(--surface-2)] overflow-hidden">
            <summary className="cursor-pointer px-3 py-2 text-[12px] text-ink-2 select-none">
              Preview the grid as read
            </summary>
            <div className="overflow-x-auto px-3 pb-3">
              <table className="border-separate border-spacing-[1px]">
                <tbody>
                  {result.employees.map((row, i) => (
                    <tr key={i}>
                      <td className="pr-2 text-[10.5px] text-ink-3 whitespace-nowrap sticky left-0 bg-[var(--surface-2)]">
                        {row.name}
                      </td>
                      {row.codes.map((code, j) => {
                        const def = codeById.get(code);
                        const tone = toneVars(def?.tone ?? 'off');
                        return (
                          <td
                            key={j}
                            className={cx(
                              'w-[17px] h-[17px] text-center font-mono text-[8.5px] font-bold rounded-[2px]',
                              def?.isStatus && 'hatch',
                            )}
                            style={{
                              background: def?.isStatus ? undefined : tone.bg,
                              color: tone.fg,
                            }}
                          >
                            {code === OFF ? '' : code[0]}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </div>
      )}
    </Modal>
  );
}
