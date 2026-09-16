import { motion } from 'framer-motion';

import { useStore } from '@/app/store';
import { toneVars } from '@/app/tones';
import { Button, Select, cx } from '@/components/ui';
import { MONTH_NAMES } from '@/domain/calendar';
import { OFF } from '@/domain/types';

interface Props {
  brush: string | null;
  setBrush: (code: string | null) => void;
  onGenerate: () => void;
  onRotate: () => void;
  onImport: () => void;
  onExport: () => void;
  insightsOpen: boolean;
  toggleInsights: () => void;
}

export function Toolbar({
  brush, setBrush, onGenerate, onRotate, onImport, onExport, insightsOpen, toggleInsights,
}: Props) {
  const { settings, lines, codes, setLine, setMonth, stepMonth, issues, undo, redo } = useStore();
  const errors = issues.filter((i) => i.severity === 'error').length;
  const warnings = issues.length - errors;

  const years = Array.from({ length: 7 }, (_, i) => settings.activeYear - 2 + i);

  return (
    <div className="no-print shrink-0 border-b border-[var(--line)] bg-[var(--surface)]">
      {/* ------------------------------------------------------- row one */}
      <div className="flex items-center gap-2 px-4 h-14">
        <Select
          value={settings.activeLineId}
          onChange={(e) => setLine(e.target.value)}
          className="font-semibold"
        >
          {lines.map((l) => (
            <option key={l.id} value={l.id}>{l.name}</option>
          ))}
        </Select>

        <div className="flex items-center rounded-lg border border-[var(--line)] bg-[var(--surface-2)]">
          <Button size="sm" onClick={() => stepMonth(-1)} className="rounded-r-none px-2" title="Previous month">‹</Button>
          <Select
            value={settings.activeMonth}
            onChange={(e) => setMonth(settings.activeYear, Number(e.target.value))}
            className="h-7 rounded-none border-0 bg-transparent text-[12.5px] font-medium"
          >
            {MONTH_NAMES.map((m, i) => (
              <option key={m} value={i + 1}>{m}</option>
            ))}
          </Select>
          <Select
            value={settings.activeYear}
            onChange={(e) => setMonth(Number(e.target.value), settings.activeMonth)}
            className="h-7 rounded-none border-0 bg-transparent text-[12.5px] font-mono"
          >
            {years.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </Select>
          <Button size="sm" onClick={() => stepMonth(1)} className="rounded-l-none px-2" title="Next month">›</Button>
        </div>

        <div className="mx-1 h-5 w-px bg-[var(--line)]" />

        <Button variant="primary" size="sm" onClick={onGenerate}>
          <BoltIcon /> Generate month
        </Button>
        <Button variant="outline" size="sm" onClick={onRotate}>
          <RotateIcon /> Auto-rotate
        </Button>

        <div className="mx-1 h-5 w-px bg-[var(--line)]" />

        <Button size="sm" onClick={undo} title="Undo (Ctrl+Z)">↶</Button>
        <Button size="sm" onClick={redo} title="Redo (Ctrl+Shift+Z)">↷</Button>

        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={onImport}>Import Excel</Button>
          <Button size="sm" variant="outline" onClick={onExport}>Export</Button>

          <button
            onClick={toggleInsights}
            className={cx(
              'flex items-center gap-2 h-7 px-2.5 rounded-md border text-[12px] font-medium transition-colors',
              insightsOpen
                ? 'border-[var(--accent)] text-ink bg-[var(--surface-3)]'
                : 'border-[var(--line-strong)] text-ink-2 hover:text-ink',
            )}
          >
            {errors > 0 ? (
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--danger)]" />
                <span className="font-mono">{errors}</span>
              </span>
            ) : warnings > 0 ? (
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--warn)]" />
                <span className="font-mono">{warnings}</span>
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--ok)]" />
                Clear
              </span>
            )}
            Insights
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------- row two */}
      <div className="flex items-center gap-1.5 px-4 h-11 border-t border-[var(--line)] bg-[var(--surface-2)]">
        <span className="text-[10.5px] font-semibold uppercase tracking-wider text-ink-3 mr-1">
          Brush
        </span>

        <BrushChip
          active={brush === null}
          onClick={() => setBrush(null)}
          label="Select"
          hint="Click a cell to pick"
        />

        {codes.map((code) => {
          const tone = toneVars(code.tone);
          return (
            <BrushChip
              key={code.id}
              active={brush === code.id}
              onClick={() => setBrush(brush === code.id ? null : code.id)}
              label={code.id}
              hint={`${code.label} · ${code.timing}`}
              tone={tone}
              hatched={code.isStatus}
            />
          );
        })}

        <BrushChip
          active={brush === OFF}
          onClick={() => setBrush(brush === OFF ? null : OFF)}
          label="–"
          hint="Day off"
          tone={toneVars('off')}
        />

        {brush && (
          <motion.span
            initial={{ opacity: 0, x: -4 }}
            animate={{ opacity: 1, x: 0 }}
            className="ml-2 text-[11.5px] text-ink-3"
          >
            Click or drag across the grid to paint.
          </motion.span>
        )}
      </div>
    </div>
  );
}

function BrushChip({
  active, onClick, label, hint, tone, hatched,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  hint: string;
  tone?: { bg: string; fg: string; accent: string };
  hatched?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={hint}
      className={cx(
        'relative h-7 min-w-[34px] px-2 rounded-md text-[12px] font-mono font-bold transition-all',
        hatched && 'hatch',
        active ? 'ring-2 ring-[var(--accent)] ring-offset-1 ring-offset-[var(--surface-2)]' : 'hover:brightness-125',
        !tone && 'border border-[var(--line-strong)] font-sans font-medium text-ink-2',
      )}
      style={tone && !hatched ? { background: tone.bg, color: tone.fg } : tone ? { color: tone.fg } : undefined}
    >
      {label}
    </button>
  );
}

function BoltIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M13 2 4.5 13.5H11l-1 8.5 8.5-11.5H12l1-8.5Z" />
    </svg>
  );
}

function RotateIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
      <path d="M21 12a9 9 0 1 1-3-6.7" />
      <path d="M21 4v5h-5" />
    </svg>
  );
}
