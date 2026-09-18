import { useEffect, useState } from 'react';

import { StoreProvider, useStore } from '@/app/store';
import { ToastHost, cx } from '@/components/ui';
import { monthLabel } from '@/domain/calendar';
import { PeoplePage } from '@/features/people/PeoplePage';
import { PlannerPage } from '@/features/planner/PlannerPage';
import { SetupPage } from '@/features/setup/SetupPage';

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
          <Logo />
          <span className="text-[15px] font-bold tracking-[-0.02em]">Shift<span className="text-ink-2 font-semibold">Line</span></span>
          <span className="text-[12px] text-ink-3">Loading roster…</span>
        </div>
      </div>
    );
  }

  const line = lines.find((l) => l.id === settings.activeLineId);

  return (
    <div className="flex h-full flex-col">
      <header
        className="no-print flex shrink-0 items-center gap-2 sm:gap-3 border-b border-[var(--line)] bg-[var(--surface)] px-3 sm:px-4 h-12"
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        <Logo />
        <div className="hidden sm:flex flex-col leading-none">
          <span className="text-[13.5px] font-bold tracking-[-0.02em]">
            Shift<span className="text-ink-2 font-semibold">Line</span>
          </span>
          <span className="mt-0.5 text-[10.5px] text-ink-3">
            {line?.name} · {monthLabel(settings.activeYear, settings.activeMonth)}
          </span>
        </div>

        <nav className="ml-1 sm:ml-6 flex items-center gap-0.5">
          {([
            ['planner', 'Planner'],
            ['people', 'People'],
            ['setup', 'Setup'],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setPage(key)}
              className={cx(
                'relative h-7 px-3 rounded-md text-[12.5px] font-medium transition-colors',
                page === key ? 'text-ink bg-[var(--surface-3)]' : 'text-ink-3 hover:text-ink-2',
              )}
            >
              {label}
            </button>
          ))}
        </nav>

        <button
          onClick={() => setTheme(settings.theme === 'dark' ? 'light' : 'dark')}
          title="Toggle theme"
          className="ml-auto grid h-7 w-7 place-items-center rounded-md text-ink-3 hover:text-ink hover:bg-[var(--surface-3)] transition-colors"
        >
          {settings.theme === 'dark' ? <SunIcon /> : <MoonIcon />}
        </button>
      </header>

      {page === 'planner' && <PlannerPage />}
      {page === 'people' && <PeoplePage />}
      {page === 'setup' && <SetupPage />}
    </div>
  );
}

function Logo() {
  // Three staggered bars in the Morning / Evening / Night tones — a rotation.
  return (
    <svg width="24" height="24" viewBox="0 0 64 64" aria-hidden>
      <rect width="64" height="64" rx="14" fill="var(--surface-3)" />
      <rect x="12" y="16" width="30" height="8" rx="4" fill="var(--sh-m)" />
      <rect x="17" y="28" width="30" height="8" rx="4" fill="var(--sh-e)" />
      <rect x="22" y="40" width="30" height="8" rx="4" fill="var(--sh-n)" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
    </svg>
  );
}
