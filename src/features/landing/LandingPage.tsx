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
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

/**
 * Landing page shown before the planner.
 *
 * Self-contained: fixed dark palette and its own scroll container (the app
 * root is height-locked), so it looks identical whatever theme the planner
 * was last left in. Motion respects `prefers-reduced-motion`.
 */

/* ------------------------------------------------------------------ data */

const TONES: Record<string, { bg: string; fg: string; label: string }> = {
  M: { bg: '#4a3512', fg: '#F5B040', label: 'Morning' },
  E: { bg: '#10393b', fg: '#34CDD3', label: 'Evening' },
  N: { bg: '#232a5c', fg: '#8593FF', label: 'Night' },
  ML: { bg: '#3d2c10', fg: '#e8a23a', label: 'Morning Late' },
  NL: { bg: '#1d2350', fg: '#7080f0', label: 'Night Late' },
  LV: { bg: '#4a1a22', fg: '#ff6b7a', label: 'Leave' },
  '-': { bg: 'transparent', fg: '#3b4256', label: 'Off' },
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

const GRADIENT = 'linear-gradient(90deg,#F5B040,#34CDD3 55%,#8593FF)';

function GradientText({ children }: { children: ReactNode }) {
  return (
    <span className="bg-clip-text text-transparent" style={{ backgroundImage: GRADIENT }}>
      {children}
    </span>
  );
}

function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-1.5 text-[11.5px] font-semibold uppercase tracking-[0.14em] text-[#b9c2da]">
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: GRADIENT }} />
      {children}
    </span>
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
    const up = () => (painting.current = false);
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
    () =>
      Array.from({ length: DEMO_DAYS }, (_, d) => grid.reduce((n, row) => n + (WORKING.has(row[d]) ? 1 : 0), 0)),
    [grid],
  );

  const cols = `120px repeat(${DEMO_DAYS}, minmax(0, 1fr))`;

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10" style={{ background: '#0d111d' }}>
      {/* brush bar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-white/10 px-4 py-3">
        <span className="mr-1 text-[10.5px] font-semibold uppercase tracking-wider text-[#5c6680]">Brush</span>
        {BRUSHES.map((b) => {
          const t = TONES[b];
          const active = brush === b;
          return (
            <button
              key={b}
              onClick={() => setBrush(b)}
              className="rounded-md px-2.5 py-1 text-[11.5px] font-bold transition-all"
              style={{
                background: t.bg === 'transparent' ? '#1a2033' : t.bg,
                color: t.fg === '#3b4256' ? '#8b95ae' : t.fg,
                boxShadow: active ? `0 0 0 1.5px ${t.fg === '#3b4256' ? '#8b95ae' : t.fg}` : 'none',
                transform: active ? 'translateY(-1px)' : 'none',
              }}
              title={t.label}
            >
              {b === '-' ? 'OFF' : b}
            </button>
          );
        })}
        <motion.span
          key={violations.size}
          initial={{ scale: 0.8, opacity: 0.4 }}
          animate={{ scale: 1, opacity: 1 }}
          className="ml-auto rounded-full px-3 py-1 text-[11.5px] font-semibold"
          style={{
            background: violations.size ? '#3a1820' : '#10301f',
            color: violations.size ? '#ff6b7a' : '#4ade80',
          }}
        >
          {violations.size ? `${violations.size} rule issue${violations.size > 1 ? 's' : ''}` : '✓ All rules satisfied'}
        </motion.span>
      </div>

      <div className="overflow-x-auto p-3">
        <div className="min-w-[640px] select-none" onPointerLeave={() => (painting.current = false)}>
          <div className="mb-1 grid items-center gap-1" style={{ gridTemplateColumns: cols }}>
            <span className="px-2 text-[10px] font-semibold uppercase tracking-wider text-[#5c6680]">People</span>
            {Array.from({ length: DEMO_DAYS }, (_, d) => (
              <span key={d} className="text-center font-mono text-[10.5px] text-[#5c6680]">{d + 1}</span>
            ))}
          </div>

          {DEMO_ROWS.map((row, r) => (
            <div key={row.name} className="mb-1 grid items-center gap-1" style={{ gridTemplateColumns: cols }}>
              <span className="truncate px-2 text-[12px] font-semibold">
                {row.name} <span className="ml-1 text-[10px] font-normal text-[#5c6680]">{row.role}</span>
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
                    onPointerEnter={() => painting.current && paint(r, d)}
                    className="grid h-8 cursor-crosshair place-items-center rounded-md text-[11px] font-bold transition-colors"
                    style={{
                      background: t.bg,
                      color: t.fg,
                      boxShadow: bad ? '0 0 0 1.5px #ff6b7a' : 'none',
                    }}
                    aria-label={`${row.name} day ${d + 1}: ${t.label}`}
                  >
                    {code === '-' ? '·' : code}
                  </motion.button>
                );
              })}
            </div>
          ))}

          <div className="mt-2 grid items-center gap-1 border-t border-white/10 pt-2" style={{ gridTemplateColumns: cols }}>
            <span className="px-2 text-[10px] font-semibold uppercase tracking-wider text-[#5c6680]">Working</span>
            {counts.map((c, d) => (
              <motion.span
                key={`${d}-${c}`}
                initial={{ y: -4, opacity: 0.4 }}
                animate={{ y: 0, opacity: 1 }}
                className="text-center font-mono text-[11px] font-bold"
                style={{ color: c < 2 ? '#ff6b7a' : '#8b95ae' }}
              >
                {c}
              </motion.span>
            ))}
          </div>
        </div>
      </div>
      <div className="border-t border-white/10 px-4 py-2.5 text-[11.5px] text-[#6c7690]">
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
  const glow = useMotionTemplate`radial-gradient(260px circle at ${x}px ${y}px, rgba(133,147,255,0.16), transparent 70%)`;

  return (
    <Reveal i={i} className={className}>
      <div
        onMouseMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          x.set(e.clientX - r.left);
          y.set(e.clientY - r.top);
        }}
        className="group relative h-full overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition-colors hover:border-white/25"
      >
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          style={{ background: glow }}
        />
        <div className="relative">
          <h3 className="text-[17px] font-bold tracking-tight">{title}</h3>
          <p className="mt-1.5 max-w-md text-[13.5px] leading-relaxed text-[#8b95ae]">{body}</p>
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
    { t: 'Night → Morning turnaround', c: '#ff6b7a' },
    { t: 'Only 1 on Evening, min is 2', c: '#F5B040' },
    { t: '7 days in a row', c: '#F5B040' },
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
          className="flex items-center gap-2.5 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-[12.5px]"
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
    { t: 'Your Excel', s: '.xlsx roster', c: '#4ade80' },
    { t: 'ShiftLine', s: 'plan & check', c: '#8593FF' },
    { t: 'Excel out', s: 'same layout', c: '#F5B040' },
  ];
  return (
    <div className="relative flex items-center justify-between gap-2">
      <div className="absolute left-[8%] right-[8%] top-1/2 h-px -translate-y-1/2 border-t border-dashed border-white/20" />
      <motion.span
        aria-hidden
        className="absolute top-1/2 h-2 w-2 -translate-y-1/2 rounded-full"
        style={{ background: GRADIENT, boxShadow: '0 0 12px #34CDD3' }}
        animate={{ left: ['8%', '90%'] }}
        transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
      />
      {nodes.map((n) => (
        <div key={n.t} className="relative z-10 flex-1 rounded-xl border border-white/10 bg-[#0f1320] px-2 py-3 text-center">
          <div className="text-[13px] font-bold" style={{ color: n.c }}>{n.t}</div>
          <div className="text-[10.5px] text-[#6c7690]">{n.s}</div>
        </div>
      ))}
    </div>
  );
}

function FaqItem({ q, a, open, onToggle }: { q: string; a: string; open: boolean; onToggle: () => void }) {
  return (
    <div className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]">
      <button onClick={onToggle} className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left" aria-expanded={open}>
        <span className="text-[14.5px] font-semibold">{q}</span>
        <motion.span animate={{ rotate: open ? 45 : 0 }} className="text-[20px] leading-none text-[#8b95ae]">+</motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <p className="px-5 pb-4 text-[13.5px] leading-relaxed text-[#8b95ae]">{a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ------------------------------------------------------------------ page */

const ROTATING = ['in seconds', 'without the chaos', 'straight from Excel', 'with zero conflicts'];

export function LandingPage({ onOpen }: { onOpen: () => void }) {
  const scroller = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();

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

  const onHeroMove = (e: React.MouseEvent<HTMLElement>) => {
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

  return (
    <div
      ref={scroller}
      className="fixed inset-0 overflow-y-auto overflow-x-hidden text-[#e8ecf6]"
      style={{ background: '#080b14', fontFamily: 'Inter, system-ui, sans-serif', scrollBehavior: 'smooth' }}
    >
      <motion.div
        className="fixed left-0 right-0 top-0 z-[60] h-[3px] origin-left"
        style={{ scaleX: progress, background: GRADIENT }}
      />

      {/* ---------------------------------------------------------- nav */}
      <nav
        className="sticky top-0 z-50 transition-all duration-300"
        style={{
          background: scrolled ? 'rgba(8,11,20,0.72)' : 'transparent',
          backdropFilter: scrolled ? 'blur(14px)' : 'none',
          borderBottom: scrolled ? '1px solid rgba(255,255,255,0.08)' : '1px solid transparent',
        }}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5">
          <button onClick={() => scroller.current?.scrollTo({ top: 0, behavior: 'smooth' })} className="flex items-center gap-2.5">
            <Mark size={32} />
            <span className="text-[18px] font-extrabold tracking-tight">
              Shift<span style={{ color: '#6d8bff' }}>Line</span>
            </span>
          </button>
          <div className="hidden items-center gap-8 text-[13.5px] text-[#9aa4bd] md:flex">
            {[
              ['demo', 'Live demo'],
              ['features', 'Features'],
              ['flow', 'Excel workflow'],
              ['faq', 'FAQ'],
            ].map(([id, label]) => (
              <button key={id} onClick={() => goTo(id)} className="transition-colors hover:text-white">
                {label}
              </button>
            ))}
          </div>
          <motion.button
            onClick={onOpen}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            className="rounded-lg px-4 py-2 text-[13px] font-bold text-[#0b0d12]"
            style={{ background: GRADIENT }}
          >
            Open Roster
          </motion.button>
        </div>
      </nav>

      {/* --------------------------------------------------------- hero */}
      <header
        onMouseMove={onHeroMove}
        onMouseLeave={onHeroLeave}
        className="relative -mt-[62px] overflow-hidden pb-20 pt-32 sm:pt-40"
      >
        {/* grid + spotlight + orbs */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.045) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.045) 1px,transparent 1px)',
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
            className={`pointer-events-none absolute rounded-full opacity-25 blur-[110px] ${o.cls}`}
            style={{ background: o.c }}
            animate={reduce ? undefined : { x: [0, o.dx, 0], y: [0, o.dy, 0] }}
            transition={{ duration: o.d, repeat: Infinity, ease: 'easeInOut' }}
          />
        ))}

        {/* floating shift chips */}
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
                className={`pointer-events-none absolute hidden rounded-lg border border-white/10 px-3 py-1.5 text-[13px] font-bold lg:block ${f.cls}`}
                style={{ background: t.bg, color: t.fg, boxShadow: `0 12px 40px -10px ${t.fg}66` }}
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
            className="mx-auto mt-7 max-w-2xl text-[16px] leading-relaxed text-[#9aa4bd] sm:text-[18px]"
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
            <motion.button
              onClick={onOpen}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.97 }}
              className="group relative overflow-hidden rounded-xl px-8 py-4 text-[15.5px] font-bold text-[#0b0d12]"
              style={{ background: GRADIENT, boxShadow: '0 14px 50px -12px #34CDD3cc' }}
            >
              <motion.span
                aria-hidden
                className="absolute inset-y-0 -left-1/2 w-1/3 -skew-x-12 bg-white/40"
                animate={reduce ? undefined : { left: ['-40%', '140%'] }}
                transition={{ duration: 2.4, repeat: Infinity, repeatDelay: 1.4, ease: 'easeInOut' }}
              />
              <span className="relative flex items-center gap-2">
                Open Roster
                <span className="transition-transform group-hover:translate-x-1">→</span>
              </span>
            </motion.button>
            <button
              onClick={() => goTo('demo')}
              className="rounded-xl border border-white/15 bg-white/[0.03] px-7 py-4 text-[15.5px] font-semibold text-[#cdd5ea] backdrop-blur transition-colors hover:bg-white/[0.08]"
            >
              Try the live demo ↓
            </button>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="mt-5 text-[12.5px] text-[#6c7690]"
          >
            No sign-up · Runs in your browser · Your data never leaves your device
          </motion.p>

          {/* tilting preview */}
          <motion.div
            initial={{ opacity: 0, y: 60 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.6, ease: 'easeOut' }}
            style={{ perspective: 1400 }}
            className="mx-auto mt-16 max-w-4xl"
          >
            <motion.div
              style={{ rotateX: tiltX, rotateY: tiltY, transformStyle: 'preserve-3d' }}
              className="overflow-hidden rounded-2xl border border-white/10 text-left"
            >
              <div style={{ background: '#0f1320', boxShadow: '0 50px 120px -30px #000' }}>
                <div className="flex items-center gap-1.5 border-b border-white/10 px-4 py-2.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
                  <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
                  <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
                  <span className="ml-3 text-[11.5px] text-[#6c7690]">Line 5 · September 2026</span>
                  <span className="ml-auto flex items-center gap-1.5 text-[11px] text-[#4ade80]">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#4ade80]" /> Saved
                  </span>
                </div>
                <HeroGrid />
              </div>
            </motion.div>
          </motion.div>
        </motion.div>
      </header>

      {/* ------------------------------------------------------ marquee */}
      <section className="relative border-y border-white/10 bg-white/[0.02] py-5" aria-label="Capabilities">
        <div className="overflow-hidden" style={{ maskImage: 'linear-gradient(90deg,transparent,#000 12%,#000 88%,transparent)', WebkitMaskImage: 'linear-gradient(90deg,transparent,#000 12%,#000 88%,transparent)' }}>
          <motion.div
            className="flex w-max gap-10 whitespace-nowrap"
            animate={reduce ? undefined : { x: ['0%', '-50%'] }}
            transition={{ duration: 36, repeat: Infinity, ease: 'linear' }}
          >
            {[...MARQUEE, ...MARQUEE].map((m, i) => (
              <span key={i} className="flex items-center gap-10 text-[14px] font-semibold text-[#7c86a0]">
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
            <Reveal key={s.l} i={i} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-center">
              <div className="text-[34px] font-extrabold leading-none">
                <GradientText>
                  <Counter to={s.to} suffix={s.suffix} />
                </GradientText>
              </div>
              <div className="mt-2 text-[12.5px] leading-snug text-[#8b95ae]">{s.l}</div>
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
          <p className="mt-3 text-[15px] text-[#8b95ae]">
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
          <BentoCard
            i={2}
            className="md:col-span-2"
            title="Import any Excel"
            body="Headers, days, verbose shift text and leave blocks are read automatically. Unknown codes are created for you."
          />
          <BentoCard
            i={3}
            className="md:col-span-2"
            title="Export the same layout"
            body="Operational roster export with PIC/MP sections, date headers, timings, total OT and count rows."
          />
          <BentoCard
            i={4}
            className="md:col-span-2"
            title="Headcount rail"
            body="See who is on each shift every day, with per-person coverage breakdowns in one glance."
          />
          <BentoCard
            i={5}
            className="md:col-span-2"
            title="Multi-line teams"
            body="Each line owns its people and months. Shift codes are shared, so a code added once works everywhere."
          />
          <BentoCard
            i={6}
            className="md:col-span-2"
            title="Undo, zoom, fonts"
            body="Full undo/redo, zoom controls and font options keep large rosters comfortable on any screen."
          />
          <BentoCard
            i={7}
            className="md:col-span-2"
            title="Private & offline"
            body="Data lives in your browser. Save downloads a full Excel backup; restore from JSON or Excel anytime."
          />
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
            <p className="mt-4 text-[15px] leading-relaxed text-[#8b95ae]">
              Keep working the way your department already does. Upload last month's sheet, let ShiftLine read every
              name, day and shift, plan the new month, then download a file laid out exactly like the original.
            </p>
            <ul className="mt-6 space-y-3 text-[14px] text-[#b9c2da]">
              {[
                'Detects name, role and day columns automatically',
                'Understands "Morning Early | 07:30-18:00 | 11H" style cells',
                'Creates missing shift codes with sensible colours',
                'Exports sections, date headers and working counts',
              ].map((t) => (
                <li key={t} className="flex gap-3">
                  <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] font-bold text-[#0b0d12]" style={{ background: GRADIENT }}>✓</span>
                  {t}
                </li>
              ))}
            </ul>
          </Reveal>
          <Reveal i={2}>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
              <ExcelFlow />
              <div className="mt-6 space-y-1.5 rounded-xl border border-white/10 bg-black/25 p-3 font-mono text-[11px] text-[#8b95ae]">
                <div><span className="text-[#4ade80]">in </span> Morning Early | 07:30-18:00 | 11H</div>
                <div><span className="text-[#8593FF]">map</span> → <span className="text-[#F5B040]">M</span></div>
                <div><span className="text-[#4ade80]">in </span> Annual leave</div>
                <div><span className="text-[#8593FF]">map</span> → <span className="text-[#ff6b7a]">LV</span></div>
                <div><span className="text-[#F5B040]">out</span> Morning | 06:00-15:00 | 9H</div>
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
          <div aria-hidden className="absolute left-[16%] right-[16%] top-9 hidden h-px border-t border-dashed border-white/15 sm:block" />
          {[
            ['01', 'Import', 'Upload your existing Excel roster, or start from the demo month.'],
            ['02', 'Plan', 'Generate, rotate and paint shifts. Rule checks guide you as you go.'],
            ['03', 'Export', 'Download the Excel your managers expect, in the layout you imported.'],
          ].map(([n, t, b], i) => (
            <Reveal key={n} i={i}>
              <div className="relative h-full rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.05] to-transparent p-6 text-center">
                <span className="relative z-10 mx-auto grid h-[72px] w-[72px] place-items-center rounded-2xl border border-white/10 bg-[#0f1320] text-[26px] font-extrabold">
                  <GradientText>{n}</GradientText>
                </span>
                <h3 className="mt-4 text-[18px] font-bold">{t}</h3>
                <p className="mt-1.5 text-[13.5px] leading-relaxed text-[#8b95ae]">{b}</p>
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
            className="relative overflow-hidden rounded-3xl border border-white/10 p-10 text-center sm:p-16"
            style={{ background: 'linear-gradient(135deg,#141a30,#0c1020)' }}
          >
            <motion.div
              aria-hidden
              className="absolute -right-24 -top-24 h-72 w-72 rounded-full opacity-30 blur-[90px]"
              style={{ background: '#34CDD3' }}
              animate={reduce ? undefined : { scale: [1, 1.25, 1] }}
              transition={{ duration: 8, repeat: Infinity }}
            />
            <motion.div
              aria-hidden
              className="absolute -bottom-24 -left-24 h-72 w-72 rounded-full opacity-25 blur-[90px]"
              style={{ background: '#F5B040' }}
              animate={reduce ? undefined : { scale: [1.2, 1, 1.2] }}
              transition={{ duration: 9, repeat: Infinity }}
            />
            <h2 className="relative text-[30px] font-extrabold tracking-tight sm:text-[46px]">
              Ready to plan your <GradientText>next month?</GradientText>
            </h2>
            <p className="relative mx-auto mt-4 max-w-lg text-[15px] text-[#8b95ae]">
              Open the roster and start with the demo, or import your own Excel. It takes less than a minute.
            </p>
            <motion.button
              onClick={onOpen}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.97 }}
              className="relative mt-9 rounded-xl px-9 py-4 text-[16px] font-bold text-[#0b0d12]"
              style={{ background: GRADIENT, boxShadow: '0 14px 50px -12px #34CDD3cc' }}
            >
              Open Roster →
            </motion.button>
          </div>
        </Reveal>
      </section>

      {/* -------------------------------------------------------- footer */}
      <footer className="border-t border-white/10 px-5 py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-5 sm:flex-row">
          <div className="flex items-center gap-2.5">
            <Mark size={28} />
            <span className="text-[15px] font-extrabold tracking-tight">
              Shift<span style={{ color: '#6d8bff' }}>Line</span>
            </span>
          </div>
          <div className="flex gap-6 text-[12.5px] text-[#6c7690]">
            <button onClick={() => goTo('demo')} className="hover:text-white">Live demo</button>
            <button onClick={() => goTo('features')} className="hover:text-white">Features</button>
            <button onClick={() => goTo('faq')} className="hover:text-white">FAQ</button>
            <button onClick={onOpen} className="hover:text-white">Open Roster</button>
          </div>
          <span className="text-[12px] text-[#4d566c]">Roster planning for operational teams</span>
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
          <span className="px-2 text-[10px] font-semibold uppercase tracking-wider text-[#5c6680]">People</span>
          {Array.from({ length: days }, (_, d) => (
            <span key={d} className="text-center font-mono text-[10.5px] text-[#5c6680]">{d + 1}</span>
          ))}
        </div>
        {DEMO_ROWS.map((row, r) => (
          <div key={row.name} className="mb-1 grid items-center gap-1" style={{ gridTemplateColumns: cols }}>
            <span className="truncate px-2 text-[12px] font-semibold">
              {row.name} <span className="ml-1 text-[10px] font-normal text-[#5c6680]">{row.role}</span>
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
