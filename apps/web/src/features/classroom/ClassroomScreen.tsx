import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';

import type { ClassroomView } from '@app/contracts';
import {
  durationParts,
  formatDate,
  formatTimeRange,
  instantFromEpochMs,
  zoneParts,
} from '@app/time';

import { useNow } from '../../shared/hooks/useNow';
import { Avatar } from '../../shared/ui/Avatar';
import { Button } from '../../shared/ui/Button';
import { buttonVariants } from '../../shared/ui/button-variants';
import { Countdown } from '../../shared/ui/Countdown';
import { VideoCameraIcon } from '../../shared/ui/icons';
import { LiveIndicator } from '../../shared/ui/LiveIndicator';
import { Notice } from '../../shared/ui/Notice';
import { PageTitle } from '../../shared/ui/PageTitle';
import { useDisplayZone, ZoneChip } from '../timezone';

import { classroomPhase, countdownSentence } from './phase';

interface ClassroomScreenProps {
  view: ClassroomView;
  /** Device-to-server clock correction, in milliseconds. */
  offsetMs: number;
}

function Tile({ name, role }: { name: string; role: string }) {
  return (
    <figure className="relative flex aspect-video items-center justify-center overflow-hidden rounded-surface bg-sunken ring-1 ring-line">
      <Avatar name={name} size="lg" />
      <figcaption className="absolute bottom-3 left-3 rounded-pill bg-surface/90 px-2.5 py-1 text-micro text-ink">
        {name}, {role}
      </figcaption>
    </figure>
  );
}

/** Two video tiles and a clear "demo" label: there is no real call behind this page. */
function DemoRoom({ view, onLeave }: { view: ClassroomView; onLeave: () => void }) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    headingRef.current?.focus();
  }, []);
  return (
    <section aria-labelledby="demo-room" className="motion-swap-in flex w-full flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="demo-room" ref={headingRef} tabIndex={-1} className="text-h2 text-ink outline-none">
          {view.childFirstName}&apos;s trial class
        </h2>
        <LiveIndicator />
      </div>
      <Notice>
        This is a demo classroom. In a real class you would see and hear each other here.
      </Notice>
      <div className="grid gap-3 sm:grid-cols-2">
        <Tile name={view.mentorFirstName} role="mentor" />
        <Tile name={view.childFirstName} role="student" />
      </div>
      <Button variant="secondary" className="self-start" onClick={onLeave}>
        Leave class
      </Button>
    </section>
  );
}

/** The class page for parent and mentor (doc 05 §7): countdown, open room, or why it is closed. */
export function ClassroomScreen({ view, offsetMs }: ClassroomScreenProps) {
  const { zone, locale } = useDisplayZone();
  const now = useNow(1000) + offsetMs;
  const phase = classroomPhase(view, now);
  const [joined, setJoined] = useState(false);
  const joinRef = useRef<HTMLButtonElement>(null);
  const parent = view.role === 'PARENT';

  if (joined && phase === 'open') {
    return (
      <DemoRoom
        view={view}
        onLeave={() => {
          setJoined(false);
          requestAnimationFrame(() => joinRef.current?.focus());
        }}
      />
    );
  }

  const parts = durationParts(instantFromEpochMs(now), view.start);
  const when = `${formatDate(view.start, zone, 'long', locale)}, ${formatTimeRange(view.start, view.end, zone, locale)} ${zoneParts(zone, view.start).name}`;

  return (
    <div className="flex flex-col items-center gap-8 text-center">
      <header className="flex flex-col items-center gap-3">
        {phase === 'open' && <LiveIndicator />}
        <PageTitle>{view.childFirstName}&apos;s trial class</PageTitle>
        <p className="text-body text-ink-muted">
          {view.childFirstName} with {view.mentorFirstName}
        </p>
        <p className="text-body text-ink tabular-nums">{when}</p>
        <ZoneChip at={view.start} />
      </header>

      {phase === 'upcoming' && (
        <div className="flex flex-col items-center gap-4">
          <p className="text-small text-ink-muted">The class starts in</p>
          <Countdown parts={parts} />
          <p aria-live="polite" className="sr-only">
            The class starts in {countdownSentence(parts)}.
          </p>
          <p className="max-w-prose text-small text-ink-muted">
            The classroom opens {view.classroomOpensMinutesBefore} minutes before the class.
          </p>
        </div>
      )}

      {phase === 'open' && (
        <Button
          ref={joinRef}
          icon={<VideoCameraIcon aria-hidden size={20} />}
          onClick={() => {
            setJoined(true);
          }}
        >
          Join class
        </Button>
      )}

      {phase === 'ended' && (
        <div className="flex flex-col items-center gap-4">
          <p className="text-h3 text-ink">This class has ended.</p>
          {parent && (
            <Link to="/book" className={buttonVariants()}>
              Book another trial
            </Link>
          )}
        </div>
      )}

      {(phase === 'cancelled' || phase === 'moved') && (
        <div className="flex flex-col items-center gap-4">
          <p className="text-h3 text-ink">
            {phase === 'cancelled'
              ? 'This class was cancelled.'
              : 'This class was moved to a new time.'}
          </p>
          <p className="max-w-prose text-small text-ink-muted">
            {parent
              ? 'Your bookings show what is planned now.'
              : 'We have emailed you about the change.'}
          </p>
          {parent && (
            <Link to="/bookings" className={buttonVariants({ variant: 'secondary' })}>
              Go to My bookings
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
