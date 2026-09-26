import { Outlet, ScrollRestoration } from 'react-router';

import { TimezoneProvider, ZoneChip } from '../features/timezone';

import { Footer } from './Footer';
import { Header } from './Header';
import { OfflineBanner } from './OfflineBanner';
import { useRouteFocus } from './useRouteFocus';
import { useScrolledPast } from './useScrolledPast';

/** Header, offline banner, the routed page and the footer (doc 05 §3). */
export function AppShell() {
  const { sentinelRef, scrolled } = useScrolledPast<HTMLDivElement>();
  useRouteFocus();

  return (
    <TimezoneProvider>
      <div className="flex min-h-dvh flex-col">
        <a
          href="#main"
          className="sr-only z-50 rounded-control bg-surface px-4 py-3 text-ink shadow-float focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
        >
          Skip to content
        </a>
        <Header scrolled={scrolled} zoneChip={<ZoneChip />} />
        <OfflineBanner />
        <div ref={sentinelRef} aria-hidden className="h-px" />
        <main id="main" className="flex-1">
          <Outlet />
        </main>
        <Footer />
        <ScrollRestoration />
      </div>
    </TimezoneProvider>
  );
}
