import {
  AnimatePresence,
  animate,
  motion,
  useInView,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
  type Variants,
} from 'framer-motion';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from 'react';

import { getSettings, patchSettings } from '@/data/db';

/**
 * Landing page shown before the planner.
 *
 * Self-contained and theme-aware: every colour is a CSS variable set on the
 * page root from the palettes below, so one toggle restyles everything. The
 * chosen theme is shared with the planner (same saved setting). Motion
 * respects `prefers-reduced-motion`.
 */

/* --------------------------------------------------------------- themes */

type Theme = 'dark' | 'light';

const PALETTES: Record<Theme, Record<string, string>> = {
  dark: {
    '--l-bg': '#080b14',
    '--l-text': '#e8ecf6',
    '--l-t2': '#9aa4bd',
    '--l-t3': '#6c7690',
    '--l-line': 'rgba(255,255,255,0.10)',
    '--l-line2': 'rgba(255,255,255,0.24)',
    '--l-card': 'rgba(255,255,255,0.035)',
    '--l-card-hover': 'rgba(255,255,255,0.07)',
    '--l-panel': '#0d111d',
    '--l-panel2': '#0f1320',
    '--l-inset': 'rgba(0,0,0,0.28)',
    '--l-chip': '#1a2033',
    '--l-nav': 'rgba(8,11,20,0.74)',
    '--l-grid': 'rgba(255,255,255,0.045)',
    '--l-cta': 'linear-gradient(135deg,#141a30,#0c1020)',
    '--l-red': '#ff6b7a',
    '--l-green': '#4ade80',
    '--l-amber': '#F5B040',
    '--l-blue': '#8593FF',
    '--l-cyan': '#34CDD3',
    '--l-red-bg': '#3a1820',
    '--l-green-bg': '#10301f',
    '--l-accent': '#6d8bff',
    '--l-grad': 'linear-gradient(90deg,#F5B040,#34CDD3 55%,#8593FF)',
    '--l-btn-ink': '#0b0d12',
    '--l-glow': 'rgba(52,205,211,0.55)',
    '--l-orb': '0.25',
    '--l-shadow': '0 50px 120px -30px #000',
    '--t-M-bg': '#4a3512', '--t-M-fg': '#F5B040',
    '--t-E-bg': '#10393b', '--t-E-fg': '#34CDD3',
    '--t-N-bg': '#232a5c', '--t-N-fg': '#8593FF',
    '--t-ML-bg': '#3d2c10', '--t-ML-fg': '#e8a23a',
    '--t-NL-bg': '#1d2350', '--t-NL-fg': '#7080f0',
    '--t-LV-bg': '#4a1a22', '--t-LV-fg': '#ff6b7a',
    '--t-off': '#3b4256',
  },
  light: {
    '--l-bg': '#f5f7fc',
    '--l-text': '#0f172a',
    '--l-t2': '#475069',
    '--l-t3': '#6b7490',
    '--l-line': 'rgba(15,23,42,0.11)',
    '--l-line2': 'rgba(15,23,42,0.28)',
    '--l-card': 'rgba(255,255,255,0.78)',
    '--l-card-hover': '#ffffff',
    '--l-panel': '#ffffff',
    '--l-panel2': '#fbfcff',
    '--l-inset': 'rgba(15,23,42,0.045)',
    '--l-chip': '#eef1f8',
    '--l-nav': 'rgba(245,247,252,0.80)',
    '--l-grid': 'rgba(15,23,42,0.065)',
    '--l-cta': 'linear-gradient(135deg,#e7eeff,#fff3dd)',
    '--l-red': '#d1243a',
    '--l-green': '#15803d',
    '--l-amber': '#b45309',
    '--l-blue': '#4658d8',
    '--l-cyan': '#0e8f96',
    '--l-red-bg': '#fde4e8',
    '--l-green-bg': '#dcf5e5',
    '--l-accent': '#3355e8',
    '--l-grad': 'linear-gradient(90deg,#d97706,#0e9aa1 55%,#4458e8)',
    '--l-btn-ink': '#ffffff',
    '--l-glow': 'rgba(51,85,232,0.35)',
    '--l-orb': '0.16',
    '--l-shadow': '0 40px 90px -35px rgba(15,23,42,0.35)',
    '--t-M-bg': '#fde9c4', '--t-M-fg': '#9a5b00',
    '--t-E-bg': '#cdf1f2', '--t-E-fg': '#0b7a80',
    '--t-N-bg': '#dfe3ff', '--t-N-fg': '#3e4fd6',
    '--t-ML-bg': '#fff1d6', '--t-ML-fg': '#a8680a',
    '--t-NL-bg': '#e6e9ff', '--t-NL-fg': '#4658d8',
    '--t-LV-bg': '#fbdadf', '--t-LV-fg': '#c0263a',
    '--t-off': '#b5bccd',
  },
};

const THEME_KEY = 'shiftline-theme';

function readInitialTheme(): Theme {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {
    /* storage unavailable */
  }
  const fromDoc = document.documentElement.dataset.theme;
  return fromDoc === 'light' ? 'light' : 'dark';
}

/* ------------------------------------------------------------------ data */

const TONES: Record<string, { bg: string; fg: string; label: string }> = {
  M: { bg: 'var(--t-M-bg)', fg: 'var(--t-M-fg)', label: 'Morning' },
  E: { bg: 'var(--t-E-bg)', fg: 'var(--t-E-fg)', label: 'Evening' },
  N: { bg: 'var(--t-N-bg)', fg: 'var(--t-N-fg)', label: 'Night' },
  ML: { bg: 'var(--t-ML-bg)', fg: 'var(--t-ML-fg)', label: 'Morning Late' },
  NL: { bg: 'var(--t-NL-bg)', fg: 'var(--t-NL-fg)', label: 'Night Late' },
  LV: { bg: 'var(--t-LV-bg)', fg: 'var(--t-LV-fg)', label: 'Leave' },
  '-': { bg: 'transparent', fg: 'var(--t-off)', label: 'Off' },
};

const BRUSHES = ['M', 'E', 'N', 'ML', 'NL', 'LV', '-'] as const;
const WORKING = new Set(['M', 'E', 'N', 'ML', 'NL']);
const NIGHT = new Set(['N', 'NL']);
const MORNING = new Set(['M', 'ML']);

const DEMO_DAYS = 14;
const DEMO_ROWS: { name: string; role: string; codes: string[] }[] = [
  { name: 'Zouhair Azzabi', role: 'PIC', codes: ['M', 'M', '-', 'M', 'M', 'M', '-', '-', 'M', 'M', 'M', '-', 'M', 'M'] },
  { name: 'Wesam B', role: 'MP', codes: ['LV', 'LV', 'LV', 'M', 'M', 'ML', '-', '-', 'M', 'M', 'ML', 'M', '-', '-'] },
  { name: 'Ajay Pal', role: 'MP', codes: ['E', 'E', 'E', '-', '-', 'E', 'E', 'E', '-', 'E', 'E', '-', '-', 'E'] },
  { name: 'Sher Khan', role: 'PIC', codes: ['N', 'N', '-', '-', 'N', 'N', 'N', 'NL', '-', '-', 'N', 'N', '-', '-'] },
  { name: 'John Paul', role: 'MP', codes: ['-', 'N', 'N', 'N', 'NL', '-', '-', 'N', 'N', 'N', '-', '-', 'N', 'N'] },
];

const MARQUEE = [
  'Excel import', 'Excel export', 'Auto-rotation', 'Rule checking', 'Brush editing', 'Headcount rail',
  'Leave tracking', 'Multi-line', 'Offline-first', 'Undo / redo', 'Custom shift codes', 'Full backup',
];

const STATS: { to: number; suffix: string; l: string }[] = [
  { to: 30, suffix: 's', l: 'to generate a full month' },
  { to: 100, suffix: '%', l: 'works offline in your browser' },
  { to: 12, suffix: '+', l: 'built-in rule & coverage checks' },
  { to: 2, suffix: ' clicks', l: 'from Excel in to Excel out' },
];

const FAQ: { q: string; a: string }[] = [
  {
    q: 'Can I import my own Excel roster?',
    a: 'Yes. ShiftLine scans the sheet for the name column, finds the day columns, reads each cell, and maps verbose shift text like "Morning Early | 07:30-18:00" to short codes. Unknown shift codes are created automatically.',
  },
  {
    q: 'Will the export look like my original sheet?',
    a: 'There is an Operational Roster export that mirrors the sectioned layout: PIC/MP sections, date headers, verbose shift timings, total OT and working-count rows. A standard workbook with live COUNTIF headcounts is also available.',
  },
  {
    q: 'Where is my data stored?',
    a: 'In your browser, on your device. Nothing is uploaded. Every Save also downloads a full Excel backup, and you can restore from a JSON or Excel backup at any time.',
  },
  {
    q: 'Can I run more than one line or team?',
    a: 'Yes. Each line owns its own people and months, while shift codes are shared across all lines, so a code you add once is available everywhere.',
  },
  {
    q: 'What rules does it check?',
    a: 'Minimum headcount per shift, empty shifts, night-to-morning turnarounds, too many consecutive working days, rest-day violations and working while on leave. Issues are flagged live as you edit.',
  },
];

/* --------------------------------------------------------------- helpers */

const GRADIENT = 'var(--l-grad)';

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 32 },
  show: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.65, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] },
  }),
};

function Reveal({ children, i = 0, className }: { children: ReactNode; i?: number; className?: string }) {
  return (
    <motion.div
      variants={fadeUp}
      custom={i}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: '-60px' }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function GradientText({ children }: { children: ReactNode }) {
  return (
    <span className="bg-clip-text text-transparent" style={{ backgroundImage: GRADIENT }}>
      {children}
    </span>
  );
}

function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <span
      className="inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-[11.5px] font-semibold uppercase tracking-[0.14em]"
      style={{ borderColor: 'var(--l-line)', background: 'var(--l-card)', color: 'var(--l-t2)' }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: GRADIENT }} />
      {children}
    </span>
  );
}

function ArrowIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

/* --------------------------------------------------------------- buttons */

type BtnVariant = 'primary' | 'secondary' | 'ghost';
type BtnSize = 'sm' | 'md' | 'lg';

const BTN_SIZE: Record<BtnSize, string> = {
  sm: 'h-9 px-4 text-[13px]',
  md: 'h-11 px-6 text-[14.5px]',
  lg: 'h-[52px] px-8 text-[15.5px]',
};

/**
 * One button for the whole page: consistent height, radius, focus ring,
 * hover lift and press feedback. `primary` is the gradient call to action.
 */
function Btn({
  variant = 'primary',
  size = 'md',
  onClick,
  children,
  trailing,
  className = '',
  ariaLabel,
}: {
  variant?: BtnVariant;
  size?: BtnSize;
  onClick: () => void;
  children: ReactNode;
  trailing?: ReactNode;
  className?: string;
  ariaLabel?: string;
}) {
  const reduce = useReducedMotion();

  const style: CSSProperties =
    variant === 'primary'
      ? { background: GRADIENT, color: 'var(--l-btn-ink)', boxShadow: '0 12px 36px -12px var(--l-glow), inset 0 1px 0 rgba(255,255,255,0.25)' }
      : variant === 'secondary'
        ? { background: 'var(--l-card)', color: 'var(--l-text)', border: '1px solid var(--l-line2)', backdropFilter: 'blur(8px)' }
        : { background: 'transparent', color: 'var(--l-t2)' };

  return (
    <motion.button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      whileHover={reduce ? undefined : { y: -2 }}
      whileTap={{ scale: 0.97, y: 0 }}
      transition={{ type: 'spring', stiffness: 420, damping: 24 }}
      style={style}
      className={`group relative inline-flex select-none items-center justify-center gap-2 overflow-hidden whitespace-nowrap rounded-xl font-bold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[color:var(--l-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--l-bg)] ${
        variant === 'ghost' ? 'hover:bg-[var(--l-card-hover)] hover:text-[color:var(--l-text)]' : ''
      } ${variant === 'secondary' ? 'hover:bg-[var(--l-card-hover)]' : ''} ${BTN_SIZE[size]} ${className}`}
    >
      {variant === 'primary' && !reduce && (
        <motion.span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/3 -skew-x-12 bg-white/35"
          animate={{ left: ['-40%', '140%'] }}
          transition={{ duration: 2.4, repeat: Infinity, repeatDelay: 2, ease: 'easeInOut' }}
        />
      )}
      <span className="relative inline-flex items-center gap-2">
        {children}
        {trailing && <span className="transition-transform duration-200 group-hover:translate-x-1">{trailing}</span>}
      </span>
    </motion.button>
  );
}

function ThemeToggle({ theme, onToggle }: { theme: Theme; onToggle: () => void }) {
  const dark = theme === 'dark';
  return (
    <motion.button
      type="button"
      onClick={onToggle}
      whileHover={{ scale: 1.06 }}
      whileTap={{ scale: 0.92 }}
      aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
      title={dark ? 'Switch to light theme' : 'Switch to dark theme'}
      className="grid h-10 w-10 place-items-center overflow-hidden rounded-xl border outline-none transition-colors hover:bg-[var(--l-card-hover)] focus-visible:ring-2 focus-visible:ring-[color:var(--l-accent)]"
      style={{ borderColor: 'var(--l-line2)', background: 'var(--l-card)', color: 'var(--l-text)' }}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={theme}
          initial={{ rotate: -90, scale: 0.4, opacity: 0 }}
          animate={{ rotate: 0, scale: 1, opacity: 1 }}
          exit={{ rotate: 90, scale: 0.4, opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="grid place-items-center"
        >
          {dark ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
            </svg>
          )}
        </motion.span>
      </AnimatePresence>
    </motion.button>
  );
}

function Counter({ to, suffix }: { to: number; suffix: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const reduce = useReducedMotion();
  const [val, setVal] = useState(0);

  useEffect(() => {
    if (!inView) return;
    if (reduce) {
      setVal(to);
      return;
    }
    const controls = animate(0, to, {
      duration: 1.6,
      ease: 'easeOut',
      onUpdate: (v) => setVal(Math.round(v)),
    });
    return () => controls.stop();
  }, [inView, to, reduce]);

  return (
    <span ref={ref}>
      {val}
      {suffix}
    </span>
  );
}

/* ------------------------------------------------------ interactive demo */

function InteractiveRoster() {
  const [brush, setBrush] = useState<string>('M');
  const [grid, setGrid] = useState<string[][]>(() => DEMO_ROWS.map((r) => [...r.codes]));
  const painting = useRef(false);

  const paint = useCallback(
    (r: number, d: number) => {
      setGrid((g) => {
        if (g[r][d] === brush) return g;
        const next = g.map((row) => [...row]);
        next[r][d] = brush;
        return next;
      });
    },
    [brush],
  );

  useEffect(() => {
    const up = () => {
      painting.current = false;
    };
    window.addEventListener('pointerup', up);
    return () => window.removeEventListener('pointerup', up);
  }, []);

  // Live rule check: night shift followed directly by a morning shift.
  const violations = useMemo(() => {
    const set = new Set<string>();
    grid.forEach((row, r) => {
      for (let d = 0; d < row.length - 1; d++) {
        if (NIGHT.has(row[d]) && MORNING.has(row[d + 1])) set.add(`${r}-${d + 1}`);
      }
    });
    return set;
  }, [grid]);

  const counts = useMemo(
    () => Array.from({ length: DEMO_DAYS }, (_, d) => grid.reduce((n, row) => n + (WORKING.has(row[d]) ? 1 : 0), 0)),
    [grid],
  );

  const reset = () => setGrid(DEMO_ROWS.map((r) => [...r.codes]));
  const cols = `120px repeat(${DEMO_DAYS}, minmax(0, 1fr))`;

  return (
    <div className="overflow-hidden rounded-2xl border" style={{ background: 'var(--l-panel)', borderColor: 'var(--l-line)', boxShadow: 'var(--l-shadow)' }}>
      {/* brush bar */}
      <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3" style={{ borderColor: 'var(--l-line)' }}>
        <span className="mr-1 text-[10.5px] font-semibold uppercase tracking-wider" style={{ color: 'var(--l-t3)' }}>Brush</span>
        {BRUSHES.map((b) => {
          const t = TONES[b];
          const active = brush === b;
          const fg = b === '-' ? 'var(--l-t2)' : t.fg;
          return (
            <button
              key={b}
              type="button"
              onClick={() => setBrush(b)}
              aria-pressed={active}
              title={t.label}
              className="rounded-lg px-3 py-1.5 text-[11.5px] font-bold outline-none transition-all hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-[color:var(--l-accent)]"
              style={{
                background: b === '-' ? 'var(--l-chip)' : t.bg,
                color: fg,
                boxShadow: active ? `0 0 0 1.5px ${fg}` : 'none',
                transform: active ? 'translateY(-1px)' : undefined,
              }}
            >
              {b === '-' ? 'OFF' : b}
            </button>
          );
        })}
        <button
          type="button"
          onClick={reset}
          className="ml-1 rounded-lg px-2.5 py-1.5 text-[11.5px] font-semibold outline-none transition-colors hover:bg-[var(--l-card-hover)] focus-visible:ring-2 focus-visible:ring-[color:var(--l-accent)]"
          style={{ color: 'var(--l-t2)' }}
        >
          Reset
        </button>
        <motion.span
          key={violations.size}
          initial={{ scale: 0.8, opacity: 0.4 }}
          animate={{ scale: 1, opacity: 1 }}
          className="ml-auto rounded-full px-3 py-1 text-[11.5px] font-semibold"
          style={{
            background: violations.size ? 'var(--l-red-bg)' : 'var(--l-green-bg)',
            color: violations.size ? 'var(--l-red)' : 'var(--l-green)',
          }}
        >
          {violations.size ? `${violations.size} rule issue${violations.size > 1 ? 's' : ''}` : '✓ All rules satisfied'}
        </motion.span>
      </div>

      <div className="overflow-x-auto p-3">
        <div
          className="min-w-[640px] select-none"
          onPointerLeave={() => {
            painting.current = false;
          }}
        >
          <div className="mb-1 grid items-center gap-1" style={{ gridTemplateColumns: cols }}>
            <span className="px-2 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--l-t3)' }}>People</span>
            {Array.from({ length: DEMO_DAYS }, (_, d) => (
              <span key={d} className="text-center font-mono text-[10.5px]" style={{ color: 'var(--l-t3)' }}>{d + 1}</span>
            ))}
          </div>

          {DEMO_ROWS.map((row, r) => (
            <div key={row.name} className="mb-1 grid items-center gap-1" style={{ gridTemplateColumns: cols }}>
              <span className="truncate px-2 text-[12px] font-semibold">
                {row.name} <span className="ml-1 text-[10px] font-normal" style={{ color: 'var(--l-t3)' }}>{row.role}</span>
              </span>
              {grid[r].map((code, d) => {
                const t = TONES[code] ?? TONES['-'];
                const bad = violations.has(`${r}-${d}`);
                return (
                  <motion.button
                    key={d}
                    type="button"
                    whileTap={{ scale: 0.85 }}
                    onPointerDown={() => {
                      painting.current = true;
                      paint(r, d);
                    }}
                    onPointerEnter={() => {
                      if (painting.current) paint(r, d);
                    }}
                    className="grid h-8 cursor-crosshair place-items-center rounded-md text-[11px] font-bold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[color:var(--l-accent)]"
                    style={{ background: t.bg, color: t.fg, boxShadow: bad ? '0 0 0 1.5px var(--l-red)' : 'none' }}
                    aria-label={`${row.name} day ${d + 1}: ${t.label}`}
                  >
                    {code === '-' ? '·' : code}
                  </motion.button>
                );
              })}
            </div>
          ))}

          <div className="mt-2 grid items-center gap-1 border-t pt-2" style={{ gridTemplateColumns: cols, borderColor: 'var(--l-line)' }}>
            <span className="px-2 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--l-t3)' }}>Working</span>
            {counts.map((c, d) => (
              <motion.span
                key={`${d}-${c}`}
                initial={{ y: -4, opacity: 0.4 }}
                animate={{ y: 0, opacity: 1 }}
                className="text-center font-mono text-[11px] font-bold"
                style={{ color: c < 2 ? 'var(--l-red)' : 'var(--l-t2)' }}
              >
                {c}
              </motion.span>
            ))}
          </div>
        </div>
      </div>
      <div className="border-t px-4 py-2.5 text-[11.5px]" style={{ borderColor: 'var(--l-line)', color: 'var(--l-t3)' }}>
        Pick a brush, then click or drag across the grid. Paint a Morning right after a Night to trigger a rule issue.
      </div>
    </div>
  );
}

/* --------------------------------------------------------- bento content */

function BentoCard({
  className = '',
  title,
  body,
  children,
  i = 0,
}: {
  className?: string;
  title: string;
  body: string;
  children?: ReactNode;
  i?: number;
}) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const glow = useMotionTemplate`radial-gradient(260px circle at ${x}px ${y}px, rgba(133,147,255,0.18), transparent 70%)`;

  return (
    <Reveal i={i} className={className}>
      <div
        onMouseMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          x.set(e.clientX - r.left);
          y.set(e.clientY - r.top);
        }}
        className="group relative h-full overflow-hidden rounded-2xl border p-6 transition-all duration-300 hover:-translate-y-1 hover:border-[color:var(--l-line2)]"
        style={{ background: 'var(--l-card)', borderColor: 'var(--l-line)' }}
      >
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          style={{ background: glow }}
        />
        <div className="relative">
          <h3 className="text-[17px] font-bold tracking-tight">{title}</h3>
          <p className="mt-1.5 max-w-md text-[13.5px] leading-relaxed" style={{ color: 'var(--l-t2)' }}>{body}</p>
          {children && <div className="mt-5">{children}</div>}
        </div>
      </div>
    </Reveal>
  );
}

function RotationViz() {
  const people = [
    ['M', 'M', 'E', 'E', 'N', 'N'],
    ['E', 'E', 'N', 'N', 'M', 'M'],
    ['N', 'N', 'M', 'M', 'E', 'E'],
  ];
  return (
    <div className="space-y-1.5">
      {people.map((row, r) => (
        <div key={r} className="flex gap-1.5">
          {row.map((c, d) => {
            const t = TONES[c];
            return (
              <motion.span
                key={d}
                initial={{ opacity: 0, scale: 0.5 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.2 + (r * 6 + d) * 0.05 }}
                className="grid h-7 flex-1 place-items-center rounded-md text-[11px] font-bold"
                style={{ background: t.bg, color: t.fg }}
              >
                {c}
              </motion.span>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function RulesViz() {
  const items = [
    { t: 'Night → Morning turnaround', c: 'var(--l-red)' },
    { t: 'Only 1 on Evening, min is 2', c: 'var(--l-amber)' },
    { t: '7 days in a row', c: 'var(--l-amber)' },
  ];
  return (
    <div className="space-y-2">
      {items.map((it, i) => (
        <motion.div
          key={it.t}
          initial={{ opacity: 0, x: -16 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 + i * 0.15 }}
          className="flex items-center gap-2.5 rounded-lg border px-3 py-2 text-[12.5px]"
          style={{ borderColor: 'var(--l-line)', background: 'var(--l-inset)' }}
        >
          <span className="h-2 w-2 rounded-full" style={{ background: it.c, boxShadow: `0 0 10px ${it.c}` }} />
          {it.t}
        </motion.div>
      ))}
    </div>
  );
}

function ExcelFlow() {
  const nodes = [
    { t: 'Your Excel', s: '.xlsx roster', c: 'var(--l-green)' },
    { t: 'ShiftLine', s: 'plan & check', c: 'var(--l-blue)' },
    { t: 'Excel out', s: 'same layout', c: 'var(--l-amber)' },
  ];
  return (
    <div className="relative flex items-center justify-between gap-2">
      <div className="absolute left-[8%] right-[8%] top-1/2 h-px -translate-y-1/2 border-t border-dashed" style={{ borderColor: 'var(--l-line2)' }} />
      <motion.span
        aria-hidden
        className="absolute top-1/2 h-2 w-2 -translate-y-1/2 rounded-full"
        style={{ background: GRADIENT, boxShadow: '0 0 12px var(--l-glow)' }}
        animate={{ left: ['8%', '90%'] }}
        transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
      />
      {nodes.map((n) => (
        <div
          key={n.t}
          className="relative z-10 flex-1 rounded-xl border px-2 py-3 text-center"
          style={{ borderColor: 'var(--l-line)', background: 'var(--l-panel2)' }}
        >
          <div className="text-[13px] font-bold" style={{ color: n.c }}>{n.t}</div>
          <div className="text-[10.5px]" style={{ color: 'var(--l-t3)' }}>{n.s}</div>
        </div>
      ))}
    </div>
  );
}

function FaqItem({ q, a, open, onToggle }: { q: string; a: string; open: boolean; onToggle: () => void }) {
  return (
    <div className="overflow-hidden rounded-xl border transition-colors" style={{ borderColor: open ? 'var(--l-line2)' : 'var(--l-line)', background: 'var(--l-card)' }}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left outline-none transition-colors hover:bg-[var(--l-card-hover)] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[color:var(--l-accent)]"
      >
        <span className="text-[14.5px] font-semibold">{q}</span>
        <motion.span animate={{ rotate: open ? 180 : 0 }} className="shrink-0" style={{ color: 'var(--l-t2)' }}>
          <ChevronDownIcon />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <p className="px-5 pb-4 text-[13.5px] leading-relaxed" style={{ color: 'var(--l-t2)' }}>{a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function NavLink({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg px-3 py-2 text-[13.5px] font-medium outline-none transition-colors hover:bg-[var(--l-card-hover)] hover:text-[color:var(--l-text)] focus-visible:ring-2 focus-visible:ring-[color:var(--l-accent)]"
      style={{ color: 'var(--l-t2)' }}
    >
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ page */

const ROTATING = ['in seconds', 'without the chaos', 'straight from Excel', 'with zero conflicts'];

export function LandingPage({ onOpen }: { onOpen: () => void }) {
  const scroller = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();

  const [theme, setTheme] = useState<Theme>(readInitialTheme);

  // Pick up the planner's saved theme if the visitor hasn't chosen one here.
  useEffect(() => {
    let cancelled = false;
    try {
      if (localStorage.getItem(THEME_KEY)) return;
    } catch {
      /* ignore */
    }
    getSettings()
      .then((s) => {
        if (!cancelled && (s.theme === 'light' || s.theme === 'dark')) setTheme(s.theme);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const toggleTheme = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      /* ignore */
    }
    document.documentElement.dataset.theme = next;
    // Keep the planner on the same theme.
    patchSettings({ theme: next }).catch(() => undefined);
  };

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const { scrollYProgress, scrollY } = useScroll({ container: scroller });
  const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 24 });
  const heroShift = useTransform(scrollY, [0, 600], [0, 120]);
  const heroFade = useTransform(scrollY, [0, 500], [1, 0.2]);

  const [scrolled, setScrolled] = useState(false);
  const [word, setWord] = useState(0);
  const [faq, setFaq] = useState<number | null>(0);

  useEffect(() => scrollY.on('change', (v) => setScrolled(v > 24)), [scrollY]);

  useEffect(() => {
    if (reduce) return;
    const t = setInterval(() => setWord((w) => (w + 1) % ROTATING.length), 2600);
    return () => clearInterval(t);
  }, [reduce]);

  // Mouse spotlight + 3D tilt for the hero.
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const spot = useMotionTemplate`radial-gradient(520px circle at ${mx}px ${my}px, rgba(109,139,255,0.14), transparent 65%)`;
  const tiltX = useSpring(useMotionValue(0), { stiffness: 120, damping: 18 });
  const tiltY = useSpring(useMotionValue(0), { stiffness: 120, damping: 18 });

  const onHeroMove = (e: ReactMouseEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    mx.set(e.clientX - r.left);
    my.set(e.clientY - r.top);
    if (!reduce) {
      tiltY.set(px * 10);
      tiltX.set(-py * 8);
    }
  };
  const onHeroLeave = () => {
    tiltX.set(0);
    tiltY.set(0);
  };

  const goTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const rootStyle = {
    ...PALETTES[theme],
    background: 'var(--l-bg)',
    color: 'var(--l-text)',
    fontFamily: 'Inter, system-ui, sans-serif',
    scrollBehavior: 'smooth',
    transition: 'background-color 0.35s ease, color 0.35s ease',
    colorScheme: theme,
  } as CSSProperties;

  return (
    <div ref={scroller} className="fixed inset-0 overflow-y-auto overflow-x-hidden" style={rootStyle}>
      <motion.div
        className="fixed left-0 right-0 top-0 z-[60] h-[3px] origin-left"
        style={{ scaleX: progress, background: GRADIENT }}
      />

      {/* ---------------------------------------------------------- nav */}
      <nav
        className="sticky top-0 z-50 transition-all duration-300"
        style={{
          background: scrolled ? 'var(--l-nav)' : 'transparent',
          backdropFilter: scrolled ? 'blur(14px)' : 'none',
          borderBottom: scrolled ? '1px solid var(--l-line)' : '1px solid transparent',
        }}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 py-3">
          <button
            type="button"
            onClick={() => scroller.current?.scrollTo({ top: 0, behavior: 'smooth' })}
            className="flex items-center gap-2.5 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--l-accent)]"
            aria-label="ShiftLine, back to top"
          >
            <Mark size={32} />
            <span className="text-[18px] font-extrabold tracking-tight">
              Shift<span style={{ color: 'var(--l-accent)' }}>Line</span>
            </span>
          </button>
          <div className="hidden items-center gap-1 md:flex">
            <NavLink onClick={() => goTo('demo')}>Live demo</NavLink>
            <NavLink onClick={() => goTo('features')}>Features</NavLink>
            <NavLink onClick={() => goTo('flow')}>Excel workflow</NavLink>
            <NavLink onClick={() => goTo('faq')}>FAQ</NavLink>
          </div>
          <div className="flex items-center gap-2.5">
            <ThemeToggle theme={theme} onToggle={toggleTheme} />
            <Btn size="sm" onClick={onOpen} trailing={<ArrowIcon />}>
              Open Roster
            </Btn>
          </div>
        </div>
      </nav>

      {/* --------------------------------------------------------- hero */}
      <header
        onMouseMove={onHeroMove}
        onMouseLeave={onHeroLeave}
        className="relative -mt-[62px] overflow-hidden pb-20 pt-32 sm:pt-40"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              'linear-gradient(var(--l-grid) 1px,transparent 1px),linear-gradient(90deg,var(--l-grid) 1px,transparent 1px)',
            backgroundSize: '56px 56px',
            maskImage: 'radial-gradient(ellipse 70% 60% at 50% 30%, #000 30%, transparent 75%)',
            WebkitMaskImage: 'radial-gradient(ellipse 70% 60% at 50% 30%, #000 30%, transparent 75%)',
          }}
        />
        <motion.div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: spot }} />
        {[
          { c: '#F5B040', cls: '-left-40 -top-32 h-[480px] w-[480px]', dx: 60, dy: 40, d: 14 },
          { c: '#8593FF', cls: 'right-[-80px] top-0 h-[460px] w-[460px]', dx: -50, dy: 50, d: 16 },
          { c: '#34CDD3', cls: 'left-1/3 top-48 h-[340px] w-[340px]', dx: 40, dy: -30, d: 18 },
        ].map((o) => (
          <motion.div
            key={o.c}
            aria-hidden
            className={`pointer-events-none absolute rounded-full blur-[110px] ${o.cls}`}
            style={{ background: o.c, opacity: 'var(--l-orb)' as unknown as number }}
            animate={reduce ? undefined : { x: [0, o.dx, 0], y: [0, o.dy, 0] }}
            transition={{ duration: o.d, repeat: Infinity, ease: 'easeInOut' }}
          />
        ))}

        {!reduce &&
          [
            { c: 'M', cls: 'left-[7%] top-[28%]', d: 5 },
            { c: 'N', cls: 'right-[8%] top-[24%]', d: 6.5 },
            { c: 'E', cls: 'left-[12%] top-[58%]', d: 7 },
            { c: 'LV', cls: 'right-[11%] top-[52%]', d: 5.5 },
          ].map((f) => {
            const t = TONES[f.c];
            return (
              <motion.span
                key={f.c}
                aria-hidden
                className={`pointer-events-none absolute hidden rounded-lg border px-3 py-1.5 text-[13px] font-bold lg:block ${f.cls}`}
                style={{
                  background: t.bg,
                  color: t.fg,
                  borderColor: 'var(--l-line)',
                  boxShadow: `0 12px 40px -10px color-mix(in srgb, ${t.fg} 45%, transparent)`,
                }}
                animate={{ y: [0, -16, 0], rotate: [-3, 3, -3] }}
                transition={{ duration: f.d, repeat: Infinity, ease: 'easeInOut' }}
              >
                {f.c}
              </motion.span>
            );
          })}

        <motion.div style={{ y: heroShift, opacity: heroFade }} className="relative z-10 mx-auto max-w-6xl px-5 text-center">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
            <Eyebrow>Shift planning for operational teams</Eyebrow>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1 }}
            className="mx-auto mt-7 max-w-4xl text-[42px] font-extrabold leading-[1.04] tracking-tight sm:text-[72px]"
          >
            Build the monthly roster
            <br />
            <span className="relative inline-block">
              <AnimatePresence mode="wait">
                <motion.span
                  key={word}
                  initial={{ opacity: 0, y: 24, filter: 'blur(8px)' }}
                  animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, y: -24, filter: 'blur(8px)' }}
                  transition={{ duration: 0.45 }}
                  className="inline-block"
                >
                  <GradientText>{ROTATING[word]}.</GradientText>
                </motion.span>
              </AnimatePresence>
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.3 }}
            className="mx-auto mt-7 max-w-2xl text-[16px] leading-relaxed sm:text-[18px]"
            style={{ color: 'var(--l-t2)' }}
          >
            ShiftLine imports your Excel roster, rotates Morning, Evening and Night shifts fairly, checks the
            rules as you edit, and exports the exact sheet your managers expect.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.45 }}
            className="mt-10 flex flex-wrap items-center justify-center gap-3"
          >
            <Btn size="lg" onClick={onOpen} trailing={<ArrowIcon />}>
              Open Roster
            </Btn>
            <Btn size="lg" variant="secondary" onClick={() => goTo('demo')} trailing={<ChevronDownIcon />}>
              Try the live demo
            </Btn>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="mt-5 text-[12.5px]"
            style={{ color: 'var(--l-t3)' }}
          >
            No sign-up · Runs in your browser · Your data never leaves your device
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 60 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.6, ease: 'easeOut' }}
            style={{ perspective: 1400 }}
            className="mx-auto mt-16 max-w-4xl"
          >
            <motion.div
              style={{ rotateX: tiltX, rotateY: tiltY, transformStyle: 'preserve-3d', borderColor: 'var(--l-line)' }}
              className="overflow-hidden rounded-2xl border text-left"
            >
              <div style={{ background: 'var(--l-panel2)', boxShadow: 'var(--l-shadow)' }}>
                <div className="flex items-center gap-1.5 border-b px-4 py-2.5" style={{ borderColor: 'var(--l-line)' }}>
                  <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
                  <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
                  <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
                  <span className="ml-3 text-[11.5px]" style={{ color: 'var(--l-t3)' }}>Line 5 · September 2026</span>
                  <span className="ml-auto flex items-center gap-1.5 text-[11px]" style={{ color: 'var(--l-green)' }}>
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full" style={{ background: 'var(--l-green)' }} /> Saved
                  </span>
                </div>
                <HeroGrid />
              </div>
            </motion.div>
          </motion.div>
        </motion.div>
      </header>

      {/* ------------------------------------------------------ marquee */}
      <section className="relative border-y py-5" aria-label="Capabilities" style={{ borderColor: 'var(--l-line)', background: 'var(--l-card)' }}>
        <div
          className="overflow-hidden"
          style={{
            maskImage: 'linear-gradient(90deg,transparent,#000 12%,#000 88%,transparent)',
            WebkitMaskImage: 'linear-gradient(90deg,transparent,#000 12%,#000 88%,transparent)',
          }}
        >
          <motion.div
            className="flex w-max gap-10 whitespace-nowrap"
            animate={reduce ? undefined : { x: ['0%', '-50%'] }}
            transition={{ duration: 36, repeat: Infinity, ease: 'linear' }}
          >
            {[...MARQUEE, ...MARQUEE].map((m, i) => (
              <span key={i} className="flex items-center gap-10 text-[14px] font-semibold" style={{ color: 'var(--l-t3)' }}>
                {m}
                <span className="h-1 w-1 rounded-full" style={{ background: GRADIENT }} />
              </span>
            ))}
          </motion.div>
        </div>
      </section>

      {/* -------------------------------------------------------- stats */}
      <section className="mx-auto max-w-5xl px-5 py-20">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {STATS.map((s, i) => (
            <Reveal key={s.l} i={i} className="h-full">
              <div className="h-full rounded-2xl border p-5 text-center" style={{ borderColor: 'var(--l-line)', background: 'var(--l-card)' }}>
                <div className="text-[34px] font-extrabold leading-none">
                  <GradientText>
                    <Counter to={s.to} suffix={s.suffix} />
                  </GradientText>
                </div>
                <div className="mt-2 text-[12.5px] leading-snug" style={{ color: 'var(--l-t2)' }}>{s.l}</div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* --------------------------------------------------------- demo */}
      <section id="demo" className="mx-auto max-w-5xl scroll-mt-20 px-5 py-16">
        <Reveal className="mx-auto mb-10 max-w-2xl text-center">
          <Eyebrow>Live demo</Eyebrow>
          <h2 className="mt-5 text-[32px] font-extrabold tracking-tight sm:text-[46px]">
            Paint a roster. <GradientText>Feel the rules.</GradientText>
          </h2>
          <p className="mt-3 text-[15px]" style={{ color: 'var(--l-t2)' }}>
            This is the real interaction model: choose a shift code and paint it across the grid. Headcounts and rule
            checks update instantly.
          </p>
        </Reveal>
        <Reveal>
          <InteractiveRoster />
        </Reveal>
      </section>

      {/* ------------------------------------------------------ features */}
      <section id="features" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-20">
        <Reveal className="mx-auto mb-12 max-w-2xl text-center">
          <Eyebrow>Features</Eyebrow>
          <h2 className="mt-5 text-[32px] font-extrabold tracking-tight sm:text-[46px]">
            Everything a roster needs, <GradientText>nothing it doesn't.</GradientText>
          </h2>
        </Reveal>

        <div className="grid gap-4 md:grid-cols-6">
          <BentoCard
            i={0}
            className="md:col-span-3"
            title="Fair auto-rotation"
            body="Generate a whole month in one click. Morning, Evening and Night rotate using each person's history, so nobody is stuck on nights."
          >
            <RotationViz />
          </BentoCard>
          <BentoCard
            i={1}
            className="md:col-span-3"
            title="Live rule checking"
            body="Night-to-morning turnarounds, too many days in a row, empty shifts and work-while-on-leave are flagged as you edit."
          >
            <RulesViz />
          </BentoCard>
          <BentoCard i={2} className="md:col-span-2" title="Import any Excel" body="Headers, days, verbose shift text and leave blocks are read automatically. Unknown codes are created for you." />
          <BentoCard i={3} className="md:col-span-2" title="Export the same layout" body="Operational roster export with PIC/MP sections, date headers, timings, total OT and count rows." />
          <BentoCard i={4} className="md:col-span-2" title="Headcount rail" body="See who is on each shift every day, with per-person coverage breakdowns in one glance." />
          <BentoCard i={5} className="md:col-span-2" title="Multi-line teams" body="Each line owns its people and months. Shift codes are shared, so a code added once works everywhere." />
          <BentoCard i={6} className="md:col-span-2" title="Undo, zoom, fonts" body="Full undo/redo, zoom controls and font options keep large rosters comfortable on any screen." />
          <BentoCard i={7} className="md:col-span-2" title="Private & offline" body="Data lives in your browser. Save downloads a full Excel backup; restore from JSON or Excel anytime." />
        </div>
      </section>

      {/* ---------------------------------------------------- excel flow */}
      <section id="flow" className="mx-auto max-w-5xl scroll-mt-20 px-5 py-20">
        <div className="grid items-center gap-10 md:grid-cols-2">
          <Reveal>
            <Eyebrow>Excel workflow</Eyebrow>
            <h2 className="mt-5 text-[30px] font-extrabold leading-tight tracking-tight sm:text-[40px]">
              Excel in. <GradientText>Excel out.</GradientText>
            </h2>
            <p className="mt-4 text-[15px] leading-relaxed" style={{ color: 'var(--l-t2)' }}>
              Keep working the way your department already does. Upload last month's sheet, let ShiftLine read every
              name, day and shift, plan the new month, then download a file laid out exactly like the original.
            </p>
            <ul className="mt-6 space-y-3 text-[14px]" style={{ color: 'var(--l-t2)' }}>
              {[
                'Detects name, role and day columns automatically',
                'Understands "Morning Early | 07:30-18:00 | 11H" style cells',
                'Creates missing shift codes with sensible colours',
                'Exports sections, date headers and working counts',
              ].map((t) => (
                <li key={t} className="flex gap-3">
                  <span
                    className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] font-bold"
                    style={{ background: GRADIENT, color: 'var(--l-btn-ink)' }}
                  >
                    ✓
                  </span>
                  {t}
                </li>
              ))}
            </ul>
          </Reveal>
          <Reveal i={2}>
            <div className="rounded-2xl border p-6" style={{ borderColor: 'var(--l-line)', background: 'var(--l-card)' }}>
              <ExcelFlow />
              <div
                className="mt-6 space-y-1.5 rounded-xl border p-3 font-mono text-[11px]"
                style={{ borderColor: 'var(--l-line)', background: 'var(--l-inset)', color: 'var(--l-t2)' }}
              >
                <div><span style={{ color: 'var(--l-green)' }}>in </span> Morning Early | 07:30-18:00 | 11H</div>
                <div><span style={{ color: 'var(--l-blue)' }}>map</span> → <span style={{ color: 'var(--l-amber)' }}>M</span></div>
                <div><span style={{ color: 'var(--l-green)' }}>in </span> Annual leave</div>
                <div><span style={{ color: 'var(--l-blue)' }}>map</span> → <span style={{ color: 'var(--l-red)' }}>LV</span></div>
                <div><span style={{ color: 'var(--l-amber)' }}>out</span> Morning | 06:00-15:00 | 9H</div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ----------------------------------------------------- how steps */}
      <section className="mx-auto max-w-5xl px-5 py-16">
        <Reveal className="mb-12 text-center">
          <h2 className="text-[30px] font-extrabold tracking-tight sm:text-[42px]">Three steps. That's it.</h2>
        </Reveal>
        <div className="relative grid gap-5 sm:grid-cols-3">
          <div aria-hidden className="absolute left-[16%] right-[16%] top-9 hidden h-px border-t border-dashed sm:block" style={{ borderColor: 'var(--l-line2)' }} />
          {[
            ['01', 'Import', 'Upload your existing Excel roster, or start from the demo month.'],
            ['02', 'Plan', 'Generate, rotate and paint shifts. Rule checks guide you as you go.'],
            ['03', 'Export', 'Download the Excel your managers expect, in the layout you imported.'],
          ].map(([n, t, b], i) => (
            <Reveal key={n} i={i}>
              <div className="relative h-full rounded-2xl border p-6 text-center" style={{ borderColor: 'var(--l-line)', background: 'var(--l-card)' }}>
                <span
                  className="relative z-10 mx-auto grid h-[72px] w-[72px] place-items-center rounded-2xl border text-[26px] font-extrabold"
                  style={{ borderColor: 'var(--l-line)', background: 'var(--l-panel2)' }}
                >
                  <GradientText>{n}</GradientText>
                </span>
                <h3 className="mt-4 text-[18px] font-bold">{t}</h3>
                <p className="mt-1.5 text-[13.5px] leading-relaxed" style={{ color: 'var(--l-t2)' }}>{b}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ---------------------------------------------------------- faq */}
      <section id="faq" className="mx-auto max-w-3xl scroll-mt-20 px-5 py-20">
        <Reveal className="mb-10 text-center">
          <Eyebrow>FAQ</Eyebrow>
          <h2 className="mt-5 text-[30px] font-extrabold tracking-tight sm:text-[42px]">Questions, answered</h2>
        </Reveal>
        <div className="space-y-3">
          {FAQ.map((f, i) => (
            <Reveal key={f.q} i={i}>
              <FaqItem q={f.q} a={f.a} open={faq === i} onToggle={() => setFaq(faq === i ? null : i)} />
            </Reveal>
          ))}
        </div>
      </section>

      {/* ----------------------------------------------------------- cta */}
      <section className="mx-auto max-w-5xl px-5 pb-24 pt-8">
        <Reveal>
          <div
            className="relative overflow-hidden rounded-3xl border p-10 text-center sm:p-16"
            style={{ background: 'var(--l-cta)', borderColor: 'var(--l-line)' }}
          >
            <motion.div
              aria-hidden
              className="absolute -right-24 -top-24 h-72 w-72 rounded-full blur-[90px]"
              style={{ background: '#34CDD3', opacity: 'var(--l-orb)' as unknown as number }}
              animate={reduce ? undefined : { scale: [1, 1.25, 1] }}
              transition={{ duration: 8, repeat: Infinity }}
            />
            <motion.div
              aria-hidden
              className="absolute -bottom-24 -left-24 h-72 w-72 rounded-full blur-[90px]"
              style={{ background: '#F5B040', opacity: 'var(--l-orb)' as unknown as number }}
              animate={reduce ? undefined : { scale: [1.2, 1, 1.2] }}
              transition={{ duration: 9, repeat: Infinity }}
            />
            <h2 className="relative text-[30px] font-extrabold tracking-tight sm:text-[46px]">
              Ready to plan your <GradientText>next month?</GradientText>
            </h2>
            <p className="relative mx-auto mt-4 max-w-lg text-[15px]" style={{ color: 'var(--l-t2)' }}>
              Open the roster and start with the demo, or import your own Excel. It takes less than a minute.
            </p>
            <div className="relative mt-9 flex justify-center">
              <Btn size="lg" onClick={onOpen} trailing={<ArrowIcon />}>
                Open Roster
              </Btn>
            </div>
          </div>
        </Reveal>
      </section>

      {/* -------------------------------------------------------- footer */}
      <footer className="border-t px-5 py-10" style={{ borderColor: 'var(--l-line)' }}>
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-5 sm:flex-row">
          <div className="flex items-center gap-2.5">
            <Mark size={28} />
            <span className="text-[15px] font-extrabold tracking-tight">
              Shift<span style={{ color: 'var(--l-accent)' }}>Line</span>
            </span>
          </div>
          <div className="flex flex-wrap justify-center gap-1">
            <NavLink onClick={() => goTo('demo')}>Live demo</NavLink>
            <NavLink onClick={() => goTo('features')}>Features</NavLink>
            <NavLink onClick={() => goTo('faq')}>FAQ</NavLink>
            <NavLink onClick={onOpen}>Open Roster</NavLink>
          </div>
          <span className="text-[12px]" style={{ color: 'var(--l-t3)' }}>Roster planning for operational teams</span>
        </div>
      </footer>
    </div>
  );
}

/** Small auto-animating grid used inside the hero preview. */
function HeroGrid() {
  const [tick, setTick] = useState(0);
  const reduce = useReducedMotion();
  useEffect(() => {
    if (reduce) return;
    const t = setInterval(() => setTick((n) => n + 1), 900);
    return () => clearInterval(t);
  }, [reduce]);

  const days = 12;
  const cols = `150px repeat(${days}, minmax(0, 1fr))`;
  return (
    <div className="overflow-x-auto p-3">
      <div className="min-w-[620px]">
        <div className="mb-1 grid items-center gap-1" style={{ gridTemplateColumns: cols }}>
          <span className="px-2 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--l-t3)' }}>People</span>
          {Array.from({ length: days }, (_, d) => (
            <span key={d} className="text-center font-mono text-[10.5px]" style={{ color: 'var(--l-t3)' }}>{d + 1}</span>
          ))}
        </div>
        {DEMO_ROWS.map((row, r) => (
          <div key={row.name} className="mb-1 grid items-center gap-1" style={{ gridTemplateColumns: cols }}>
            <span className="truncate px-2 text-[12px] font-semibold">
              {row.name} <span className="ml-1 text-[10px] font-normal" style={{ color: 'var(--l-t3)' }}>{row.role}</span>
            </span>
            {row.codes.slice(0, days).map((code, d) => {
              const t = TONES[code] ?? TONES['-'];
              const lit = (tick + r * 2) % days === d;
              return (
                <motion.span
                  key={d}
                  initial={{ opacity: 0, scale: 0.6 }}
                  animate={{ opacity: 1, scale: lit ? 1.12 : 1 }}
                  transition={{ delay: 0.9 + (r * days + d) * 0.012, duration: 0.3 }}
                  className="grid h-8 place-items-center rounded-md text-[11px] font-bold"
                  style={{ background: t.bg, color: t.fg, boxShadow: lit ? `0 0 0 1.5px ${t.fg}` : 'none' }}
                >
                  {code === '-' ? '·' : code}
                </motion.span>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function Mark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-label="ShiftLine" role="img" className="shrink-0">
      <rect width="64" height="64" rx="15" fill="#151b30" />
      <rect x="0.75" y="0.75" width="62.5" height="62.5" rx="14.25" fill="none" stroke="#fff" strokeOpacity="0.14" strokeWidth="1.5" />
      <rect x="11" y="15" width="32" height="9" rx="4.5" fill="#F5B040" />
      <rect x="16.5" y="27.5" width="32" height="9" rx="4.5" fill="#34CDD3" />
      <rect x="22" y="40" width="32" height="9" rx="4.5" fill="#8593FF" />
    </svg>
  );
}
