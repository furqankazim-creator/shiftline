import { motion } from 'framer-motion';
import { useEffect, useRef } from 'react';

import { useStore } from '@/app/store';
import { useCoarsePointer } from '@/app/useViewport';
import { toneVars } from '@/app/tones';
import { cx } from '@/components/ui';
import { OFF } from '@/domain/types';

/**
 * The shift picker that opens under a clicked cell.
 *
 * Kept flat rather than nested in a menu: every code the client uses is one
 * click away, and each carries its keyboard letter so the shortcut is
 * discoverable rather than documented.
 */
export function CellPicker({
  x,
  y,
  current,
  onPick,
  onClose,
}: {
  x: number;
  y: number;
  current: string;
  onPick: (code: string) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { codes } = useStore();
  const touch = useCoarsePointer();

  useEffect(() => {
    // Close on any mousedown outside the picker. The grid opens the picker on
    // mousedown too, so this is registered on the next tick to avoid catching
    // the very event that opened it.
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    const t = setTimeout(() => document.addEventListener('mousedown', onDown), 0);
    window.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(t);
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const width = 232;
  const left = Math.max(8, Math.min(window.innerWidth - width - 8, x - width / 2));
  const top = Math.min(window.innerHeight - 240, y);

  const worked = codes.filter((c) => !c.isStatus);
  const status = codes.filter((c) => c.isStatus);

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, scale: 0.95, y: -4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 520, damping: 34 }}
      style={{ left, top, width }}
      className="fixed z-50 rounded-xl border border-[var(--line-strong)] bg-[var(--surface)] p-2 shadow-pop"
    >
      <div className="grid grid-cols-3 gap-1">
        {worked.map((code) => {
          const tone = toneVars(code.tone);
          return (
            <button
              key={code.id}
              onMouseDown={(e) => { e.preventDefault(); onPick(code.id); }}
              title={`${code.label} · ${code.timing}`}
              className={cx(
                'flex flex-col items-center gap-0.5 rounded-lg py-1.5 transition-[filter] hover:brightness-125',
                current === code.id && 'ring-1 ring-[var(--accent)]',
              )}
              style={{ background: tone.bg, color: tone.fg }}
            >
              <span className="font-mono text-[13px] font-bold">{code.id}</span>
              <span className="text-[9.5px] opacity-80 leading-none">{code.label.split(' ')[0]}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-1 grid grid-cols-3 gap-1">
        <button
          onMouseDown={(e) => { e.preventDefault(); onPick(OFF); }}
          className={cx(
            'flex flex-col items-center gap-0.5 rounded-lg py-1.5 bg-[var(--sh-off)] text-[var(--sh-off-ink)] hover:brightness-125',
            current === OFF && 'ring-1 ring-[var(--accent)]',
          )}
        >
          <span className="font-mono text-[13px] font-bold">–</span>
          <span className="text-[9.5px] opacity-80 leading-none">Off</span>
        </button>
        {status.map((code) => {
          const tone = toneVars(code.tone);
          return (
            <button
              key={code.id}
              onMouseDown={(e) => { e.preventDefault(); onPick(code.id); }}
              title={code.label}
              className={cx(
                'hatch flex flex-col items-center gap-0.5 rounded-lg py-1.5 hover:brightness-125',
                current === code.id && 'ring-1 ring-[var(--accent)]',
              )}
              style={{ color: tone.fg }}
            >
              <span className="font-mono text-[13px] font-bold">{code.id}</span>
              <span className="text-[9.5px] opacity-80 leading-none">{code.label}</span>
            </button>
          );
        })}
      </div>

      {!touch && <p className="mt-2 px-1 text-[10.5px] text-ink-3 leading-snug">
        Tip: with a cell focused, just type <span className="font-mono text-ink-2">M</span>{' '}
        <span className="font-mono text-ink-2">E</span> <span className="font-mono text-ink-2">N</span>{' '}
        or <span className="font-mono text-ink-2">-</span>.
      </p>}
    </motion.div>
  );
}
