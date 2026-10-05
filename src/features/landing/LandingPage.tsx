import { motion, useScroll, useSpring, type Variants } from 'framer-motion';
import { useEffect, useState, type ReactNode } from 'react';

/**
 * Landing page shown before the planner.
 *
 * Self-contained: fixed dark palette and its own scroll container (the app
 * root is height-locked), so it looks identical whatever theme the planner
 * was last left in.
 */

const TONES: Record<string, { bg: string; fg: string }> = {
  M: { bg: '#4a3512', fg: '#F5B040' },
  E: { bg: '#10393b', fg: '#34CDD3' },
  N: { bg: '#232a5c', fg: '#8593FF' },
  ML: { bg: '#3d2c10', fg: '#e8a23a' },
  NL: { bg: '#1d2350', fg: '#7080f0' },
  LV: { bg: '#4a1a22', fg: '#ff6b7a' },
  '-': { bg: 'transparent', fg: '#3b4256' },
};

const DEMO_ROWS: { name: string; role: string; codes: string[] }[] = [
  { name: 'Zouhair Azzabi', role: 'PIC', codes: ['M', 'M', '-', 'M', 'M', 'M', '-', '-', 'M', 'M', 'M', '-'] },
  { name: 'Wesam B', role: 'MP', codes: ['LV', 'LV', 'LV', 'M', 'M', 'ML', '-', '-', 'M', 'M', 'ML', 'M'] },
  { name: 'Sher Khan', role: 'PIC', codes: ['N', 'N', '-', '-', 'N', 'N', 'N', 'NL', '-', '-', 'N', 'N'] },
  { name: 'Ajay Pal', role: 'MP', codes: ['E', 'E', 'E', '-', '-', 'E', 'E', 'E', '-', 'E', 'E', '-'] },
  { name: 'John Paul', role: 'MP', codes: ['-', 'N', 'N', 'N', 'NL', '-', '-', 'N', 'N', 'N', '-', '-'] },
];

const FEATURES: { icon: string; title: string; body: string }[] = [
  { icon: '⚡', title: 'One-click month generation', body: 'Generate a full month for every person in seconds, honouring rest days, rotations and minimum headcount per shift.' },
  { icon: '🔁', title: 'Fair auto-rotation', body: 'Rotate Morning, Evening and Night fairly using each person\'s history so nobody is stuck on nights forever.' },
  { icon: '📥', title: 'Import any Excel roster', body: 'Drop in your department\'s sheet. Headers, days, shifts, leave and new shift codes are read and mapped automatically.' },
  { icon: '📤', title: 'Export in the same format', body: 'Send management an Excel file laid out exactly like your operational roster: sections, date headers, timings and counts.' },
  { icon: '🛡️', title: 'Live rule checking', body: 'Night-to-morning turnarounds, too many days in a row, empty shifts and work-while-on-leave are flagged as you edit.' },
  { icon: '🎨', title: 'Brush editing', body: 'Pick a shift code and paint it across the grid. Undo, redo, zoom and font controls keep big rosters comfortable.' },
  { icon: '📊', title: 'Headcount & coverage', body: 'A live rail shows who is on each shift every day, with per-person coverage breakdowns.' },
  { icon: '💾', title: 'Local-first & private', body: 'Data lives in your browser. Save downloads a full Excel backup, and you can restore from JSON or Excel anytime.' },
];

const STEPS: { n: string; title: string; body: string }[] = [
  { n: '01', title: 'Import', body: 'Upload your existing Excel roster, or start from the demo month.' },
  { n: '02', title: 'Plan', body: 'Generate, rotate and paint shifts. Rule checks guide you as you go.' },
  { n: '03', title: 'Export', body: 'Download the Excel your managers expect, in the same layout you imported.' },
];

const STATS: { v: string; l: string }[] = [
  { v: '30s', l: 'to a full month' },
  { v: '100%', l: 'works offline' },
  { v: '∞', l: 'lines & shift codes' },
  { v: '1-click', l: 'Excel in and out' },
];

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 28 },
  show: (i: number = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.6, delay: i * 0.08, ease: 'easeOut' } }),
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

export function LandingPage({ onOpen }: { onOpen: () => void }) {
  const { scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 24 });
  const [tick, setTick] = useState(0);

  // Gently cycle which demo cell is highlighted so the grid feels alive.
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 900);
    return () => clearInterval(t);
  }, []);

  return (
    <div
      className="fixed inset-0 overflow-y-auto overflow-x-hidden text-[#e8ecf6]"
      style={{ background: '#0a0d16', fontFamily: 'Inter, system-ui, sans-serif' }}
    >
      <motion.div
        className="fixed left-0 right-0 top-0 z-50 h-[3px] origin-left"
        style={{ scaleX: progress, background: 'linear-gradient(90deg,#F5B040,#34CDD3,#8593FF)' }}
      />

      {/* glow backdrop */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[760px] overflow-hidden">
        <motion.div
          className="absolute -left-40 -top-40 h-[520px] w-[520px] rounded-full opacity-30 blur-[110px]"
          style={{ background: '#F5B040' }}
          animate={{ x: [0, 60, 0], y: [0, 40, 0] }}
          transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute right-0 top-10 h-[480px] w-[480px] rounded-full opacity-25 blur-[110px]"
          style={{ background: '#8593FF' }}
          animate={{ x: [0, -50, 0], y: [0, 50, 0] }}
          transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute left-1/3 top-40 h-[380px] w-[380px] rounded-full opacity-20 blur-[110px]"
          style={{ background: '#34CDD3' }}
          animate={{ x: [0, 40, 0], y: [0, -30, 0] }}
          transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      {/* nav */}
      <nav className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <div className="flex items-center gap-2.5">
          <Mark size={34} />
          <span className="text-[18px] font-extrabold tracking-tight">
            Shift<span style={{ color: '#6d8bff' }}>Line</span>
          </span>
        </div>
        <div className="hidden items-center gap-7 text-[13.5px] text-[#9aa4bd] sm:flex">
          <a href="#features" className="hover:text-white transition-colors">Features</a>
          <a href="#how" className="hover:text-white transition-colors">How it works</a>
          <a href="#preview" className="hover:text-white transition-colors">Preview</a>
        </div>
        <button
          onClick={onOpen}
          className="rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-[13px] font-semibold backdrop-blur hover:bg-white/10 transition-colors"
        >
          Open Roster
        </button>
      </nav>

      {/* hero */}
      <header className="relative z-10 mx-auto max-w-6xl px-5 pb-10 pt-12 text-center sm:pt-20">
        <motion.span
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5 text-[12px] font-medium text-[#b9c2da]"
        >
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#34CDD3]" />
          Shift planning for operational teams
        </motion.span>

        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1 }}
          className="mx-auto mt-6 max-w-4xl text-[40px] font-extrabold leading-[1.05] tracking-tight sm:text-[68px]"
        >
          Build the monthly roster{' '}
          <span
            className="bg-clip-text text-transparent"
            style={{ backgroundImage: 'linear-gradient(90deg,#F5B040,#34CDD3 55%,#8593FF)' }}
          >
            in seconds, not days.
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.25 }}
          className="mx-auto mt-6 max-w-2xl text-[16px] leading-relaxed text-[#9aa4bd] sm:text-[18px]"
        >
          ShiftLine imports your Excel roster, auto-rotates Morning, Evening and Night shifts fairly,
          checks the rules as you edit, and exports the exact sheet your managers expect.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.4 }}
          className="mt-9 flex flex-wrap items-center justify-center gap-3"
        >
          <motion.button
            onClick={onOpen}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.97 }}
            className="group relative overflow-hidden rounded-xl px-7 py-3.5 text-[15px] font-bold text-[#0b0d12]"
            style={{ background: 'linear-gradient(90deg,#F5B040,#34CDD3)', boxShadow: '0 10px 40px -10px #34CDD3aa' }}
          >
            <span className="relative z-10 flex items-center gap-2">
              Open Roster
              <span className="transition-transform group-hover:translate-x-1">→</span>
            </span>
          </motion.button>
          <a
            href="#features"
            className="rounded-xl border border-white/15 px-6 py-3.5 text-[15px] font-semibold text-[#cdd5ea] hover:bg-white/5 transition-colors"
          >
            See features
          </a>
        </motion.div>

        {/* animated roster preview */}
        <motion.div
          id="preview"
          initial={{ opacity: 0, y: 50, rotateX: 14 }}
          animate={{ opacity: 1, y: 0, rotateX: 0 }}
          transition={{ duration: 0.9, delay: 0.55, ease: 'easeOut' }}
          style={{ perspective: 1200 }}
          className="mx-auto mt-16 max-w-4xl"
        >
          <div
            className="overflow-hidden rounded-2xl border border-white/10 text-left"
            style={{ background: '#0f1320', boxShadow: '0 40px 100px -30px #000, 0 0 0 1px #ffffff08' }}
          >
            <div className="flex items-center gap-1.5 border-b border-white/10 px-4 py-2.5">
              <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
              <span className="ml-3 text-[11.5px] text-[#6c7690]">Line 5 · September 2026</span>
            </div>
            <div className="overflow-x-auto p-3">
              <div className="min-w-[620px]">
                <div className="mb-1 grid items-center gap-1" style={{ gridTemplateColumns: '150px repeat(12, 1fr)' }}>
                  <span className="px-2 text-[10px] font-semibold uppercase tracking-wider text-[#5c6680]">People</span>
                  {Array.from({ length: 12 }, (_, d) => (
                    <span key={d} className="text-center text-[10.5px] font-mono text-[#5c6680]">{d + 1}</span>
                  ))}
                </div>
                {DEMO_ROWS.map((row, r) => (
                  <div
                    key={row.name}
                    className="mb-1 grid items-center gap-1"
                    style={{ gridTemplateColumns: '150px repeat(12, 1fr)' }}
                  >
                    <span className="truncate px-2 text-[12px] font-semibold">
                      {row.name} <span className="ml-1 text-[10px] font-normal text-[#5c6680]">{row.role}</span>
                    </span>
                    {row.codes.map((code, d) => {
                      const t = TONES[code] ?? TONES['-'];
                      const lit = (tick + r * 2) % 12 === d;
                      return (
                        <motion.span
                          key={d}
                          initial={{ opacity: 0, scale: 0.6 }}
                          animate={{ opacity: 1, scale: lit ? 1.12 : 1 }}
                          transition={{ delay: 0.9 + (r * 12 + d) * 0.012, duration: 0.3 }}
                          className="grid h-8 place-items-center rounded-md text-[11px] font-bold"
                          style={{
                            background: t.bg,
                            color: t.fg,
                            boxShadow: lit ? `0 0 0 1.5px ${t.fg}` : 'none',
                          }}
                        >
                          {code === '-' ? '·' : code}
                        </motion.span>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      </header>

      {/* stats */}
      <section className="relative z-10 mx-auto max-w-5xl px-5 py-14">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {STATS.map((s, i) => (
            <Reveal key={s.l} i={i} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-center">
              <div
                className="bg-clip-text text-[32px] font-extrabold text-transparent"
                style={{ backgroundImage: 'linear-gradient(90deg,#F5B040,#8593FF)' }}
              >
                {s.v}
              </div>
              <div className="mt-1 text-[12.5px] text-[#8b95ae]">{s.l}</div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* features */}
      <section id="features" className="relative z-10 mx-auto max-w-6xl px-5 py-16">
        <Reveal className="mx-auto mb-12 max-w-2xl text-center">
          <h2 className="text-[30px] font-extrabold tracking-tight sm:text-[42px]">Everything a roster needs</h2>
          <p className="mt-3 text-[15px] text-[#8b95ae]">
            Built around how shift teams actually work: Excel in, rules enforced, Excel out.
          </p>
        </Reveal>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f, i) => (
            <Reveal key={f.title} i={i % 4}>
              <motion.div
                whileHover={{ y: -6 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                className="h-full rounded-2xl border border-white/10 bg-white/[0.03] p-5 hover:border-white/25 hover:bg-white/[0.06] transition-colors"
              >
                <div className="mb-3 grid h-11 w-11 place-items-center rounded-xl bg-white/[0.06] text-[22px]">{f.icon}</div>
                <h3 className="text-[15px] font-bold">{f.title}</h3>
                <p className="mt-1.5 text-[13px] leading-relaxed text-[#8b95ae]">{f.body}</p>
              </motion.div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* how it works */}
      <section id="how" className="relative z-10 mx-auto max-w-5xl px-5 py-16">
        <Reveal className="mb-12 text-center">
          <h2 className="text-[30px] font-extrabold tracking-tight sm:text-[42px]">Three steps. That's it.</h2>
        </Reveal>
        <div className="grid gap-5 sm:grid-cols-3">
          {STEPS.map((s, i) => (
            <Reveal key={s.n} i={i}>
              <div className="relative h-full rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.05] to-transparent p-6">
                <span
                  className="bg-clip-text text-[44px] font-extrabold text-transparent"
                  style={{ backgroundImage: 'linear-gradient(135deg,#F5B040,#8593FF)' }}
                >
                  {s.n}
                </span>
                <h3 className="mt-1 text-[18px] font-bold">{s.title}</h3>
                <p className="mt-1.5 text-[13.5px] leading-relaxed text-[#8b95ae]">{s.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* final CTA */}
      <section className="relative z-10 mx-auto max-w-4xl px-5 pb-24 pt-10">
        <Reveal>
          <div
            className="relative overflow-hidden rounded-3xl border border-white/10 p-10 text-center sm:p-14"
            style={{ background: 'linear-gradient(135deg,#141a30,#0f1320)' }}
          >
            <div
              aria-hidden
              className="absolute -right-20 -top-20 h-64 w-64 rounded-full opacity-30 blur-[90px]"
              style={{ background: '#34CDD3' }}
            />
            <h2 className="relative text-[28px] font-extrabold tracking-tight sm:text-[40px]">Ready to plan your month?</h2>
            <p className="relative mx-auto mt-3 max-w-lg text-[15px] text-[#8b95ae]">
              Your data stays in your browser. Open the roster and start with the demo, or import your own Excel.
            </p>
            <motion.button
              onClick={onOpen}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.97 }}
              className="relative mt-8 rounded-xl px-8 py-4 text-[16px] font-bold text-[#0b0d12]"
              style={{ background: 'linear-gradient(90deg,#F5B040,#34CDD3)', boxShadow: '0 10px 40px -10px #34CDD3aa' }}
            >
              Open Roster →
            </motion.button>
          </div>
        </Reveal>
      </section>

      <footer className="relative z-10 border-t border-white/10 px-5 py-6 text-center text-[12px] text-[#5c6680]">
        ShiftLine · Roster planning for operational teams
      </footer>
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
