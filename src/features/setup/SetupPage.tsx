import { useRef, useState } from 'react';

import { useStore } from '@/app/store';
import { TONE_OPTIONS, toneVars } from '@/app/tones';
import { Button, Field, Input, Modal, Select, Switch, cx, useToast } from '@/components/ui';
import { importBackup, newId, resetToSeed } from '@/data/db';
import { WEEKDAY_LABELS } from '@/domain/calendar';
import type { Line, ShiftCode, Weekday } from '@/domain/types';

export function SetupPage() {
  const {
    codes, lines, settings, saveCode, removeCode, saveLine, removeLine, updateSettings,
  } = useStore();
  const toast = useToast();

  const [editingCode, setEditingCode] = useState<ShiftCode | null>(null);
  const [editingLine, setEditingLine] = useState<Line | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-4xl px-6 py-7 flex flex-col gap-7">
        <header>
          <h1 className="text-[19px] font-semibold tracking-[-0.015em]">Setup</h1>
          <p className="mt-0.5 text-[12.5px] text-ink-2">
            Lines, shift codes and the rules the planner checks against.
          </p>
        </header>

        {/* ------------------------------------------------------- lines */}
        <Section
          title="Lines"
          description="Each line keeps its own people and rosters."
          action={
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                setEditingLine({ id: newId('line'), name: 'New line', prefix: 'SLV', order: lines.length + 1 })
              }
            >
              Add line
            </Button>
          }
        >
          <div className="divide-y divide-[var(--line)]">
            {lines.map((line) => (
              <button
                key={line.id}
                onClick={() => setEditingLine(line)}
                className="flex w-full items-center gap-3 bg-[var(--surface)] px-4 py-2.5 text-left hover:bg-[var(--surface-2)] transition-colors"
              >
                <span className="text-[13px] font-medium">{line.name}</span>
                <span className="font-mono text-[11px] text-ink-3">{line.prefix}</span>
                {line.id === settings.activeLineId && (
                  <span className="rounded bg-[var(--surface-3)] px-1.5 py-px text-[9.5px] uppercase tracking-wide text-ink-3">
                    active
                  </span>
                )}
                <span className="ml-auto text-ink-3">›</span>
              </button>
            ))}
          </div>
        </Section>

        {/* ------------------------------------------------- shift codes */}
        <Section
          title="Shift codes"
          description="The tokens written into the grid — their colour, timing and how many people each needs."
          action={
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                setEditingCode({
                  id: '', label: '', timing: '08:00 – 17:00', tone: 'general',
                  minHeadcount: 0, countsAsEngineer: true, rotates: false,
                  order: codes.length + 1,
                })
              }
            >
              Add code
            </Button>
          }
        >
          <div className="divide-y divide-[var(--line)]">
            {codes.map((code) => {
              const tone = toneVars(code.tone);
              return (
                <button
                  key={code.id}
                  onClick={() => setEditingCode(code)}
                  className="grid w-full grid-cols-[56px_1fr_120px_84px_72px_20px] items-center gap-3 bg-[var(--surface)] px-4 py-2.5 text-left hover:bg-[var(--surface-2)] transition-colors"
                >
                  <span
                    className={cx(
                      'justify-self-start rounded px-2 py-0.5 font-mono text-[11.5px] font-bold',
                      code.isStatus && 'hatch',
                    )}
                    style={{ background: code.isStatus ? undefined : tone.bg, color: tone.fg }}
                  >
                    {code.id}
                  </span>
                  <span className="text-[13px]">{code.label}</span>
                  <span className="font-mono text-[11.5px] text-ink-3">{code.timing}</span>
                  <span className="text-[11.5px] text-ink-3">
                    {code.minHeadcount > 0 ? `min ${code.minHeadcount}` : '—'}
                  </span>
                  <span className="text-[11px] text-ink-3">
                    {code.isStatus ? 'status' : code.rotates ? 'rotates' : 'fixed'}
                  </span>
                  <span className="text-ink-3">›</span>
                </button>
              );
            })}
          </div>
        </Section>

        {/* ------------------------------------------------------- rules */}
        <Section title="Planner rules" description="What the validator checks on every edit.">
          <div className="bg-[var(--surface)] px-4 py-4 flex flex-col gap-4">
            <Field
              label="Warn after this many days worked in a row"
              hint="The client's roster runs a 5-on / 2-off cycle, so 6 is a sensible ceiling."
            >
              <Input
                type="number"
                min={1}
                max={31}
                value={settings.maxConsecutive}
                onChange={(e) => void updateSettings({ maxConsecutive: Number(e.target.value) })}
                className="w-24"
              />
            </Field>

            <Field label="Weekend columns" hint="Tints those columns. It does not decide who is off — rest days do that, per person.">
              <div className="flex gap-1">
                {WEEKDAY_LABELS.map((label, day) => {
                  const on = settings.weekendDays.includes(day);
                  return (
                    <button
                      key={label}
                      onClick={() =>
                        void updateSettings({
                          weekendDays: on
                            ? settings.weekendDays.filter((d) => d !== day)
                            : [...settings.weekendDays, day as Weekday].sort((a, b) => a - b),
                        })
                      }
                      className={cx(
                        'h-8 flex-1 rounded-lg border text-[12px] font-medium transition-colors',
                        on
                          ? 'border-[var(--accent)] bg-[var(--surface-3)] text-ink'
                          : 'border-[var(--line)] bg-[var(--surface-2)] text-ink-3 hover:text-ink-2',
                      )}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </Field>
          </div>
        </Section>

        {/* ------------------------------------------------------- data */}
        <Section title="Data" description="Everything lives in this browser. Back it up before you switch machines.">
          <div className="bg-[var(--surface)] px-4 py-4 flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => fileInput.current?.click()}>
              Restore from backup
            </Button>
            <input
              ref={fileInput}
              type="file"
              accept=".json"
              hidden
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                try {
                  await importBackup(await file.text());
                  toast('Backup restored.', 'ok');
                } catch (err) {
                  toast(err instanceof Error ? err.message : 'Restore failed.', 'error');
                }
                e.target.value = '';
              }}
            />
            <Button variant="danger" size="sm" onClick={() => setConfirmReset(true)}>
              Reset to the September demo
            </Button>
          </div>
        </Section>
      </div>

      {editingCode && (
        <CodeEditor
          code={editingCode}
          isNew={!codes.some((c) => c.id === editingCode.id)}
          onClose={() => setEditingCode(null)}
          onSave={async (next) => {
            await saveCode(next);
            setEditingCode(null);
            toast(`Shift code ${next.id} saved.`, 'ok');
          }}
          onDelete={async () => {
            await removeCode(editingCode.id);
            setEditingCode(null);
            toast('Shift code removed.', 'ok');
          }}
        />
      )}

      {editingLine && (
        <LineEditor
          line={editingLine}
          onClose={() => setEditingLine(null)}
          onSave={async (next) => {
            await saveLine(next);
            setEditingLine(null);
            toast(`${next.name} saved.`, 'ok');
          }}
          onDelete={async () => {
            await removeLine(editingLine.id);
            setEditingLine(null);
            toast('Line removed.', 'ok');
          }}
        />
      )}

      <Modal
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        title="Reset everything?"
        description="This wipes all lines, people, rosters and leave in this browser, then reloads the September 2026 demo data. It cannot be undone."
        width={420}
        footer={
          <>
            <Button onClick={() => setConfirmReset(false)}>Cancel</Button>
            <Button
              variant="danger"
              onClick={async () => {
                await resetToSeed();
                setConfirmReset(false);
                toast('Reset to the September demo.', 'ok');
              }}
            >
              Reset
            </Button>
          </>
        }
      >
        <p className="text-[12.5px] text-ink-2 leading-relaxed">
          Export a backup first if you want to keep what is here.
        </p>
      </Modal>
    </div>
  );
}

function Section({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-2.5 flex items-end gap-3">
        <div>
          <h2 className="text-[14px] font-semibold">{title}</h2>
          <p className="mt-0.5 text-[12px] text-ink-3">{description}</p>
        </div>
        {action && <div className="ml-auto">{action}</div>}
      </div>
      <div className="overflow-hidden rounded-xl border border-[var(--line)]">{children}</div>
    </section>
  );
}

function CodeEditor({
  code, isNew, onClose, onSave, onDelete,
}: {
  code: ShiftCode;
  isNew: boolean;
  onClose: () => void;
  onSave: (next: ShiftCode) => void;
  onDelete: () => void;
}) {
  const [draft, setDraft] = useState<ShiftCode>({ ...code });
  const tone = toneVars(draft.tone);

  return (
    <Modal
      open
      onClose={onClose}
      width={460}
      title={isNew ? 'New shift code' : `Shift code ${code.id}`}
      footer={
        <>
          {!isNew && (
            <Button variant="danger" size="sm" onClick={onDelete} className="mr-auto">Remove</Button>
          )}
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!draft.id.trim()} onClick={() => onSave(draft)}>
            Save
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3.5">
        <div className="grid grid-cols-[88px_1fr] gap-3">
          <Field label="Code">
            <Input
              value={draft.id}
              disabled={!isNew}
              onChange={(e) => setDraft({ ...draft, id: e.target.value.toUpperCase() })}
              className="font-mono text-center"
            />
          </Field>
          <Field label="Name">
            <Input value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Timing">
            <Input value={draft.timing} onChange={(e) => setDraft({ ...draft, timing: e.target.value })} />
          </Field>
          <Field label="Colour">
            <Select
              value={draft.tone}
              onChange={(e) => setDraft({ ...draft, tone: e.target.value as ShiftCode['tone'] })}
            >
              {TONE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="flex items-center gap-3 rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2.5">
          <span className="text-[11px] text-ink-3">Preview</span>
          <span
            className={cx('rounded px-2.5 py-1 font-mono text-[12px] font-bold', draft.isStatus && 'hatch')}
            style={{ background: draft.isStatus ? undefined : tone.bg, color: tone.fg }}
          >
            {draft.id || '?'}
          </span>
        </div>

        <Field
          label="Minimum people per day"
          hint="A day below this is flagged as a coverage error. Zero turns the check off."
        >
          <Input
            type="number"
            min={0}
            value={draft.minHeadcount}
            onChange={(e) => setDraft({ ...draft, minHeadcount: Number(e.target.value) })}
            className="w-24"
          />
        </Field>

        <div className="flex flex-col gap-2.5 rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-3 py-3">
          <Switch
            checked={draft.countsAsEngineer}
            onChange={(v) => setDraft({ ...draft, countsAsEngineer: v })}
            label="Counts in the Engineers row"
          />
          <Switch
            checked={draft.rotates}
            onChange={(v) => setDraft({ ...draft, rotates: v })}
            label="Include in auto-rotation"
          />
          <Switch
            checked={!!draft.isStatus}
            onChange={(v) => setDraft({ ...draft, isStatus: v })}
            label="A status, not a worked shift (leave, training)"
          />
        </div>
      </div>
    </Modal>
  );
}

function LineEditor({
  line, onClose, onSave, onDelete,
}: {
  line: Line;
  onClose: () => void;
  onSave: (next: Line) => void;
  onDelete: () => void;
}) {
  const [draft, setDraft] = useState<Line>({ ...line });

  return (
    <Modal
      open
      onClose={onClose}
      width={420}
      title={line.name}
      description="Removing a line deletes its people and saved rosters."
      footer={
        <>
          <Button variant="danger" size="sm" onClick={onDelete} className="mr-auto">Remove</Button>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={() => onSave(draft)}>Save</Button>
        </>
      }
    >
      <div className="grid grid-cols-[1fr_100px] gap-3">
        <Field label="Name">
          <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
        </Field>
        <Field label="Prefix" hint="Used in export filenames.">
          <Input
            value={draft.prefix}
            onChange={(e) => setDraft({ ...draft, prefix: e.target.value })}
            className="font-mono"
          />
        </Field>
      </div>
    </Modal>
  );
}
