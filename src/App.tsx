import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';

import { StoreProvider, useStore } from '@/app/store';
import { switchTheme } from '@/app/themeTransition';
import { ToastHost, cx } from '@/components/ui';
import { monthLabel } from '@/domain/calendar';
import { PeoplePage } from '@/features/people/PeoplePage';
import { PlannerPage } from '@/features/planner/PlannerPage';
import { SetupPage } from '@/features/setup/SetupPage';
import { AssistantWidget } from '@/features/assistant/AssistantWidget';

type Page = 'planner' | 'people' | 'setup';

export default function App() {
  return (
    <ToastHost>
      <StoreProvider>
        <Shell />
      </StoreProvider>
    </ToastHost>
  );
}

function Shell() {
  const { ready, settings, setTheme, lines } = useStore();
  const [page, setPage] = useState<Page>('planner');

  useEffect(() => {
    document.documentElement.dataset.theme = settings.theme;
    document.documentElement.dataset.fontSize = settings.fontSize ?? 'normal';
    document.documentElement.dataset.fontFamily = settings.fontFamily ?? 'default';
  }, [settings.theme, settings.fontSize, settings.fontFamily]);

  if (!ready) {
    return (
      <div className="h-full grid place-items-center">
        <div className="flex flex-col items-center gap-3">
          <Logo size={48} />
          <Wordmark className="text-[18px]" />
          <span className="text-[12px] text-ink-3">Loading roster…</span>
        </div>
      </div>
    );
  }

  const line = lines.find((l) => l.id === settings.activeLineId);

  return (
    <div className="flex h-full flex-col">
      <header
        className="no-print flex shrink-0 items-stretch gap-2 sm:gap-4 border-b border-[var(--line-strong)] bg-[var(--surface)] px-3 sm:px-5 h-14"
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        <div className="flex items-center gap-2.5">
          <Logo size={34} />
          <div className="hidden sm:flex flex-col leading-none">
            <Wordmark className="text-[16px]" />
            <span className="mt-1 text-[11px] font-medium text-ink-2">
              {line?.name} <span className="text-ink-3">·</span> {monthLabel(settings.activeYear, settings.activeMonth)}
            </span>
          </div>
        </div>

        <span className="hidden sm:block my-3.5 w-px bg-[var(--line-strong)]" aria-hidden />

        <nav className="flex items-stretch gap-1" aria-label="Main">
          {([
            ['planner', 'Planner', <GridIcon key="i" />],
            ['people', 'People', <PeopleIcon key="i" />],
            ['setup', 'Setup', <GearIcon key="i" />],
          ] as const).map(([key, label, icon]) => {
            const active = page === key;
            return (
              <button
                key={key}
                onClick={() => setPage(key)}
                aria-current={active ? 'page' : undefined}
                className={cx(
                  'group relative flex items-center gap-2 px-2.5 sm:px-3.5 text-[13.5px] font-semibold transition-colors',
                  active ? 'text-ink' : 'text-ink-2 hover:text-ink',
                )}
              >
                <span
                  className={cx(
                    'flex items-center gap-2 rounded-lg px-2.5 py-1.5 transition-colors',
                    active
                      ? 'bg-[color-mix(in_srgb,var(--accent)_16%,transparent)] text-[var(--accent)]'
                      : 'group-hover:bg-[var(--surface-3)]',
                  )}
                >
                  {icon}
                  <span className={active ? 'text-ink' : undefined}>{label}</span>
                </span>
                {/* underline marks the page you are on */}
                <span
                  className={cx(
                    'absolute inset-x-2 -bottom-px h-[2.5px] rounded-full transition-opacity',
                    active ? 'bg-[var(--accent)] opacity-100' : 'opacity-0',
                  )}
                />
              </button>
            );
          })}
        </nav>

        <button
          onClick={(e) => {
            const next = settings.theme === 'dark' ? 'light' : 'dark';
            // Paint the new theme now, animated, then save it.
            switchTheme(next, e.currentTarget);
            setTheme(next);
          }}
          title={settings.theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          aria-label={settings.theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          className="ml-auto self-center grid h-9 w-9 place-items-center overflow-hidden rounded-lg border border-[var(--line)] text-ink-2 hover:text-ink hover:bg-[var(--surface-3)] transition-colors"
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={settings.theme}
              initial={{ rotate: -90, scale: 0.4, opacity: 0 }}
              animate={{ rotate: 0, scale: 1, opacity: 1 }}
              exit={{ rotate: 90, scale: 0.4, opacity: 0 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              className="grid place-items-center"
            >
              {settings.theme === 'dark' ? <SunIcon /> : <MoonIcon />}
            </motion.span>
          </AnimatePresence>
        </button>
      </header>

      {page === 'planner' && <PlannerPage />}
      {page === 'people' && <PeoplePage />}
      {page === 'setup' && <SetupPage />}
      <AssistantWidget />
    </div>
  );
}

function Logo({ size = 32 }: { size?: number }) {
  // Three staggered bars in the Morning / Evening / Night colours — a rotation.
  // Fixed colours rather than theme variables, so the mark reads the same on
  // dark and light and matches the favicon.
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-label="ShiftLine" role="img" className="shrink-0">
      <defs>
        <linearGradient id="sl-tile" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#1C2440" />
          <stop offset="1" stopColor="#0B0F1A" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="15" fill="url(#sl-tile)" />
      <rect x="0.75" y="0.75" width="62.5" height="62.5" rx="14.25" fill="none" stroke="#FFFFFF" strokeOpacity="0.14" strokeWidth="1.5" />
      <rect x="11" y="15" width="32" height="9" rx="4.5" fill="#F5B040" />
      <rect x="16.5" y="27.5" width="32" height="9" rx="4.5" fill="#34CDD3" />
      <rect x="22" y="40" width="32" height="9" rx="4.5" fill="#8593FF" />
    </svg>
  );
}

function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cx('font-extrabold tracking-[-0.025em] leading-none text-ink', className)}>
      Shift<span className="text-[var(--accent)]">Line</span>
    </span>
  );
}

function GridIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="4" width="18" height="17" rx="2" />
      <path d="M3 9h18M8 4v17M16 2v4M8 2v4" />
    </svg>
  );
}

function PeopleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
      <path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14.2a6.5 6.5 0 0 1 3.5 5.8" />
    </svg>
  );
}

function GearIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
    </svg>
  );
}
