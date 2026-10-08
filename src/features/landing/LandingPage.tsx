import { motion, useScroll, type Variants } from 'framer-motion';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';

import { getSettings, patchSettings } from '@/data/db';

/* ==========================================================================
   THEME DEFINITIONS & COLOR TOKENS (LIGHT & DARK ENTERPRISE SAAS PALETTES)
   Tailored for ALS-TRAM Railway Transit Operations & Signalling Maintenance.
   ========================================================================== */

type Theme = 'light' | 'dark';

const PALETTES: Record<Theme, Record<string, string>> = {
  light: {
    '--bg-main': '#F8FAFC',
    '--bg-surface': '#FFFFFF',
    '--bg-surface-subtle': '#F1F5F9',
    '--bg-card': '#FFFFFF',
    '--bg-card-hover': '#F8FAFC',
    '--bg-card-elevated': '#FFFFFF',
    '--bg-hero': 'linear-gradient(180deg, #EFF6FF 0%, #F8FAFC 100%)',
    '--bg-cta-banner': 'linear-gradient(135deg, #1E40AF 0%, #1D4ED8 50%, #2563EB 100%)',
    '--text-primary': '#0F172A',
    '--text-secondary': '#475569',
    '--text-muted': '#64748B',
    '--text-subtle': '#94A3B8',
    '--brand-primary': '#1D4ED8',
    '--brand-primary-hover': '#1E40AF',
    '--brand-accent': '#2563EB',
    '--brand-accent-subtle': '#DBEAFE',
    '--brand-gradient': 'linear-gradient(135deg, #1D4ED8 0%, #2563EB 50%, #3B82F6 100%)',
    '--border-subtle': '#E2E8F0',
    '--border-medium': '#CBD5E1',
    '--border-strong': '#94A3B8',
    '--nav-glass': 'rgba(255, 255, 255, 0.92)',
    '--badge-bg': '#DBEAFE',
    '--badge-text': '#1E40AF',
    '--badge-border': '#BFDBFE',
    '--shadow-sm': '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    '--shadow-md': '0 4px 6px -1px rgba(0, 0, 0, 0.07), 0 2px 4px -2px rgba(0, 0, 0, 0.05)',
    '--shadow-lg': '0 10px 25px -3px rgba(0, 0, 0, 0.08), 0 4px 6px -4px rgba(0, 0, 0, 0.04)',
    '--shadow-xl': '0 20px 35px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.04)',
    '--shadow-glow': '0 12px 30px -10px rgba(37, 99, 235, 0.35)',
    // Shift chips
    '--chip-m-bg': '#FEF3C7',
    '--chip-m-fg': '#92400E',
    '--chip-e-bg': '#CCFBF1',
    '--chip-e-fg': '#0F766E',
    '--chip-n-bg': '#EDE9FE',
    '--chip-n-fg': '#5B21B6',
    '--chip-ml-bg': '#FDE68A',
    '--chip-ml-fg': '#78350F',
    '--chip-nl-bg': '#DDD6FE',
    '--chip-nl-fg': '#4C1D95',
    '--chip-lv-bg': '#FEE2E2',
    '--chip-lv-fg': '#B91C1C',
    '--chip-off-bg': '#F1F5F9',
    '--chip-off-fg': '#64748B',
    '--alert-red': '#DC2626',
    '--alert-red-bg': '#FEF2F2',
    '--alert-green': '#16A34A',
    '--alert-green-bg': '#F0FDF4',
  },
  dark: {
    '--bg-main': '#0B0F19',
    '--bg-surface': '#111827',
    '--bg-surface-subtle': '#1F2937',
    '--bg-card': '#111827',
    '--bg-card-hover': '#1F2937',
    '--bg-card-elevated': '#1E293B',
    '--bg-hero': 'linear-gradient(180deg, #0F172A 0%, #0B0F19 100%)',
    '--bg-cta-banner': 'linear-gradient(135deg, #1E3A8A 0%, #1D4ED8 50%, #2563EB 100%)',
    '--text-primary': '#F8FAFC',
    '--text-secondary': '#CBD5E1',
    '--text-muted': '#94A3B8',
    '--text-subtle': '#64748B',
    '--brand-primary': '#3B82F6',
    '--brand-primary-hover': '#60A5FA',
    '--brand-accent': '#60A5FA',
    '--brand-accent-subtle': 'rgba(59, 130, 246, 0.15)',
    '--brand-gradient': 'linear-gradient(135deg, #3B82F6 0%, #60A5FA 50%, #93C5FD 100%)',
    '--border-subtle': 'rgba(255, 255, 255, 0.08)',
    '--border-medium': 'rgba(255, 255, 255, 0.16)',
    '--border-strong': 'rgba(255, 255, 255, 0.28)',
    '--nav-glass': 'rgba(11, 15, 25, 0.88)',
    '--badge-bg': 'rgba(59, 130, 246, 0.15)',
    '--badge-text': '#93C5FD',
    '--badge-border': 'rgba(59, 130, 246, 0.3)',
    '--shadow-sm': '0 1px 2px 0 rgba(0, 0, 0, 0.3)',
    '--shadow-md': '0 4px 6px -1px rgba(0, 0, 0, 0.4), 0 2px 4px -2px rgba(0, 0, 0, 0.3)',
    '--shadow-lg': '0 10px 25px -3px rgba(0, 0, 0, 0.5), 0 4px 6px -4px rgba(0, 0, 0, 0.4)',
    '--shadow-xl': '0 20px 35px -5px rgba(0, 0, 0, 0.6), 0 8px 10px -6px rgba(0, 0, 0, 0.4)',
    '--shadow-glow': '0 12px 30px -10px rgba(59, 130, 246, 0.35)',
    // Shift chips
    '--chip-m-bg': '#3D2A08',
    '--chip-m-fg': '#FBBF24',
    '--chip-e-bg': '#0F3836',
    '--chip-e-fg': '#2DD4BF',
    '--chip-n-bg': '#2E1065',
    '--chip-n-fg': '#C4B5FD',
    '--chip-ml-bg': '#452A05',
    '--chip-ml-fg': '#FCD34D',
    '--chip-nl-bg': '#3B0764',
    '--chip-nl-fg': '#D8B4FE',
    '--chip-lv-bg': '#4C0519',
    '--chip-lv-fg': '#FDA4AF',
    '--chip-off-bg': 'rgba(255, 255, 255, 0.05)',
    '--chip-off-fg': '#64748B',
    '--alert-red': '#F87171',
    '--alert-red-bg': 'rgba(239, 68, 68, 0.15)',
    '--alert-green': '#4ADE80',
    '--alert-green-bg': 'rgba(34, 197, 94, 0.15)',
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

/* ==========================================================================
   DATA MODELS & DEMO RECORDS
   ========================================================================== */

const SHIFT_TOKENS: Record<string, { bg: string; fg: string; label: string; timing: string }> = {
  M: { bg: 'var(--chip-m-bg)', fg: 'var(--chip-m-fg)', label: 'Morning', timing: '06:00 – 14:00' },
  E: { bg: 'var(--chip-e-bg)', fg: 'var(--chip-e-fg)', label: 'Evening', timing: '14:00 – 22:00' },
  N: { bg: 'var(--chip-n-bg)', fg: 'var(--chip-n-fg)', label: 'Night', timing: '22:00 – 06:00' },
  ML: { bg: 'var(--chip-ml-bg)', fg: 'var(--chip-ml-fg)', label: 'Morning Late', timing: '07:30 – 18:00' },
  NL: { bg: 'var(--chip-nl-bg)', fg: 'var(--chip-nl-fg)', label: 'Night Late', timing: '19:30 – 06:30' },
  LV: { bg: 'var(--chip-lv-bg)', fg: 'var(--chip-lv-fg)', label: 'Annual Leave', timing: 'Paid Off' },
  '-': { bg: 'var(--chip-off-bg)', fg: 'var(--chip-off-fg)', label: 'Rest Day (RD)', timing: 'Mandatory Rest' },
};

const BRUSH_OPTIONS = ['M', 'E', 'N', 'ML', 'NL', 'LV', '-'] as const;
const ACTIVE_WORKED = new Set(['M', 'E', 'N', 'ML', 'NL']);
const NIGHT_SHIFTS = new Set(['N', 'NL']);
const MORNING_SHIFTS = new Set(['M', 'ML']);

const DEMO_DAYS_COUNT = 14;

const INITIAL_DEMO_GRID = [
  { name: 'Zouhair Azzabi', role: 'PIC · Lead', dept: 'Line 5 Team A', codes: ['M', 'M', '-', 'M', 'M', 'M', '-', '-', 'M', 'M', 'M', '-', 'M', 'M'] },
  { name: 'Wesam B', role: 'MP · Engineer', dept: 'Line 5 Team A', codes: ['LV', 'LV', 'LV', 'M', 'M', 'ML', '-', '-', 'M', 'M', 'ML', 'M', '-', '-'] },
  { name: 'Ajay Pal', role: 'MP · Engineer', dept: 'Line 5 Team B', codes: ['E', 'E', 'E', '-', '-', 'E', 'E', 'E', '-', 'E', 'E', '-', '-', 'E'] },
  { name: 'Sher Khan', role: 'PIC · Lead', dept: 'Line 5 Team C', codes: ['N', 'N', '-', '-', 'N', 'N', 'N', 'NL', '-', '-', 'N', 'N', '-', '-'] },
  { name: 'John Paul', role: 'MP · Engineer', dept: 'Line 5 Team C', codes: ['-', 'N', 'N', 'N', 'NL', '-', '-', 'N', 'N', 'N', '-', '-', 'N', 'N'] },
  { name: 'Srinivasa Rao', role: 'PIC · Lead', dept: 'Line 5 Special', codes: ['ML', 'ML', '-', 'M', 'M', '-', '-', 'M', 'ML', 'ML', '-', '-', 'M', 'ML'] },
];

/* ==========================================================================
   ANIMATION VARIANTS
   ========================================================================== */

const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] },
  }),
};

function SectionReveal({
  children,
  delayIndex = 0,
  className = '',
}: {
  children: ReactNode;
  delayIndex?: number;
  className?: string;
}) {
  return (
    <motion.div
      variants={fadeInUp}
      custom={delayIndex}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-30px' }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* ==========================================================================
   MAIN LANDING PAGE COMPONENT (HERO SECTION + FOOTER ONLY)
   ========================================================================== */

export function LandingPage({ onOpen }: { onOpen: () => void }) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [theme, setTheme] = useState<Theme>(readInitialTheme);

  // Synchronize theme with database settings
  useEffect(() => {
    let unmounted = false;
    getSettings()
      .then((settings) => {
        if (!unmounted && (settings.theme === 'light' || settings.theme === 'dark')) {
          setTheme(settings.theme);
        }
      })
      .catch(() => undefined);
    return () => {
      unmounted = true;
    };
  }, []);

  const handleToggleTheme = () => {
    const nextTheme: Theme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    try {
      localStorage.setItem(THEME_KEY, nextTheme);
    } catch {
      /* ignore */
    }
    document.documentElement.dataset.theme = nextTheme;
    patchSettings({ theme: nextTheme }).catch(() => undefined);
  };

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const { scrollY } = useScroll({ container: scrollContainerRef });
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    return scrollY.on('change', (latest) => {
      setIsScrolled(latest > 20);
    });
  }, [scrollY]);

  // Page container styles
  const pageContainerStyles = useMemo<CSSProperties>(() => {
    return {
      ...PALETTES[theme],
      backgroundColor: 'var(--bg-main)',
      color: 'var(--text-primary)',
      fontFamily: "'Poppins', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      colorScheme: theme,
    };
  }, [theme]);

  return (
    <div
      ref={scrollContainerRef}
      className="fixed inset-0 overflow-y-auto overflow-x-hidden selection:bg-blue-500 selection:text-white"
      style={pageContainerStyles}
    >
      {/* ====================================================================
          NAVBAR (Sticky, Glassmorphic, Brand Logo, Theme Toggle & Launch CTA)
          ==================================================================== */}
      <nav
        className={`sticky top-0 z-50 transition-all duration-300 ${
          isScrolled
            ? 'border-b border-[var(--border-subtle)] shadow-[var(--shadow-sm)]'
            : 'border-b border-transparent'
        }`}
        style={{
          backgroundColor: isScrolled ? 'var(--nav-glass)' : 'transparent',
          backdropFilter: 'blur(16px)',
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          {/* Logo (ALS-TRAM / ShiftLine) */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
              className="flex items-center gap-3 group focus:outline-none"
            >
              <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-[#1E40AF] via-[#2563EB] to-[#3B82F6] flex items-center justify-center shadow-lg shadow-blue-500/25 group-hover:scale-105 transition-transform text-white font-black text-sm tracking-wider">
                ALS
              </div>
              <div className="flex flex-col text-left">
                <div className="flex items-center gap-2">
                  <span className="text-xl font-black tracking-tight text-[var(--text-primary)]">
                    ALS-TRAM
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono uppercase bg-blue-500/15 text-blue-500 border border-blue-500/30">
                    Metro Operations
                  </span>
                </div>
                <span className="text-[11px] font-semibold tracking-wide uppercase text-[var(--text-muted)] -mt-0.5">
                  Signalling &amp; Communication Systems
                </span>
              </div>
            </button>
          </div>

          {/* Right Action Buttons */}
          <div className="flex items-center gap-3.5">
            {/* Theme Toggle Button */}
            <button
              onClick={handleToggleTheme}
              aria-label="Toggle theme"
              className="p-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-medium)] transition-all shadow-sm"
              title="Toggle Light/Dark Theme"
            >
              {theme === 'dark' ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="5" />
                  <line x1="12" y1="1" x2="12" y2="3" />
                  <line x1="12" y1="21" x2="12" y2="23" />
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                  <line x1="1" y1="12" x2="3" y2="12" />
                  <line x1="21" y1="12" x2="23" y2="12" />
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
              )}
            </button>

            {/* Launch Roster Button */}
            <button
              onClick={onOpen}
              className="inline-flex items-center gap-2.5 px-6 py-3 rounded-xl text-sm font-extrabold text-white bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 shadow-lg shadow-indigo-500/25 border border-indigo-400/30 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <span>Launch Roster Platform</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </button>
          </div>
        </div>
      </nav>

      {/* ====================================================================
          HERO SECTION (ONLY SECTION ON LANDING PAGE)
          Headline: "Signalling and Communication System & Roster Planning"
          ==================================================================== */}
      <section className="relative pt-10 pb-20 sm:pt-16 sm:pb-28 overflow-hidden bg-[var(--bg-hero)] border-b border-[var(--border-subtle)]">
        {/* Ambient Glow Orbs */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-full overflow-hidden pointer-events-none -z-10 opacity-35 dark:opacity-25">
          <div className="absolute top-10 left-12 w-96 h-96 bg-blue-500/30 rounded-full blur-[130px]" />
          <div className="absolute top-20 right-12 w-96 h-96 bg-indigo-500/30 rounded-full blur-[140px]" />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          {/* Top Pill Announcement */}
          <SectionReveal delayIndex={0}>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold tracking-wide uppercase bg-[var(--badge-bg)] text-[var(--badge-text)] border border-[var(--badge-border)] shadow-sm">
              <span className="w-2 h-2 rounded-full bg-blue-600 animate-ping" />
              <span>ALS-TRAM · Signalling &amp; Communication Systems</span>
            </div>
          </SectionReveal>

          {/* Main Headline (Updated as requested by client) */}
          <SectionReveal delayIndex={1}>
            <h1 className="mt-6 text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight text-[var(--text-primary)] max-w-5xl mx-auto leading-[1.12]">
              Signalling and Communication System &amp; Roster Planning
            </h1>
          </SectionReveal>

          {/* Subtitle / Explainer */}
          <SectionReveal delayIndex={2}>
            <p className="mt-6 text-base sm:text-xl text-[var(--text-secondary)] max-w-3xl mx-auto leading-relaxed">
              The automated rostering engine engineered for 24/7 mission-critical operations: multi-shift rotations (Morning, Evening, Night), automated manpower allocation, Line 4 &amp; 6 vs. Line 5 segregation, and real-time shift buffer analytics.
            </p>
          </SectionReveal>

          {/* Call-to-action buttons */}
          <SectionReveal delayIndex={3}>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              <button
                onClick={onOpen}
                className="px-8 py-4 rounded-xl text-base font-extrabold text-white bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 shadow-xl shadow-indigo-600/25 transition-all hover:scale-[1.03] active:scale-[0.98] inline-flex items-center gap-3 border border-indigo-400/30"
              >
                <span>Launch Live Roster Platform</span>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </button>
            </div>
          </SectionReveal>

          {/* Trust Guarantees */}
          <SectionReveal delayIndex={4}>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-6 text-xs sm:text-sm font-semibold text-[var(--text-muted)]">
              <span className="flex items-center gap-1.5">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                100% Offline Resilience (IndexedDB)
              </span>
              <span className="flex items-center gap-1.5">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Zero-Loss Excel Round-Trip Sync
              </span>
              <span className="flex items-center gap-1.5">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Real-Time Fatigue &amp; Turnaround Rules
              </span>
            </div>
          </SectionReveal>

          {/* Interactive Roster Simulator Showcase (Embedded Directly in Hero) */}
          <SectionReveal delayIndex={5}>
            <div className="mt-12 max-w-6xl mx-auto">
              <InteractiveRosterPlayground onLaunch={onOpen} />
            </div>
          </SectionReveal>
        </div>
      </section>

      {/* ====================================================================
          FOOTER (ONLY OTHER SECTION ON LANDING PAGE)
          ==================================================================== */}
      <footer className="bg-[var(--bg-main)] border-t border-[var(--border-subtle)] py-12 text-xs text-[var(--text-muted)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-10">
            {/* Col 1: Brand Info */}
            <div className="md:col-span-1">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[var(--brand-primary)] flex items-center justify-center text-white font-black text-xs">
                  ALS
                </div>
                <div className="flex flex-col text-left">
                  <span className="text-base font-extrabold text-[var(--text-primary)]">
                    ALS-TRAM
                  </span>
                  <span className="text-[10.5px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                    Signalling &amp; Communication Systems
                  </span>
                </div>
              </div>
              <p className="mt-3 text-xs text-[var(--text-secondary)] leading-relaxed">
                Mission-critical operational roster planning and work order manpower allocation. Engineered for railway transit signalling maintenance teams.
              </p>
            </div>

            {/* Col 2: System Status */}
            <div>
              <h4 className="font-bold text-xs uppercase tracking-wider text-[var(--text-primary)] mb-3">
                Operational Status
              </h4>
              <ul className="space-y-2 text-[12.5px] text-[var(--text-secondary)]">
                <li className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span>Local-first architecture (Offline Active)</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-400" />
                  <span>IndexedDB encrypted database storage</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-indigo-400" />
                  <span>Nov-Workorders.xlsx 2-way Excel sync</span>
                </li>
              </ul>
            </div>

            {/* Col 3: Quick Launch */}
            <div>
              <h4 className="font-bold text-xs uppercase tracking-wider text-[var(--text-primary)] mb-3">
                Quick Actions
              </h4>
              <div className="flex flex-col gap-2.5 items-start">
                <button
                  onClick={onOpen}
                  className="font-bold text-[var(--brand-primary)] hover:underline inline-flex items-center gap-1.5 text-sm"
                >
                  <span>Launch Live Roster Platform</span>
                  <span>&rarr;</span>
                </button>
                <button
                  onClick={handleToggleTheme}
                  className="hover:text-[var(--text-primary)] transition-colors text-[12px]"
                >
                  Toggle Light / Dark Mode ({theme.toUpperCase()})
                </button>
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-[var(--border-subtle)] flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left text-[11.5px]">
            <span>
              &copy; {new Date().getFullYear()} ALS-TRAM Signalling and Communication System &amp; Roster Planning. All rights reserved.
            </span>
            <span>
              Mission-Critical Operations &bull; Zero Cloud Vendor Lock-in &bull; Full Data Privacy
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ==========================================================================
   INTERACTIVE ROSTER PLAYGROUND (EMBEDDED INSIDE HERO SHOWCASE)
   ========================================================================== */

function InteractiveRosterPlayground({ onLaunch }: { onLaunch: () => void }) {
  const [selectedBrush, setSelectedBrush] = useState<string>('M');
  const [activeLine, setActiveLine] = useState<'L4_L6' | 'L5'>('L5');
  const [gridData, setGridData] = useState<string[][]>(() =>
    INITIAL_DEMO_GRID.map((row) => [...row.codes])
  );
  const isMouseDownRef = useRef(false);

  const applyBrush = useCallback(
    (rowIdx: number, dayIdx: number) => {
      setGridData((currentGrid) => {
        if (currentGrid[rowIdx][dayIdx] === selectedBrush) return currentGrid;
        const newGrid = currentGrid.map((r) => [...r]);
        newGrid[rowIdx][dayIdx] = selectedBrush;
        return newGrid;
      });
    },
    [selectedBrush]
  );

  useEffect(() => {
    const handleMouseUp = () => {
      isMouseDownRef.current = false;
    };
    window.addEventListener('pointerup', handleMouseUp);
    return () => window.removeEventListener('pointerup', handleMouseUp);
  }, []);

  // Compute live fatigue violations (Night immediately followed by Morning)
  const complianceViolations = useMemo(() => {
    const violationsSet = new Set<string>();
    gridData.forEach((row, r) => {
      for (let d = 0; d < row.length - 1; d++) {
        if (NIGHT_SHIFTS.has(row[d]) && MORNING_SHIFTS.has(row[d + 1])) {
          violationsSet.add(`${r}-${d + 1}`);
        }
      }
    });
    return violationsSet;
  }, [gridData]);

  // Compute daily working counts
  const dailyWorkingCounts = useMemo(() => {
    return Array.from({ length: DEMO_DAYS_COUNT }, (_, day) =>
      gridData.reduce((acc, row) => acc + (ACTIVE_WORKED.has(row[day]) ? 1 : 0), 0)
    );
  }, [gridData]);

  const handleResetGrid = () => {
    setGridData(INITIAL_DEMO_GRID.map((row) => [...row.codes]));
  };

  const gridTemplate = `150px repeat(${DEMO_DAYS_COUNT}, minmax(0, 1fr))`;

  return (
    <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] overflow-hidden shadow-[var(--shadow-xl)] text-left">
      {/* Browser/Dashboard Header Strip */}
      <div className="px-4 py-3 border-b border-[var(--border-subtle)] bg-[var(--bg-card)] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-red-400" />
          <span className="w-3 h-3 rounded-full bg-amber-400" />
          <span className="w-3 h-3 rounded-full bg-green-400" />
          <span className="ml-2 font-mono text-xs font-bold text-[var(--text-muted)]">
            ALS-TRAM Live Roster Simulator • {activeLine === 'L5' ? 'Line 5 SLV' : 'Line 4 & 6 DCS/HM'} (14-Day Cycle)
          </span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Operational Line Switcher */}
          <div className="inline-flex items-center p-0.5 rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)]">
            <button
              type="button"
              onClick={() => setActiveLine('L4_L6')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all ${
                activeLine === 'L4_L6'
                  ? 'bg-[var(--brand-primary)] text-white shadow-xs'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              Line 4 &amp; 6
            </button>
            <button
              type="button"
              onClick={() => setActiveLine('L5')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all ${
                activeLine === 'L5'
                  ? 'bg-[var(--brand-primary)] text-white shadow-xs'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              Line 5
            </button>
          </div>

          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-green-100 text-green-700 dark:bg-green-950/60 dark:text-green-400 border border-green-300 dark:border-green-800">
            ✓ 0 Compliance Violations
          </span>
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400 border border-blue-300 dark:border-blue-800">
            18/18 Staff Scheduled
          </span>
        </div>
      </div>

      {/* Interactive Shift Brush Toolbar */}
      <div className="p-3.5 sm:p-4 border-b border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11.5px] font-bold uppercase tracking-wider text-[var(--text-muted)] mr-1">
            Paint Shift:
          </span>
          {BRUSH_OPTIONS.map((code) => {
            const token = SHIFT_TOKENS[code];
            const isSelected = selectedBrush === code;
            return (
              <button
                key={code}
                type="button"
                onClick={() => setSelectedBrush(code)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 border cursor-pointer ${
                  isSelected
                    ? 'ring-2 ring-blue-500 scale-105 shadow-sm border-transparent'
                    : 'border-[var(--border-subtle)] hover:border-[var(--border-medium)]'
                }`}
                style={{ backgroundColor: token.bg, color: token.fg }}
              >
                <span>{code === '-' ? 'RD' : code}</span>
                <span className="text-[10px] opacity-75 font-normal hidden sm:inline">({token.label})</span>
              </button>
            );
          })}
          <button
            type="button"
            onClick={handleResetGrid}
            className="ml-1 px-2.5 py-1 rounded-lg text-[11.5px] font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-surface)] border border-[var(--border-subtle)] transition-colors"
          >
            Reset
          </button>
        </div>

        {/* Live Fatigue Violation Status */}
        <div>
          <span
            className={`px-3 py-1 rounded-full text-xs font-bold inline-flex items-center gap-1.5 border transition-all ${
              complianceViolations.size > 0
                ? 'bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-400 border-red-300 dark:border-red-800 animate-pulse'
                : 'bg-green-50 text-green-700 dark:bg-green-950/60 dark:text-green-400 border-green-300 dark:border-green-800'
            }`}
          >
            {complianceViolations.size > 0 ? (
              <>
                <span>⚠️</span>
                <span>{complianceViolations.size} Fatigue Rule Violation{complianceViolations.size > 1 ? 's' : ''}</span>
              </>
            ) : (
              <>
                <span>✓</span>
                <span>All Shift &amp; Labor Rules Satisfied</span>
              </>
            )}
          </span>
        </div>
      </div>

      {/* Grid Canvas */}
      <div className="p-4 sm:p-5 overflow-x-auto select-none" onPointerLeave={() => (isMouseDownRef.current = false)}>
        <div className="min-w-[700px]">
          {/* Header Row: Days */}
          <div
            className="grid items-center gap-1.5 pb-2 text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider border-b border-[var(--border-subtle)]"
            style={{ gridTemplateColumns: gridTemplate }}
          >
            <span className="px-2">Engineer / Role</span>
            {Array.from({ length: DEMO_DAYS_COUNT }, (_, d) => (
              <span key={d} className="text-center font-mono">
                {d + 1} Sep
              </span>
            ))}
          </div>

          {/* Personnel Shift Rows */}
          <div className="divide-y divide-[var(--border-subtle)] py-1">
            {INITIAL_DEMO_GRID.map((emp, rowIdx) => (
              <div
                key={rowIdx}
                className="grid items-center gap-1.5 py-2"
                style={{ gridTemplateColumns: gridTemplate }}
              >
                <div className="px-2 truncate">
                  <div className="font-bold text-xs text-[var(--text-primary)] truncate">{emp.name}</div>
                  <div className="text-[10px] text-[var(--text-muted)] font-medium truncate">{emp.role}</div>
                </div>

                {gridData[rowIdx].map((code, dayIdx) => {
                  const token = SHIFT_TOKENS[code] ?? SHIFT_TOKENS['-'];
                  const isViolated = complianceViolations.has(`${rowIdx}-${dayIdx}`);

                  return (
                    <button
                      key={dayIdx}
                      type="button"
                      onPointerDown={() => {
                        isMouseDownRef.current = true;
                        applyBrush(rowIdx, dayIdx);
                      }}
                      onPointerEnter={() => {
                        if (isMouseDownRef.current) applyBrush(rowIdx, dayIdx);
                      }}
                      className={`h-8 rounded-md font-bold text-xs flex items-center justify-center transition-all cursor-pointer ${
                        isViolated ? 'ring-2 ring-red-500 scale-105' : 'hover:opacity-85'
                      }`}
                      style={{ backgroundColor: token.bg, color: token.fg }}
                      title={`${emp.name} Day ${dayIdx + 1}: ${token.label} (${token.timing})`}
                    >
                      {code === '-' ? '·' : code}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Daily Headcount Summary Row */}
          <div
            className="grid items-center gap-1.5 pt-3 border-t border-[var(--border-subtle)] text-xs font-mono font-bold"
            style={{ gridTemplateColumns: gridTemplate }}
          >
            <span className="px-2 text-[var(--text-muted)] font-sans uppercase tracking-wider text-[11px]">
              Daily On-Duty
            </span>
            {dailyWorkingCounts.map((count, d) => (
              <span
                key={d}
                className={`text-center py-1 rounded ${
                  count < 3
                    ? 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40'
                    : 'text-[var(--text-primary)]'
                }`}
              >
                {count}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Simulator Bottom Bar & Direct Launch Link */}
      <div className="px-4 py-3 bg-[var(--bg-surface-subtle)] border-t border-[var(--border-subtle)] text-xs text-[var(--text-muted)] flex flex-wrap items-center justify-between gap-3">
        <span className="text-[12px]">
          💡 Click or drag on any shift to paint with the active brush.
        </span>
        <button
          type="button"
          onClick={onLaunch}
          className="font-bold text-[var(--brand-primary)] hover:underline inline-flex items-center gap-1 text-[13px]"
        >
          <span>Open Full Interactive Planner</span>
          <span>&rarr;</span>
        </button>
      </div>
    </div>
  );
}
