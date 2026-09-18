import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';

import { useStore } from '@/app/store';
import { useViewport } from '@/app/useViewport';
import { toneVars } from '@/app/tones';
import { Button, Select, cx, useToast } from '@/components/ui';
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
  const {
    settings, lines, codes, setLine, setMonth, stepMonth, issues, undo, redo,
    updateSettings, saveStatus, saveRoster,
  } = useStore();
  const toast = useToast();
  const errors = issues.filter((i) => i.severity === 'error').length;
  const warnings = issues.length - errors;
  const viewport = useViewport();
  const compact = viewport !== 'desktop';
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [menuOpen]);

  const years = Array.from({ length: 7 }, (_, i) => settings.activeYear - 2 + i);

  return (
    <div className="no-print shrink-0 border-b border-[var(--line)] bg-[var(--surface)]">
      {/* ------------------------------------------------------- row one */}
      <div className="flex flex-wrap items-center gap-2 px-3 md:px-4 py-2 min-h-14">
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

        <Button variant="primary" size="sm" onClick={onGenerate} title="Generate month">
          <BoltIcon /> <span className="hidden 2xl:inline">Generate month</span><span className="2xl:hidden">Generate</span>
        </Button>
        {!compact && (
          <Button variant="outline" size="sm" onClick={onRotate} title="Auto-rotate">
            <RotateIcon /> <span className="hidden 2xl:inline">Auto-rotate</span><span className="2xl:hidden">Rotate</span>
          </Button>
        )}

        <div className="mx-1 h-5 w-px bg-[var(--line)] hidden sm:block" />

        {/* Save button & status */}
        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            variant="outline"
            onClick={async () => {
              await saveRoster();
              toast('Roster saved to browser database.', 'ok');
            }}
            title="Save changes to browser database"
            className="flex items-center gap-1.5"
          >
            <DiskIcon />
            <span className="hidden lg:inline">Save</span>
          </Button>
          <span
            className="hidden 2xl:inline-flex items-center gap-1 text-[11px] text-ink-3 font-medium"
            title="Changes are automatically preserved in browser database"
          >
            {saveStatus === 'saving' ? (
              <>
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--warn)] animate-pulse" />
                <span>Saving…</span>
              </>
            ) : (
              <>
                <span className="text-[var(--ok)] text-[12px]">✓</span>
                <span>Saved</span>
              </>
            )}
          </span>
        </div>

        <div className="mx-1 h-5 w-px bg-[var(--line)] hidden md:block" />

        {/* Zoom In/Out controls */}
        <div
          className="hidden md:flex items-center rounded-lg border border-[var(--line)] bg-[var(--surface-2)] h-7 px-1 text-[11.5px]"
          title="Screen Zoom: Adjust roster grid size"
        >
          <button
            onClick={() => void updateSettings({ zoomLevel: Math.max(70, (settings.zoomLevel ?? 100) - 10) })}
            className="h-5 w-5 grid place-items-center rounded hover:bg-[var(--surface-3)] text-ink-2 hover:text-ink font-bold"
            title="Zoom Out (−10%)"
          >
            −
          </button>
          <button
            onClick={() => void updateSettings({ zoomLevel: 100 })}
            className="px-1.5 font-mono text-[11px] text-ink-2 hover:text-ink"
            title="Reset zoom to 100%"
          >
            {settings.zoomLevel ?? 100}%
          </button>
          <button
            onClick={() => void updateSettings({ zoomLevel: Math.min(140, (settings.zoomLevel ?? 100) + 10) })}
            className="h-5 w-5 grid place-items-center rounded hover:bg-[var(--surface-3)] text-ink-2 hover:text-ink font-bold"
            title="Zoom In (+10%)"
          >
            +
          </button>
        </div>

        {/* Font size selection */}
        <div className="hidden 2xl:flex items-center">
          <Select
            value={settings.fontSize ?? 'normal'}
            onChange={(e) => void updateSettings({ fontSize: e.target.value as 'compact' | 'normal' | 'large' })}
            className="h-7 text-[11.5px] border-[var(--line)] bg-[var(--surface-2)]"
            title="Font Size Selection"
          >
            <option value="compact">Aa Compact</option>
            <option value="normal">Aa Normal</option>
            <option value="large">Aa Large</option>
          </Select>
        </div>

        <div className="mx-1 h-5 w-px bg-[var(--line)] hidden sm:block" />

        <Button size="sm" onClick={undo} title="Undo (Ctrl+Z)">↶</Button>
        <Button size="sm" onClick={redo} title="Redo (Ctrl+Shift+Z)">↷</Button>

        <div className="ml-auto flex items-center gap-2">
          {!compact && (
            <>
              <Button size="sm" variant="outline" onClick={onImport} title="Import Excel"><span className="hidden 2xl:inline">Import Excel</span><span className="2xl:hidden">Import</span></Button>
              <Button size="sm" variant="outline" onClick={onExport}>Export</Button>
            </>
          )}

          {compact && (
            <div ref={menuRef} className="relative">
              <Button size="sm" variant="outline" onClick={() => setMenuOpen((v) => !v)} title="More actions" className="px-2.5">
                <DotsIcon />
              </Button>
              <AnimatePresence>
                {menuOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -4, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -4, scale: 0.98 }}
                    transition={{ duration: 0.12 }}
                    className="absolute right-0 top-full z-40 mt-1 w-48 rounded-xl border border-[var(--line-strong)] bg-[var(--surface)] p-1 shadow-pop"
                  >
                    {[
                      ['Auto-rotate', onRotate],
                      ['Import Excel', onImport],
                      ['Export', onExport],
                    ].map(([label, fn]) => (
                      <button
                        key={label as string}
                        onClick={() => { setMenuOpen(false); (fn as () => void)(); }}
                        className="block w-full rounded-lg px-3 py-2 text-left text-[13px] hover:bg-[var(--surface-2)]"
                      >
                        {label as string}
                      </button>
                    ))}
                    <div className="my-1 border-t border-[var(--line)]" />
                    <div className="px-3 py-1.5 text-[11px] text-ink-3">
                      Zoom:
                      <div className="mt-1 flex items-center gap-1">
                        <button onClick={() => void updateSettings({ zoomLevel: Math.max(70, (settings.zoomLevel ?? 100) - 10) })} className="h-6 w-7 rounded bg-[var(--surface-2)] text-ink-2">−</button>
                        <span className="font-mono text-ink-2 min-w-[40px] text-center">{settings.zoomLevel ?? 100}%</span>
                        <button onClick={() => void updateSettings({ zoomLevel: Math.min(140, (settings.zoomLevel ?? 100) + 10) })} className="h-6 w-7 rounded bg-[var(--surface-2)] text-ink-2">+</button>
                      </div>
                    </div>
                    <div className="px-3 py-1.5 text-[11px] text-ink-3">
                      Font size:
                      <div className="mt-1 flex gap-1">
                        {(['compact', 'normal', 'large'] as const).map((sz) => (
                          <button
                            key={sz}
                            onClick={() => void updateSettings({ fontSize: sz })}
                            className={cx(
                              'px-2 py-0.5 rounded text-[11px] capitalize',
                              (settings.fontSize ?? 'normal') === sz
                                ? 'bg-[var(--accent)] text-[var(--accent-ink)] font-bold'
                                : 'bg-[var(--surface-2)] text-ink-2',
                            )}
                          >
                            {sz}
                          </button>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          <button
            onClick={toggleInsights}
            title={
              errors > 0
                ? `${errors} staffing / rule error${errors > 1 ? 's' : ''} (shift below minimum or rule violation). Click to view details.`
                : warnings > 0
                ? `${warnings} warning${warnings > 1 ? 's' : ''} to review. Click to view details.`
                : 'All shift minimums and roster rules satisfied. Click to view overview.'
            }
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
            <span className="hidden sm:inline">Insights</span>
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------- row two */}
      <div className="flex items-center gap-1.5 px-3 md:px-4 h-11 border-t border-[var(--line)] bg-[var(--surface-2)] overflow-x-auto">
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
            className="ml-2 text-[11.5px] text-ink-3 whitespace-nowrap hidden md:inline"
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
        'relative h-7 min-w-[34px] px-2 rounded-md text-[12px] font-mono font-bold transition-all shrink-0',
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

function DotsIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" />
    </svg>
  );
}

function DiskIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
      <polyline points="17 21 17 13 7 13 7 21" />
      <polyline points="7 3 7 8 15 8" />
    </svg>
  );
}
