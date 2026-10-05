import {
  animate,
  motion,
  useInView,
  useReducedMotion,
  useScroll,
  useSpring,
  type Variants,
} from 'framer-motion';
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
   Inspired by Kronos HR and modern enterprise workforce management platforms.
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
    '--nav-glass': 'rgba(255, 255, 255, 0.88)',
    '--badge-bg': '#DBEAFE',
    '--badge-text': '#1E40AF',
    '--badge-border': '#BFDBFE',
    '--shadow-sm': '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    '--shadow-md': '0 4px 6px -1px rgba(0, 0, 0, 0.07), 0 2px 4px -2px rgba(0, 0, 0, 0.05)',
    '--shadow-lg': '0 10px 25px -3px rgba(0, 0, 0, 0.08), 0 4px 6px -4px rgba(0, 0, 0, 0.04)',
    '--shadow-xl': '0 20px 35px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.04)',
    '--shadow-glow': '0 12px 30px -10px rgba(37, 99, 235, 0.35)',
    // Shift chips
    '--chip-m-bg': '#FEF3C7', '--chip-m-fg': '#92400E',
    '--chip-e-bg': '#CCFBF1', '--chip-e-fg': '#0F766E',
    '--chip-n-bg': '#EDE9FE', '--chip-n-fg': '#5B21B6',
    '--chip-ml-bg': '#FDE68A', '--chip-ml-fg': '#78350F',
    '--chip-nl-bg': '#DDD6FE', '--chip-nl-fg': '#4C1D95',
    '--chip-lv-bg': '#FEE2E2', '--chip-lv-fg': '#B91C1C',
    '--chip-off-bg': '#F1F5F9', '--chip-off-fg': '#64748B',
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
    '--nav-glass': 'rgba(11, 15, 25, 0.85)',
    '--badge-bg': 'rgba(59, 130, 246, 0.15)',
    '--badge-text': '#93C5FD',
    '--badge-border': 'rgba(59, 130, 246, 0.3)',
    '--shadow-sm': '0 1px 2px 0 rgba(0, 0, 0, 0.3)',
    '--shadow-md': '0 4px 6px -1px rgba(0, 0, 0, 0.4), 0 2px 4px -2px rgba(0, 0, 0, 0.3)',
    '--shadow-lg': '0 10px 25px -3px rgba(0, 0, 0, 0.5), 0 4px 6px -4px rgba(0, 0, 0, 0.4)',
    '--shadow-xl': '0 20px 35px -5px rgba(0, 0, 0, 0.6), 0 8px 10px -6px rgba(0, 0, 0, 0.4)',
    '--shadow-glow': '0 12px 30px -10px rgba(59, 130, 246, 0.35)',
    // Shift chips
    '--chip-m-bg': '#3D2A08', '--chip-m-fg': '#FBBF24',
    '--chip-e-bg': '#0F3836', '--chip-e-fg': '#2DD4BF',
    '--chip-n-bg': '#2E1065', '--chip-n-fg': '#C4B5FD',
    '--chip-ml-bg': '#452A05', '--chip-ml-fg': '#FCD34D',
    '--chip-nl-bg': '#3B0764', '--chip-nl-fg': '#D8B4FE',
    '--chip-lv-bg': '#4C0519', '--chip-lv-fg': '#FDA4AF',
    '--chip-off-bg': 'rgba(255, 255, 255, 0.05)', '--chip-off-fg': '#64748B',
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
  M: { bg: 'var(--chip-m-bg)', fg: 'var(--chip-m-fg)', label: 'Morning', timing: '06:00 – 15:00' },
  E: { bg: 'var(--chip-e-bg)', fg: 'var(--chip-e-fg)', label: 'Evening', timing: '14:00 – 23:00' },
  N: { bg: 'var(--chip-n-bg)', fg: 'var(--chip-n-fg)', label: 'Night', timing: '22:00 – 07:00' },
  ML: { bg: 'var(--chip-ml-bg)', fg: 'var(--chip-ml-fg)', label: 'Morning Late', timing: '07:30 – 18:00' },
  NL: { bg: 'var(--chip-nl-bg)', fg: 'var(--chip-nl-fg)', label: 'Night Late', timing: '19:30 – 06:30' },
  LV: { bg: 'var(--chip-lv-bg)', fg: 'var(--chip-lv-fg)', label: 'Annual Leave', timing: 'Paid Off' },
  '-': { bg: 'var(--chip-off-bg)', fg: 'var(--chip-off-fg)', label: 'Scheduled Rest', timing: 'Weekly Rest' },
};

const BRUSH_OPTIONS = ['M', 'E', 'N', 'ML', 'NL', 'LV', '-'] as const;
const ACTIVE_WORKED = new Set(['M', 'E', 'N', 'ML', 'NL']);
const NIGHT_SHIFTS = new Set(['N', 'NL']);
const MORNING_SHIFTS = new Set(['M', 'ML']);

const DEMO_DAYS_COUNT = 14;
const INITIAL_DEMO_GRID = [
  { name: 'Zouhair Azzabi', role: 'PIC', dept: 'Line 5 Team A', codes: ['M', 'M', '-', 'M', 'M', 'M', '-', '-', 'M', 'M', 'M', '-', 'M', 'M'] },
  { name: 'Wesam B', role: 'MP', dept: 'Line 5 Team A', codes: ['LV', 'LV', 'LV', 'M', 'M', 'ML', '-', '-', 'M', 'M', 'ML', 'M', '-', '-'] },
  { name: 'Ajay Pal', role: 'MP', dept: 'Line 5 Team B', codes: ['E', 'E', 'E', '-', '-', 'E', 'E', 'E', '-', 'E', 'E', '-', '-', 'E'] },
  { name: 'Sher Khan', role: 'PIC', dept: 'Line 5 Team C', codes: ['N', 'N', '-', '-', 'N', 'N', 'N', 'NL', '-', '-', 'N', 'N', '-', '-'] },
  { name: 'John Paul', role: 'MP', dept: 'Line 5 Team C', codes: ['-', 'N', 'N', 'N', 'NL', '-', '-', 'N', 'N', 'N', '-', '-', 'N', 'N'] },
  { name: 'Srinivasa Rao', role: 'PIC', dept: 'Line 5 Special', codes: ['ML', 'ML', '-', 'M', 'M', '-', '-', 'M', 'ML', 'ML', '-', '-', 'M', 'ML'] },
];

/* ==========================================================================
   ANIMATION & UTILITY COMPONENTS
   ========================================================================== */

const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] },
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
      viewport={{ once: true, margin: '-40px' }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function StatCounter({ target, suffix = '', label }: { target: number; suffix?: string; label: string }) {
  const nodeRef = useRef<HTMLSpanElement>(null);
  const isInView = useInView(nodeRef, { once: true });
  const shouldReduceMotion = useReducedMotion();
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    if (!isInView) return;
    if (shouldReduceMotion) {
      setDisplayValue(target);
      return;
    }
    const animation = animate(0, target, {
      duration: 1.5,
      ease: 'easeOut',
      onUpdate: (latest) => setDisplayValue(Math.round(latest)),
    });
    return () => animation.stop();
  }, [isInView, target, shouldReduceMotion]);

  return (
    <div className="flex flex-col items-center sm:items-start text-center sm:text-left">
      <div className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[var(--text-primary)]">
        <span ref={nodeRef}>{displayValue}</span>
        <span className="text-[var(--brand-primary)]">{suffix}</span>
      </div>
      <p className="mt-1 text-xs sm:text-sm font-medium text-[var(--text-muted)]">{label}</p>
    </div>
  );
}

/* ==========================================================================
   MAIN LANDING PAGE COMPONENT
   ========================================================================== */

export function LandingPage({ onOpen }: { onOpen: () => void }) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [theme, setTheme] = useState<Theme>(readInitialTheme);
  const [activeFaq, setActiveFaq] = useState<number | null>(0);

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

  // Scroll tracking for progress indicator and sticky header shadow
  const { scrollYProgress, scrollY } = useScroll({ container: scrollContainerRef });
  const smoothProgress = useSpring(scrollYProgress, { stiffness: 140, damping: 25 });
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    return scrollY.on('change', (latest) => {
      setIsScrolled(latest > 20);
    });
  }, [scrollY]);

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Applied inline styling using active theme tokens
  const pageContainerStyles = useMemo<CSSProperties>(() => {
    return {
      ...PALETTES[theme],
      backgroundColor: 'var(--bg-main)',
      color: 'var(--text-primary)',
      fontFamily: "'Poppins', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      scrollBehavior: 'smooth',
      colorScheme: theme,
    };
  }, [theme]);

  return (
    <div
      ref={scrollContainerRef}
      className="fixed inset-0 overflow-y-auto overflow-x-hidden selection:bg-blue-500 selection:text-white"
      style={pageContainerStyles}
    >
      {/* Scroll Progress Bar */}
      <motion.div
        className="fixed top-0 left-0 right-0 h-[3px] z-[90] origin-left bg-[var(--brand-primary)]"
        style={{ scaleX: smoothProgress }}
      />

      {/* ====================================================================
          NAVBAR (Sticky, Glassmorphic, Brand Logo, Links, CTAs)
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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 sm:h-20 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
              className="flex items-center gap-2.5 group focus:outline-none"
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#1E40AF] to-[#3B82F6] flex items-center justify-center shadow-md shadow-blue-500/20 group-hover:scale-105 transition-transform">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                  <circle cx="8" cy="15" r="1.5" fill="#FFFFFF" />
                  <circle cx="16" cy="15" r="1.5" fill="#FFFFFF" />
                </svg>
              </div>
              <div className="flex flex-col text-left">
                <span className="text-xl font-extrabold tracking-tight text-[var(--text-primary)]">
                  Shift<span className="text-[var(--brand-primary)]">Line</span>
                </span>
                <span className="text-[10px] font-semibold tracking-wider uppercase text-[var(--text-muted)] -mt-0.5">
                  Roster Operations
                </span>
              </div>
            </button>
          </div>

          {/* Desktop Navigation Links */}
          <div className="hidden md:flex items-center gap-1.5 lg:gap-2">
            {[
              ['features', 'Core Features'],
              ['excel-sync', 'Excel 2-Way Sync'],
              ['compliance', 'Fatigue Compliance'],
              ['industries', 'Industries'],
              ['simulator', 'Interactive Demo'],
              ['faq', 'FAQ'],
            ].map(([id, label]) => (
              <button
                key={id}
                onClick={() => scrollToSection(id)}
                className="px-3 py-2 rounded-lg text-sm font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-subtle)] transition-colors"
              >
                {label}
              </button>
            ))}
          </div>

          {/* Right Action Buttons */}
          <div className="flex items-center gap-3">
            {/* Theme Switcher Button */}
            <button
              onClick={handleToggleTheme}
              aria-label="Toggle theme"
              className="p-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-medium)] transition-all shadow-sm"
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

            {/* Main Action Button */}
            <button
              onClick={onOpen}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-hover)] shadow-[var(--shadow-glow)] transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <span>Launch Roster</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </button>
          </div>
        </div>
      </nav>

      {/* ====================================================================
          HERO SECTION (Bold Enterprise Value Proposition like Kronos HR)
          ==================================================================== */}
      <section className="relative pt-12 pb-20 sm:pt-20 sm:pb-32 overflow-hidden bg-[var(--bg-hero)] border-b border-[var(--border-subtle)]">
        {/* Subtle Background Glow Circles */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-full overflow-hidden pointer-events-none -z-10 opacity-30 dark:opacity-20">
          <div className="absolute top-10 left-10 w-96 h-96 bg-blue-400 rounded-full blur-[120px]" />
          <div className="absolute top-20 right-10 w-96 h-96 bg-teal-400 rounded-full blur-[140px]" />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          {/* Top Pill Announcement */}
          <SectionReveal delayIndex={0}>
            <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full text-xs font-bold tracking-wide uppercase bg-[var(--badge-bg)] text-[var(--badge-text)] border border-[var(--badge-border)] shadow-sm">
              <span className="w-2 h-2 rounded-full bg-blue-600 animate-ping" />
              Enterprise Workforce Management &amp; Shift Scheduling
            </div>
          </SectionReveal>

          {/* Hero Main Headline (Echoing Kronos's "Simplify your team management") */}
          <SectionReveal delayIndex={1}>
            <h1 className="mt-7 text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-[var(--text-primary)] max-w-5xl mx-auto leading-[1.12]">
              Simplify your operational shift &amp; roster management.
            </h1>
          </SectionReveal>

          {/* Subtitle / Explainer */}
          <SectionReveal delayIndex={2}>
            <p className="mt-6 text-base sm:text-xl text-[var(--text-secondary)] max-w-3xl mx-auto leading-relaxed">
              The automated rostering engine built for 24/7 mission-critical operations: fair multi-shift rotations (Morning, Evening, Night), instant lossless Excel synchronization, live labor compliance &amp; fatigue rule guard—engineered so you never deal with broken spreadsheets again.
            </p>
          </SectionReveal>

          {/* Call-to-action buttons */}
          <SectionReveal delayIndex={3}>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
              <button
                onClick={onOpen}
                className="px-8 py-4 rounded-xl text-base font-bold text-white bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-hover)] shadow-xl shadow-blue-600/25 transition-all hover:scale-[1.03] active:scale-[0.98] inline-flex items-center gap-3"
              >
                <span>Launch Live Roster Platform</span>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </button>
              <button
                onClick={() => scrollToSection('simulator')}
                className="px-7 py-4 rounded-xl text-base font-bold text-[var(--text-primary)] bg-[var(--bg-card)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-medium)] shadow-sm hover:shadow transition-all inline-flex items-center gap-2"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--brand-primary)]">
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
                <span>Try Interactive Simulator</span>
              </button>
            </div>
          </SectionReveal>

          {/* Trust Guarantees */}
          <SectionReveal delayIndex={4}>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-6 text-xs sm:text-sm font-medium text-[var(--text-muted)]">
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

          {/* Hero Interactive App Mockup Showcase */}
          <SectionReveal delayIndex={5}>
            <div className="mt-14 max-w-5xl mx-auto rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-2 sm:p-4 shadow-[var(--shadow-xl)]">
              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] overflow-hidden text-left">
                {/* Mock Browser/App Header Bar */}
                <div className="px-4 py-3 border-b border-[var(--border-subtle)] bg-[var(--bg-card)] flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-red-400" />
                    <span className="w-3 h-3 rounded-full bg-amber-400" />
                    <span className="w-3 h-3 rounded-full bg-green-400" />
                    <span className="ml-2 font-mono text-xs font-semibold text-[var(--text-muted)]">
                      Operational Dashboard • Line 5 RST (September 2026)
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-green-100 text-green-700 dark:bg-green-950/60 dark:text-green-400 border border-green-300 dark:border-green-800">
                      ✓ Zero Compliance Violations
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400 border border-blue-300 dark:border-blue-800">
                      18/18 Staff Scheduled
                    </span>
                  </div>
                </div>

                {/* Hero Grid Preview with Real Operational Person Data */}
                <div className="p-3 sm:p-5 overflow-x-auto">
                  <div className="min-w-[650px]">
                    <div className="grid grid-cols-[140px_repeat(12,1fr)] gap-1.5 pb-2 text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)] border-b border-[var(--border-subtle)]">
                      <span>Engineer / Role</span>
                      {Array.from({ length: 12 }, (_, i) => (
                        <span key={i} className="text-center font-mono">
                          {i + 1} Sep
                        </span>
                      ))}
                    </div>

                    <div className="divide-y divide-[var(--border-subtle)] text-xs">
                      {[
                        { name: 'Zouhair Azzabi', role: 'PIC', shifts: ['M', 'M', '-', 'M', 'M', 'M', '-', '-', 'M', 'M', 'M', '-'] },
                        { name: 'Wesam B', role: 'MP', shifts: ['LV', 'LV', 'LV', 'M', 'M', 'ML', '-', '-', 'M', 'M', 'ML', 'M'] },
                        { name: 'Sher Khan', role: 'PIC', shifts: ['N', 'N', '-', '-', 'N', 'N', 'N', 'NL', '-', '-', 'N', 'N'] },
                        { name: 'Ajay Pal', role: 'MP', shifts: ['E', 'E', 'E', '-', '-', 'E', 'E', 'E', '-', 'E', 'E', '-'] },
                      ].map((row, idx) => (
                        <div key={idx} className="grid grid-cols-[140px_repeat(12,1fr)] items-center gap-1.5 py-2.5">
                          <div className="flex flex-col">
                            <span className="font-bold text-[var(--text-primary)] truncate">{row.name}</span>
                            <span className="text-[10px] font-medium text-[var(--text-muted)]">{row.role} • Line 5</span>
                          </div>
                          {row.shifts.map((shift, sIdx) => {
                            const token = SHIFT_TOKENS[shift] ?? SHIFT_TOKENS['-'];
                            return (
                              <div
                                key={sIdx}
                                className="h-7 rounded-md font-bold text-[11px] flex items-center justify-center transition-all shadow-xs"
                                style={{ backgroundColor: token.bg, color: token.fg }}
                              >
                                {shift === '-' ? '·' : shift}
                              </div>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Bottom Bar in Hero Card */}
                <div className="px-4 py-3 bg-[var(--bg-card)] border-t border-[var(--border-subtle)] flex items-center justify-between text-xs text-[var(--text-muted)] font-medium">
                  <span>Daily Coverage: Morning 3-5 • Evening 2-3 • Night 2-4</span>
                  <button
                    onClick={onOpen}
                    className="font-bold text-[var(--brand-primary)] hover:underline inline-flex items-center gap-1"
                  >
                    Open Full Planner View &rarr;
                  </button>
                </div>
              </div>
            </div>
          </SectionReveal>
        </div>
      </section>

      {/* ====================================================================
          METRICS & TRUST STRIP (4 Pillars of Operational Reliability)
          ==================================================================== */}
      <section className="py-12 sm:py-16 bg-[var(--bg-surface)] border-b border-[var(--border-subtle)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 sm:gap-12">
            <SectionReveal delayIndex={0}>
              <StatCounter target={30} suffix="s" label="To generate full monthly schedule" />
            </SectionReveal>
            <SectionReveal delayIndex={1}>
              <StatCounter target={100} suffix="%" label="Offline resilience with zero cloud lag" />
            </SectionReveal>
            <SectionReveal delayIndex={2}>
              <StatCounter target={14} suffix="+" label="Built-in labor & fatigue compliance rules" />
            </SectionReveal>
            <SectionReveal delayIndex={3}>
              <StatCounter target={100} suffix="%" label="Fidelity round-trip Excel import/export" />
            </SectionReveal>
          </div>
        </div>
      </section>

      {/* ====================================================================
          WHY CHOOSE SHIFTLINE? (Matching Kronos HR's "Why choose Kronos?")
          ==================================================================== */}
      <section className="py-20 sm:py-28 bg-[var(--bg-main)] border-b border-[var(--border-subtle)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto">
            <h2 className="text-xs font-bold tracking-widest text-[var(--brand-primary)] uppercase">
              Operational Excellence
            </h2>
            <p className="mt-3 text-3xl sm:text-4xl font-extrabold tracking-tight text-[var(--text-primary)]">
              Why shift leaders choose ShiftLine
            </p>
            <p className="mt-4 text-base sm:text-lg text-[var(--text-secondary)]">
              Managing 24/7 rotating teams shouldn&apos;t require expensive IT consulting or fragile spreadsheet macros. We deliver power and precision without the headache.
            </p>
          </div>

          <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Card 1: Simplicity */}
            <SectionReveal delayIndex={0}>
              <div className="h-full p-8 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-md)] transition-all">
                <div className="w-14 h-14 rounded-xl bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                  </svg>
                </div>
                <h3 className="mt-6 text-xl font-bold text-[var(--text-primary)]">Uncompromising Simplicity</h3>
                <p className="mt-3 text-sm text-[var(--text-secondary)] leading-relaxed">
                  Forget multi-week software training and clunky enterprise interfaces. ShiftLine is built for operations supervisors and engineers to plan, rotate, and print in minutes.
                </p>
                <ul className="mt-6 space-y-2 text-xs font-semibold text-[var(--text-muted)]">
                  <li className="flex items-center gap-2">✓ No sign-up or accounts required</li>
                  <li className="flex items-center gap-2">✓ Visual brush painting tool</li>
                  <li className="flex items-center gap-2">✓ Instant keyboard undo/redo</li>
                </ul>
              </div>
            </SectionReveal>

            {/* Card 2: All-in-One Engine */}
            <SectionReveal delayIndex={1}>
              <div className="h-full p-8 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-md)] transition-all">
                <div className="w-14 h-14 rounded-xl bg-teal-100 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 flex items-center justify-center">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                    <line x1="8" y1="21" x2="16" y2="21" />
                    <line x1="12" y1="17" x2="12" y2="21" />
                  </svg>
                </div>
                <h3 className="mt-6 text-xl font-bold text-[var(--text-primary)]">All-In-One Shift Platform</h3>
                <p className="mt-3 text-sm text-[var(--text-secondary)] leading-relaxed">
                  Everything connects together: employee contact rosters, 5-on/2-off fixed rest day pairs, vacation leave blocks, live headcount counts, and fair rotation pools.
                </p>
                <ul className="mt-6 space-y-2 text-xs font-semibold text-[var(--text-muted)]">
                  <li className="flex items-center gap-2">✓ Multi-line team isolation (Line 4/5/6)</li>
                  <li className="flex items-center gap-2">✓ Pinned specialist staff handling</li>
                  <li className="flex items-center gap-2">✓ Live headcount deficit rail</li>
                </ul>
              </div>
            </SectionReveal>

            {/* Card 3: Enterprise Excel Compatibility */}
            <SectionReveal delayIndex={2}>
              <div className="h-full p-8 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-md)] transition-all">
                <div className="w-14 h-14 rounded-xl bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                    <polyline points="10 9 9 9 8 9" />
                  </svg>
                </div>
                <h3 className="mt-6 text-xl font-bold text-[var(--text-primary)]">True Excel Synchronization</h3>
                <p className="mt-3 text-sm text-[var(--text-secondary)] leading-relaxed">
                  You don&apos;t have to abandon the spreadsheets management requires. Import any departmental roster layout, optimize it with rule guards, and export it back in the exact same format.
                </p>
                <ul className="mt-6 space-y-2 text-xs font-semibold text-[var(--text-muted)]">
                  <li className="flex items-center gap-2">✓ Preserves section headers (PIC/MP)</li>
                  <li className="flex items-center gap-2">✓ Exports live COUNTIF calculation rows</li>
                  <li className="flex items-center gap-2">✓ Automatic serial date number parsing</li>
                </ul>
              </div>
            </SectionReveal>
          </div>
        </div>
      </section>

      {/* ====================================================================
          CORE FEATURES BREAKDOWN (Matching Kronos HR "See what's inside Kronos")
          ==================================================================== */}
      <section id="features" className="py-20 sm:py-28 bg-[var(--bg-surface)] border-b border-[var(--border-subtle)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto">
            <h2 className="text-xs font-bold tracking-widest text-[var(--brand-primary)] uppercase">
              Product Capabilities
            </h2>
            <p className="mt-3 text-3xl sm:text-4xl font-extrabold tracking-tight text-[var(--text-primary)]">
              See what&apos;s inside ShiftLine
            </p>
            <p className="mt-4 text-base sm:text-lg text-[var(--text-secondary)]">
              Every feature is tuned to solve the exact real-world pain points of operations rosters.
            </p>
          </div>

          <div className="mt-16 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <SectionReveal delayIndex={0}>
              <div className="h-full p-7 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
                <div>
                  <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-[var(--brand-primary)] flex items-center justify-center font-bold text-lg">
                    01
                  </div>
                  <h3 className="mt-5 text-lg font-bold text-[var(--text-primary)]">
                    Intelligent Auto-Rotation Engine
                  </h3>
                  <p className="mt-2.5 text-sm text-[var(--text-secondary)] leading-relaxed">
                    Generate an entire month of roster assignments with a single click. The scheduler dynamically balances Morning, Evening, and Night rotations based on individual assignment history to prevent fatigue.
                  </p>
                  <ul className="mt-5 space-y-2 text-xs text-[var(--text-secondary)]">
                    <li className="flex items-center gap-2 font-medium">• Strict 5-on / 2-off weekly cycle preservation</li>
                    <li className="flex items-center gap-2 font-medium">• Pinned status for General Shift &amp; Project staff</li>
                    <li className="flex items-center gap-2 font-medium">• Mid-month schedule transition management</li>
                  </ul>
                </div>
                <div className="mt-6 pt-4 border-t border-[var(--border-subtle)] flex items-center justify-between text-xs font-bold text-[var(--brand-primary)]">
                  <span>Smart Scheduling</span>
                  <span>&rarr;</span>
                </div>
              </div>
            </SectionReveal>

            {/* Feature 2 */}
            <SectionReveal delayIndex={1}>
              <div className="h-full p-7 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
                <div>
                  <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-lg">
                    02
                  </div>
                  <h3 className="mt-5 text-lg font-bold text-[var(--text-primary)]">
                    Lossless Excel 2-Way Synchronization
                  </h3>
                  <p className="mt-2.5 text-sm text-[var(--text-secondary)] leading-relaxed">
                    Import any department&apos;s existing Excel roster. The parser reads complex operational files with separate PIC/MP shift sections, skips summary count rows, decodes date serials, and maps verbose shift timings.
                  </p>
                  <ul className="mt-5 space-y-2 text-xs text-[var(--text-secondary)]">
                    <li className="flex items-center gap-2 font-medium">• Scans up to 20 rows deep for name aliases</li>
                    <li className="flex items-center gap-2 font-medium">• Reads date serial numbers (e.g. 46701 &rarr; 01-Sep)</li>
                    <li className="flex items-center gap-2 font-medium">• Exports operational format matching management&apos;s layout</li>
                  </ul>
                </div>
                <div className="mt-6 pt-4 border-t border-[var(--border-subtle)] flex items-center justify-between text-xs font-bold text-emerald-600 dark:text-emerald-400">
                  <span>Full Round-Trip</span>
                  <span>&rarr;</span>
                </div>
              </div>
            </SectionReveal>

            {/* Feature 3 */}
            <SectionReveal delayIndex={2}>
              <div className="h-full p-7 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
                <div>
                  <div className="w-12 h-12 rounded-xl bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 flex items-center justify-center font-bold text-lg">
                    03
                  </div>
                  <h3 className="mt-5 text-lg font-bold text-[var(--text-primary)]">
                    Live Labor Compliance &amp; Fatigue Guard
                  </h3>
                  <p className="mt-2.5 text-sm text-[var(--text-secondary)] leading-relaxed">
                    Prevent workplace accidents and compliance fines. ShiftLine verifies labor rules in real time, alerting you the moment an engineer is scheduled for a dangerous Night-to-Morning turnaround or exceeds consecutive working days.
                  </p>
                  <ul className="mt-5 space-y-2 text-xs text-[var(--text-secondary)]">
                    <li className="flex items-center gap-2 font-medium">• Night-to-Morning turnaround violation alerts</li>
                    <li className="flex items-center gap-2 font-medium">• Consecutive working days limits (&gt;6 days)</li>
                    <li className="flex items-center gap-2 font-medium">• Minimum headcount per shift thresholds</li>
                  </ul>
                </div>
                <div className="mt-6 pt-4 border-t border-[var(--border-subtle)] flex items-center justify-between text-xs font-bold text-red-600 dark:text-red-400">
                  <span>Fatigue Safety</span>
                  <span>&rarr;</span>
                </div>
              </div>
            </SectionReveal>

            {/* Feature 4 */}
            <SectionReveal delayIndex={3}>
              <div className="h-full p-7 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
                <div>
                  <div className="w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold text-lg">
                    04
                  </div>
                  <h3 className="mt-5 text-lg font-bold text-[var(--text-primary)]">
                    Interactive Brush Painting &amp; Editing
                  </h3>
                  <p className="mt-2.5 text-sm text-[var(--text-secondary)] leading-relaxed">
                    Make manual schedule tweaks effortless. Select any shift code (Morning, Night, Late Shift, Leave, Off) and click or drag across the 30-day calendar view to instantly paint cells.
                  </p>
                  <ul className="mt-5 space-y-2 text-xs text-[var(--text-secondary)]">
                    <li className="flex items-center gap-2 font-medium">• Instant multi-step Undo &amp; Redo (Ctrl+Z / Ctrl+Y)</li>
                    <li className="flex items-center gap-2 font-medium">• Auto-creates newly discovered Excel codes (ML, NL, EL)</li>
                    <li className="flex items-center gap-2 font-medium">• Custom zoom controls (80% to 150%) for large rosters</li>
                  </ul>
                </div>
                <div className="mt-6 pt-4 border-t border-[var(--border-subtle)] flex items-center justify-between text-xs font-bold text-amber-600 dark:text-amber-400">
                  <span>Fast Grid Editing</span>
                  <span>&rarr;</span>
                </div>
              </div>
            </SectionReveal>

            {/* Feature 5 */}
            <SectionReveal delayIndex={4}>
              <div className="h-full p-7 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
                <div>
                  <div className="w-12 h-12 rounded-xl bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold text-lg">
                    05
                  </div>
                  <h3 className="mt-5 text-lg font-bold text-[var(--text-primary)]">
                    Live Headcount &amp; Coverage Rail
                  </h3>
                  <p className="mt-2.5 text-sm text-[var(--text-secondary)] leading-relaxed">
                    Always maintain adequate line staffing. The collapsible headcount rail calculates real-time active engineers per shift for every calendar day, giving you instant visual warnings when staffing drops below required minimums.
                  </p>
                  <ul className="mt-5 space-y-2 text-xs text-[var(--text-secondary)]">
                    <li className="flex items-center gap-2 font-medium">• Separate certified engineers vs support staff</li>
                    <li className="flex items-center gap-2 font-medium">• Per-employee monthly working hours calculation</li>
                    <li className="flex items-center gap-2 font-medium">• Visual badges showing staffing surplus &amp; deficit</li>
                  </ul>
                </div>
                <div className="mt-6 pt-4 border-t border-[var(--border-subtle)] flex items-center justify-between text-xs font-bold text-purple-600 dark:text-purple-400">
                  <span>Staffing Balance</span>
                  <span>&rarr;</span>
                </div>
              </div>
            </SectionReveal>

            {/* Feature 6 */}
            <SectionReveal delayIndex={5}>
              <div className="h-full p-7 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
                <div>
                  <div className="w-12 h-12 rounded-xl bg-cyan-50 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400 flex items-center justify-center font-bold text-lg">
                    06
                  </div>
                  <h3 className="mt-5 text-lg font-bold text-[var(--text-primary)]">
                    Local-First Privacy &amp; Multi-Line Management
                  </h3>
                  <p className="mt-2.5 text-sm text-[var(--text-secondary)] leading-relaxed">
                    Your workforce data remains strictly confidential and stored directly on your browser via IndexedDB. Create multiple operational production lines (Line 4, Line 5, Line 6) with a shared taxonomy of shift codes.
                  </p>
                  <ul className="mt-5 space-y-2 text-xs text-[var(--text-secondary)]">
                    <li className="flex items-center gap-2 font-medium">• Automatic full Excel backup download on every Save</li>
                    <li className="flex items-center gap-2 font-medium">• JSON backup archive creation &amp; one-click restore</li>
                    <li className="flex items-center gap-2 font-medium">• 100% operational during internet or network outages</li>
                  </ul>
                </div>
                <div className="mt-6 pt-4 border-t border-[var(--border-subtle)] flex items-center justify-between text-xs font-bold text-cyan-600 dark:text-cyan-400">
                  <span>Security &amp; Privacy</span>
                  <span>&rarr;</span>
                </div>
              </div>
            </SectionReveal>
          </div>
        </div>
      </section>

      {/* ====================================================================
          EXCEL 2-WAY SYNCHRONIZATION DETAIL SECTION
          ==================================================================== */}
      <section id="excel-sync" className="py-20 sm:py-28 bg-[var(--bg-main)] border-b border-[var(--border-subtle)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <SectionReveal delayIndex={0}>
              <div>
                <span className="text-xs font-bold tracking-widest text-[var(--brand-primary)] uppercase">
                  Zero Scraping Loss
                </span>
                <h2 className="mt-3 text-3xl sm:text-4xl font-extrabold tracking-tight text-[var(--text-primary)]">
                  The spreadsheet-compatible rostering platform
                </h2>
                <p className="mt-4 text-base sm:text-lg text-[var(--text-secondary)] leading-relaxed">
                  Most rostering tools force you to rewrite your company&apos;s workflow. ShiftLine was engineered to seamlessly ingest your department&apos;s exact Excel files, perform rule checks, and export the file back with every formula and section intact.
                </p>

                <div className="mt-8 space-y-4">
                  {[
                    {
                      title: 'Multi-Section Departmental Grouping',
                      desc: 'Correctly preserves operational groups like PIC Morning shift, MP Night shift, and skips internal count rows without stopping.',
                    },
                    {
                      title: 'Automatic Date & Serial Number Decoding',
                      desc: 'Seamlessly handles Excel date numbers (e.g. 46701) and zero-padded day numbers (01-Sep) without missing columns.',
                    },
                    {
                      title: 'Verbose Timing Normalization',
                      desc: 'Translates verbose entries like "Morning Early | 07:30-18:00 | 11H" into standard tokens while retaining original hours.',
                    },
                    {
                      title: 'Executive Operational Export',
                      desc: 'Exports clean, beautiful Excel workbooks with colored headers, count summaries, and live COUNTIF headcount formulas.',
                    },
                  ].map((item, idx) => (
                    <div key={idx} className="flex gap-4">
                      <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/40 text-[var(--brand-primary)] flex items-center justify-center shrink-0 font-bold text-xs mt-0.5">
                        ✓
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-[var(--text-primary)]">{item.title}</h4>
                        <p className="mt-1 text-xs text-[var(--text-secondary)] leading-relaxed">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </SectionReveal>

            {/* Visual Mapping Simulation Card */}
            <SectionReveal delayIndex={1}>
              <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-6 sm:p-8 shadow-[var(--shadow-md)]">
                <div className="flex items-center justify-between pb-4 border-b border-[var(--border-subtle)]">
                  <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                    Excel Parsing Pipeline
                  </span>
                  <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400 font-bold">
                    xlsx-js-style Engine
                  </span>
                </div>

                <div className="mt-6 space-y-4 font-mono text-xs">
                  {/* Step 1 */}
                  <div className="p-3 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)]">
                    <div className="flex items-center justify-between text-[var(--text-muted)] mb-1">
                      <span>Source Excel Cell:</span>
                      <span className="text-emerald-600 dark:text-emerald-400">Raw Format</span>
                    </div>
                    <div className="font-bold text-[var(--text-primary)]">
                      &quot;Morning Early | 07:30-18:00 | 11H&quot; (PIC Morning)
                    </div>
                  </div>

                  {/* Flow Arrow */}
                  <div className="flex justify-center text-[var(--brand-primary)] font-bold text-sm">
                    &darr; Smart Normalizer &darr;
                  </div>

                  {/* Step 2 */}
                  <div className="p-3 rounded-xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900">
                    <div className="flex items-center justify-between text-[var(--text-muted)] mb-1">
                      <span>Mapped Token &amp; Schedule Rule:</span>
                      <span className="text-[var(--brand-primary)] font-bold">Engine Code</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded font-bold bg-[#FEF3C7] text-[#92400E]">M</span>
                      <span className="text-[var(--text-primary)] font-medium">Morning Shift (06:00 – 15:00) • Engineer</span>
                    </div>
                  </div>

                  {/* Flow Arrow */}
                  <div className="flex justify-center text-[var(--brand-primary)] font-bold text-sm">
                    &darr; Operational Export &darr;
                  </div>

                  {/* Step 3 */}
                  <div className="p-3 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900">
                    <div className="flex items-center justify-between text-[var(--text-muted)] mb-1">
                      <span>Target Management Workbook:</span>
                      <span className="text-emerald-600 dark:text-emerald-400 font-bold">Formatted .xlsx</span>
                    </div>
                    <div className="font-bold text-[var(--text-primary)]">
                      &quot;Morning Early | 07:30-18:00 | 11H&quot; + Section &amp; Working Counts
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-[var(--border-subtle)] text-center">
                  <button
                    onClick={onOpen}
                    className="text-xs font-bold text-[var(--brand-primary)] hover:underline inline-flex items-center gap-1"
                  >
                    Test with your own Excel file now &rarr;
                  </button>
                </div>
              </div>
            </SectionReveal>
          </div>
        </div>
      </section>

      {/* ====================================================================
          INDUSTRIES SECTION (Matching Kronos HR "Industries")
          ==================================================================== */}
      <section id="industries" className="py-20 sm:py-28 bg-[var(--bg-surface)] border-b border-[var(--border-subtle)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto">
            <h2 className="text-xs font-bold tracking-widest text-[var(--brand-primary)] uppercase">
              Target Sectors
            </h2>
            <p className="mt-3 text-3xl sm:text-4xl font-extrabold tracking-tight text-[var(--text-primary)]">
              Tailored for mission-critical operations
            </p>
            <p className="mt-4 text-base sm:text-lg text-[var(--text-secondary)]">
              ShiftLine fits any organization running rotating personnel, but delivers maximum value in continuous 24/7 environments:
            </p>
          </div>

          <div className="mt-16 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                title: 'Rail & Transit Lines',
                subtitle: 'Metro Line 4/5/6 Engineering',
                desc: 'Coordinate signaling technicians, track maintenance engineers, and PIC/MP teams with strict night and weekend rotations.',
                icon: (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="4" y="3" width="16" height="16" rx="2" />
                    <path d="M4 11h16M12 3v8M8 19l-2 3M16 19l2 3M9 15h.01M15 15h.01" />
                  </svg>
                ),
              },
              {
                title: 'Healthcare & Emergency',
                subtitle: 'Hospitals, Clinics, & ICUs',
                desc: 'Protect patient care by preventing physician and nursing burnout with automated turnaround enforcement and leave locks.',
                icon: (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                  </svg>
                ),
              },
              {
                title: 'Security & Critical Infrastructure',
                subtitle: '24/7 Command Centers & Guards',
                desc: 'Ensure continuous post coverage with zero gaps. Manage fixed guard assignments alongside rotating patrol units.',
                icon: (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                ),
              },
              {
                title: 'Manufacturing & Plants',
                subtitle: 'Assembly Lines & Facilities',
                desc: 'Balance plant operator shifts against weekly rest quotas, track overtime hours, and export compliant work schedules.',
                icon: (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                  </svg>
                ),
              },
            ].map((ind, idx) => (
              <SectionReveal key={idx} delayIndex={idx}>
                <div className="h-full p-6 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] shadow-xs hover:shadow-md transition-all flex flex-col justify-between">
                  <div>
                    <div className="w-12 h-12 rounded-xl bg-[var(--bg-surface-subtle)] text-[var(--brand-primary)] flex items-center justify-center">
                      {ind.icon}
                    </div>
                    <h3 className="mt-5 text-base font-bold text-[var(--text-primary)]">{ind.title}</h3>
                    <p className="text-xs font-semibold text-[var(--brand-primary)] mt-0.5">{ind.subtitle}</p>
                    <p className="mt-3 text-xs text-[var(--text-secondary)] leading-relaxed">{ind.desc}</p>
                  </div>
                  <div className="mt-6 pt-3 border-t border-[var(--border-subtle)] text-[11px] font-bold text-[var(--text-muted)]">
                    ✓ Full Compliance Supported
                  </div>
                </div>
              </SectionReveal>
            ))}
          </div>
        </div>
      </section>

      {/* ====================================================================
          INTERACTIVE SIMULATOR (Try Before Launching)
          ==================================================================== */}
      <section id="simulator" className="py-20 sm:py-28 bg-[var(--bg-main)] border-b border-[var(--border-subtle)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <span className="text-xs font-bold tracking-widest text-[var(--brand-primary)] uppercase">
              Hands-On Demonstration
            </span>
            <h2 className="mt-3 text-3xl sm:text-4xl font-extrabold tracking-tight text-[var(--text-primary)]">
              Interactive Roster Simulator
            </h2>
            <p className="mt-4 text-base sm:text-lg text-[var(--text-secondary)]">
              Select a shift brush below and click or drag across the schedule grid. Watch the live headcount update and see rule violation guards trigger instantly.
            </p>
          </div>

          <SectionReveal delayIndex={0}>
            <InteractiveRosterPlayground />
          </SectionReveal>

          {/* Under Simulator CTA */}
          <div className="mt-10 text-center">
            <button
              onClick={onOpen}
              className="px-8 py-3.5 rounded-xl text-sm font-bold text-white bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-hover)] shadow-lg shadow-blue-500/25 transition-all inline-flex items-center gap-2"
            >
              <span>Launch Live Roster for Your Organization</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </button>
          </div>
        </div>
      </section>

      {/* ====================================================================
          COMPARISON TABLE (Traditional Excel vs. ShiftLine Platform)
          ==================================================================== */}
      <section className="py-20 sm:py-28 bg-[var(--bg-surface)] border-b border-[var(--border-subtle)]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-xs font-bold tracking-widest text-[var(--brand-primary)] uppercase">
              Proven Comparison
            </h2>
            <p className="mt-3 text-3xl sm:text-4xl font-extrabold tracking-tight text-[var(--text-primary)]">
              Manual Spreadsheets vs. ShiftLine
            </p>
          </div>

          <SectionReveal delayIndex={0}>
            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] overflow-hidden shadow-sm">
              <div className="grid grid-cols-3 p-4 sm:p-6 bg-[var(--bg-surface-subtle)] font-bold text-xs sm:text-sm text-[var(--text-primary)] border-b border-[var(--border-subtle)]">
                <span>Rostering Challenge</span>
                <span className="text-red-600 dark:text-red-400">Manual Spreadsheets</span>
                <span className="text-[var(--brand-primary)]">ShiftLine Platform</span>
              </div>

              <div className="divide-y divide-[var(--border-subtle)] text-xs sm:text-sm">
                {[
                  {
                    aspect: 'Time to generate a full month',
                    manual: '3 to 6 hours of copy-pasting',
                    shiftline: 'Under 30 seconds automated generation',
                  },
                  {
                    aspect: 'Fatigue & turnaround safety',
                    manual: 'Dangerous Night-to-Morning errors go unnoticed',
                    shiftline: 'Real-time rule alerts prevent unsafe scheduling',
                  },
                  {
                    aspect: 'Multi-shift fairness balance',
                    manual: 'Unfair assignment complaints from night staff',
                    shiftline: 'Balanced auto-rotation pool based on history',
                  },
                  {
                    aspect: 'Leave and vacation handling',
                    manual: 'Accidental shifts scheduled over approved leave',
                    shiftline: 'Approved leave blocks prevent accidental scheduling',
                  },
                  {
                    aspect: 'Excel file sharing',
                    manual: 'Macros break, conditional formatting bloats size',
                    shiftline: 'Clean, native Excel export with live formulas',
                  },
                  {
                    aspect: 'Software cost & privacy',
                    manual: 'Fragile DIY spreadsheets or bloated SaaS subscriptions',
                    shiftline: '100% private, runs in-browser, zero cloud downtime',
                  },
                ].map((row, i) => (
                  <div key={i} className="grid grid-cols-3 p-4 sm:p-6 items-center">
                    <span className="font-semibold text-[var(--text-primary)]">{row.aspect}</span>
                    <span className="text-red-600 dark:text-red-400 font-medium">{row.manual}</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1.5">
                      <span className="text-xs">✓</span> {row.shiftline}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </SectionReveal>
        </div>
      </section>

      {/* ====================================================================
          FAQ SECTION (Accordions addressing common executive questions)
          ==================================================================== */}
      <section id="faq" className="py-20 sm:py-28 bg-[var(--bg-main)] border-b border-[var(--border-subtle)]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-xs font-bold tracking-widest text-[var(--brand-primary)] uppercase">
              Frequently Asked Questions
            </span>
            <p className="mt-3 text-3xl sm:text-4xl font-extrabold tracking-tight text-[var(--text-primary)]">
              Got questions? We have answers.
            </p>
          </div>

          <div className="space-y-4">
            {[
              {
                q: 'How does ShiftLine handle my existing department Excel files?',
                a: 'ShiftLine includes a custom-engineered Excel parser that scans the first 20 rows and 6 columns for employee name headers, identifies calendar day columns (including Excel date serial numbers like 46701), skips internal count and section rows, and normalizes verbose shift text (such as "Morning Early | 07:30-18:00") into standard shift tokens. When exporting, you can choose the Operational Export to mirror your original layout exactly.',
              },
              {
                q: 'Where is my workforce data stored? Is it secure?',
                a: 'Your data is 100% private and stored directly in your browser using IndexedDB (Dexie.js). Nothing is ever transmitted to an external server or cloud database. Furthermore, every time you click "Save", ShiftLine automatically downloads an encrypted full Excel backup to your computer, and you can export or restore complete JSON backups at any time.',
              },
              {
                q: 'Can we manage multiple lines, departments, or shifts simultaneously?',
                a: 'Yes. ShiftLine includes native multi-line support. You can configure Line 4, Line 5, Line 6, or custom operational divisions. Each line maintains its own independent personnel roster and monthly schedule, while sharing a unified taxonomy of shift codes so definitions remain consistent across your company.',
              },
              {
                q: 'What specific compliance and labor rules does the system check?',
                a: 'ShiftLine monitors high-risk fatigue factors in real time, including: dangerous Night-to-Morning turnaround violations, maximum consecutive working days limits (flagging runs over 6 days), minimum headcount staffing requirements per shift, and leave conflicts (preventing assigning shifts to personnel on approved vacation or medical leave).',
              },
              {
                q: 'Can we define custom shift codes and working hours?',
                a: 'Yes. In Setup, you can define an unlimited number of shift codes with custom labels, working hours, tones, engineer counting flags, and rotation pool inclusion. Any new shift codes found inside an imported Excel file (such as ML for Morning Late or NL for Night Late) are automatically created with smart color and timing defaults.',
              },
            ].map((faqItem, idx) => {
              const isOpen = activeFaq === idx;
              return (
                <SectionReveal key={idx} delayIndex={idx * 0.5}>
                  <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] overflow-hidden shadow-xs transition-all">
                    <button
                      onClick={() => setActiveFaq(isOpen ? null : idx)}
                      className="w-full p-5 text-left font-bold text-sm sm:text-base text-[var(--text-primary)] flex items-center justify-between gap-4 hover:bg-[var(--bg-card-hover)] transition-colors"
                    >
                      <span>{faqItem.q}</span>
                      <span className="text-[var(--brand-primary)] shrink-0 font-mono text-lg font-bold">
                        {isOpen ? '−' : '+'}
                      </span>
                    </button>
                    {isOpen && (
                      <div className="px-5 pb-5 text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed border-t border-[var(--border-subtle)] pt-3">
                        {faqItem.a}
                      </div>
                    )}
                  </div>
                </SectionReveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* ====================================================================
          FINAL CALL TO ACTION BANNER (Echoing Kronos HR Conversion Block)
          ==================================================================== */}
      <section className="py-20 sm:py-28 bg-[var(--bg-surface)]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionReveal delayIndex={0}>
            <div className="rounded-3xl bg-[var(--bg-cta-banner)] p-8 sm:p-16 text-center text-white shadow-2xl relative overflow-hidden">
              {/* Background Geometric Rings */}
              <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 rounded-full border border-white/10 pointer-events-none" />
              <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-80 h-80 rounded-full border border-white/10 pointer-events-none" />

              <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight leading-tight">
                Ready to transform your operational roster management?
              </h2>
              <p className="mt-5 text-base sm:text-xl text-blue-100 max-w-2xl mx-auto leading-relaxed">
                Launch ShiftLine instantly in your browser. Start with the built-in September demo month, or drop in your department&apos;s Excel file right now.
              </p>

              <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
                <button
                  onClick={onOpen}
                  className="px-9 py-4 rounded-xl text-base font-extrabold text-[#1E3A8A] bg-white hover:bg-blue-50 shadow-xl transition-all hover:scale-105 active:scale-95 inline-flex items-center gap-2"
                >
                  <span>Launch Live Roster Platform</span>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="12 5 19 12 12 19" />
                  </svg>
                </button>
              </div>

              <div className="mt-8 text-xs font-semibold text-blue-200">
                Works 100% offline • Instant local database storage • Zero cloud vendor lock-in
              </div>
            </div>
          </SectionReveal>
        </div>
      </section>

      {/* ====================================================================
          FOOTER (Enterprise Corporate Navigation & Copyright)
          ==================================================================== */}
      <footer className="bg-[var(--bg-main)] border-t border-[var(--border-subtle)] py-14 text-xs text-[var(--text-muted)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
            {/* Col 1 */}
            <div className="md:col-span-2">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[var(--brand-primary)] flex items-center justify-center text-white font-bold text-sm">
                  SL
                </div>
                <span className="text-lg font-extrabold text-[var(--text-primary)]">
                  Shift<span className="text-[var(--brand-primary)]">Line</span>
                </span>
              </div>
              <p className="mt-3 text-xs text-[var(--text-secondary)] max-w-sm leading-relaxed">
                The next-generation workforce rostering system. Designed for rail lines, hospital units, manufacturing facilities, and 24/7 mission-critical operations.
              </p>
            </div>

            {/* Col 2 */}
            <div>
              <h4 className="font-bold text-xs uppercase tracking-wider text-[var(--text-primary)]">System Navigation</h4>
              <ul className="mt-3 space-y-2">
                <li><button onClick={() => scrollToSection('features')} className="hover:text-[var(--text-primary)]">Core Features</button></li>
                <li><button onClick={() => scrollToSection('excel-sync')} className="hover:text-[var(--text-primary)]">Excel Sync Engine</button></li>
                <li><button onClick={() => scrollToSection('compliance')} className="hover:text-[var(--text-primary)]">Fatigue &amp; Rules</button></li>
                <li><button onClick={() => scrollToSection('simulator')} className="hover:text-[var(--text-primary)]">Interactive Demo</button></li>
              </ul>
            </div>

            {/* Col 3 */}
            <div>
              <h4 className="font-bold text-xs uppercase tracking-wider text-[var(--text-primary)]">Quick Actions</h4>
              <ul className="mt-3 space-y-2">
                <li><button onClick={onOpen} className="font-bold text-[var(--brand-primary)] hover:underline">Open Live Roster</button></li>
                <li><button onClick={handleToggleTheme} className="hover:text-[var(--text-primary)]">Toggle Light/Dark Theme</button></li>
                <li><button onClick={() => scrollToSection('faq')} className="hover:text-[var(--text-primary)]">Help &amp; FAQ</button></li>
              </ul>
            </div>
          </div>

          <div className="pt-8 border-t border-[var(--border-subtle)] flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
            <span>&copy; {new Date().getFullYear()} ShiftLine Workforce Systems. Built for high-reliability operational rosters.</span>
            <span>Local-first architecture &bull; Fully offline &bull; Confidential data storage</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ==========================================================================
   INTERACTIVE ROSTER PLAYGROUND (Embedded in Simulator Section)
   ========================================================================== */

function InteractiveRosterPlayground() {
  const [selectedBrush, setSelectedBrush] = useState<string>('M');
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
    <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] overflow-hidden shadow-[var(--shadow-lg)]">
      {/* Top Brush Selection Toolbar */}
      <div className="p-4 border-b border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] mr-1">
            Active Shift Brush:
          </span>
          {BRUSH_OPTIONS.map((code) => {
            const token = SHIFT_TOKENS[code];
            const isSelected = selectedBrush === code;
            return (
              <button
                key={code}
                type="button"
                onClick={() => setSelectedBrush(code)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 border ${
                  isSelected
                    ? 'ring-2 ring-blue-500 scale-105 shadow-sm border-transparent'
                    : 'border-[var(--border-subtle)] hover:border-[var(--border-medium)]'
                }`}
                style={{ backgroundColor: token.bg, color: token.fg }}
              >
                <span>{code === '-' ? 'OFF' : code}</span>
                <span className="text-[10px] opacity-75 font-normal">({token.label})</span>
              </button>
            );
          })}
          <button
            type="button"
            onClick={handleResetGrid}
            className="ml-2 px-3 py-1.5 rounded-lg text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-surface)] border border-[var(--border-subtle)] transition-colors"
          >
            Reset Grid
          </button>
        </div>

        {/* Live Compliance Pill Indicator */}
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
      <div className="p-4 sm:p-6 overflow-x-auto select-none" onPointerLeave={() => (isMouseDownRef.current = false)}>
        <div className="min-w-[700px]">
          {/* Header Row: Days */}
          <div className="grid items-center gap-1.5 pb-2 text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider border-b border-[var(--border-subtle)]" style={{ gridTemplateColumns: gridTemplate }}>
            <span className="px-2">Personnel</span>
            {Array.from({ length: DEMO_DAYS_COUNT }, (_, d) => (
              <span key={d} className="text-center font-mono">
                {d + 1}
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
                  <div className="text-[10px] text-[var(--text-muted)] font-medium">{emp.role}</div>
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
          <div className="grid items-center gap-1.5 pt-3 border-t border-[var(--border-subtle)] text-xs font-mono font-bold" style={{ gridTemplateColumns: gridTemplate }}>
            <span className="px-2 text-[var(--text-muted)] font-sans uppercase tracking-wider text-[11px]">
              On-Duty Count
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

      {/* Simulator Guidance Footer */}
      <div className="px-4 py-3 bg-[var(--bg-surface-subtle)] border-t border-[var(--border-subtle)] text-xs text-[var(--text-muted)] flex flex-wrap items-center justify-between gap-2">
        <span>
          💡 <strong>Simulator tip:</strong> Paint a <strong>Morning (M)</strong> shift directly after a <strong>Night (N)</strong> shift on the same engineer to observe the fatigue violation alert.
        </span>
        <span className="font-semibold text-[var(--brand-primary)]">
          Zero spreadsheet macros required
        </span>
      </div>
    </div>
  );
}
