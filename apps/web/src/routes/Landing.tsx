import { useQuery } from '@tanstack/react-query';
import type { CSSProperties, ReactNode } from 'react';
import { Link } from 'react-router';

import { trialClassPhoto } from '../assets/photos';
import { bookingConfigQuery } from '../features/availability/queries';
import { NextFreeTimes, TimeReadout } from '../features/landing';
import { durationPhrase } from '../features/my-bookings/booking-view';
import { useReveal } from '../shared/hooks/useReveal';
import { cn } from '../shared/lib/cn';
import { Accordion } from '../shared/ui/Accordion';
import { buttonVariants } from '../shared/ui/button-variants';
import { CalendarBlankIcon, CheckCircleIcon, VideoCameraIcon, type Icon } from '../shared/ui/icons';
import { Photo } from '../shared/ui/Photo';

const CTA = 'Book a free trial';

/** Row 19: hero pieces enter in order, 60ms apart. */
const stagger = (order: number) => ({ '--stagger': order }) as CSSProperties;

function Section({
  labelledBy,
  className,
  children,
}: {
  labelledBy: string;
  className?: string;
  children: ReactNode;
}) {
  const reveal = useReveal();
  return (
    <section ref={reveal} aria-labelledby={labelledBy} className={cn('reveal', className)}>
      {children}
    </section>
  );
}

const STEPS: { icon: Icon; title: string; body: string }[] = [
  {
    icon: CalendarBlankIcon,
    title: 'Choose a time',
    body: 'Pick a free time that suits your family. Every time is shown in your time zone.',
  },
  {
    icon: VideoCameraIcon,
    title: 'Join the class',
    body: 'Your child meets a mentor one to one on video and builds something small together.',
  },
  {
    icon: CheckCircleIcon,
    title: 'Get a learning plan',
    body: 'Afterwards the mentor suggests what your child could learn next. There is no obligation.',
  },
];

/** / (doc 05 §4): hero with the live Time Tray, how it works, time zones, questions, closing CTA. */
export function Component() {
  const config = useQuery(bookingConfigQuery());
  const minutes = config.data?.slotDurationMinutes ?? 60;
  const cutoff = durationPhrase(config.data?.rescheduleCutoffMinutes ?? 120);

  return (
    <>
      {/* 1. Hero: asymmetric split, the product's own times as the visual. */}
      <section
        aria-labelledby="hero-title"
        className="mx-auto grid max-w-content items-center gap-10 px-4 pt-8 pb-16 sm:pt-16 lg:grid-cols-12 lg:gap-12 lg:pt-20 lg:pb-8"
      >
        <div className="flex flex-col items-start gap-5 lg:col-span-7">
          <h1
            id="hero-title"
            style={stagger(0)}
            className="motion-hero-in max-w-[18ch] text-display text-ink"
          >
            Book a free coding class for your child
          </h1>
          <p
            style={stagger(1)}
            className="motion-hero-in max-w-[44ch] text-body text-ink-muted sm:text-h3 sm:font-normal"
          >
            Choose a time in your time zone and your child gets a live{' '}
            <span className="whitespace-nowrap">one-on-one</span> class with a mentor.
          </p>
          <Link
            to="/book"
            style={stagger(2)}
            className={cn(buttonVariants(), 'motion-hero-in mt-2')}
          >
            {CTA}
          </Link>
        </div>
        <div style={stagger(3)} className="motion-hero-in lg:col-span-5">
          <NextFreeTimes />
        </div>
      </section>

      {/* 2. How the trial works: vertical timeline + photo. */}
      <Section labelledBy="how-title" className="mx-auto max-w-content px-4 py-16 sm:py-24">
        <div className="grid items-center gap-12 lg:grid-cols-12">
          <div className="flex flex-col gap-8 lg:col-span-5">
            <h2 id="how-title" className="text-h1 text-ink">
              How the trial works
            </h2>
            <ol className="flex flex-col">
              {STEPS.map((step, index) => (
                <li key={step.title} className="relative flex gap-4 pb-8 last:pb-0">
                  {index < STEPS.length - 1 && (
                    <span aria-hidden className="absolute top-11 bottom-1 left-5 w-px bg-line" />
                  )}
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent-tint text-accent-ink">
                    <step.icon aria-hidden size={20} />
                  </span>
                  <div className="flex flex-col gap-1 pt-1.5">
                    <h3 className="text-h3 font-bold text-ink">{step.title}</h3>
                    <p className="max-w-prose text-body text-ink-muted">{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
          <div className="overflow-hidden rounded-surface lg:col-span-7">
            <Photo photo={trialClassPhoto} sizes="(min-width: 1024px) 640px, 100vw" />
          </div>
        </div>
      </Section>

      {/* 3. Your time, not ours: full-width sunken band with a live readout. */}
      <Section labelledBy="time-title" className="bg-sunken">
        <div className="mx-auto flex max-w-content flex-col gap-8 px-4 py-16 sm:py-24">
          <h2 id="time-title" className="max-w-[20ch] text-h1 text-ink">
            Every time is shown in your time zone
          </h2>
          <TimeReadout />
          <p className="max-w-prose text-body text-ink-muted">
            When clocks change, your booking and emails change with them.
          </p>
        </div>
      </Section>

      {/* 4. Questions: narrow heading column + accordion. */}
      <Section labelledBy="faq-title" className="mx-auto max-w-content px-4 py-16 sm:py-24">
        <div className="grid gap-8 lg:grid-cols-12 lg:gap-12">
          <h2 id="faq-title" className="text-h1 text-ink lg:col-span-4">
            Questions
          </h2>
          <div className="lg:col-span-8">
            <Accordion
              items={[
                {
                  id: 'free',
                  question: 'Is it really free?',
                  answer: 'Yes. The trial costs nothing and we never ask for card details.',
                },
                {
                  id: 'length',
                  question: 'How long is the class?',
                  answer: `${String(minutes)} minutes, live on video, with one mentor and your child.`,
                },
                {
                  id: 'needs',
                  question: 'What does my child need?',
                  answer:
                    'A laptop or tablet with a camera and microphone, and a quiet spot. No coding experience is needed.',
                },
                {
                  id: 'reschedule',
                  question: 'Can I reschedule?',
                  answer: `Yes. You can move or cancel the trial from My bookings up to ${cutoff} before it starts.`,
                },
                {
                  id: 'ages',
                  question: 'Which ages is it for?',
                  answer:
                    "Children from 4 to 18. The mentor pitches the class at your child's age.",
                },
              ]}
            />
          </div>
        </div>
      </Section>

      {/* 5. Closing CTA: left-aligned statement strip. */}
      <Section labelledBy="cta-title" className="mx-auto max-w-content px-4 pb-24">
        <div className="flex flex-col items-start gap-6 border-t border-line pt-12 sm:flex-row sm:items-center sm:justify-between">
          <h2 id="cta-title" className="text-h1 text-ink">
            Ready when you are.
          </h2>
          <Link to="/book" className={buttonVariants()}>
            {CTA}
          </Link>
        </div>
      </Section>
    </>
  );
}
