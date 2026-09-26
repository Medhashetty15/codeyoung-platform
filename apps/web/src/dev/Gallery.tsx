import { RadioGroup } from '@base-ui/react/radio-group';
import { useState, type ReactNode } from 'react';

import { parentAndChildPhoto, trialClassPhoto } from '../assets/photos';
import { useTheme, type ThemePreference } from '../shared/theme/theme';
import { Accordion } from '../shared/ui/Accordion';
import { Avatar } from '../shared/ui/Avatar';
import { Button } from '../shared/ui/Button';
import { ConfirmedMark } from '../shared/ui/ConfirmedMark';
import { CopyButton } from '../shared/ui/CopyButton';
import { Countdown } from '../shared/ui/Countdown';
import { DateChip } from '../shared/ui/DateChip';
import { Dialog } from '../shared/ui/Dialog';
import { EmptyState } from '../shared/ui/EmptyState';
import { Field, Input, NativeSelect } from '../shared/ui/Field';
import { IconButton } from '../shared/ui/IconButton';
import {
  CalendarBlankIcon,
  CalendarPlusIcon,
  DotsThreeIcon,
  GlobeHemisphereWestIcon,
  ListIcon,
} from '../shared/ui/icons';
import { LiveIndicator } from '../shared/ui/LiveIndicator';
import { Menu, MenuItem, MenuSeparator } from '../shared/ui/Menu';
import { Notice } from '../shared/ui/Notice';
import { notify } from '../shared/ui/notify';
import { PasswordInput } from '../shared/ui/PasswordInput';
import { Photo } from '../shared/ui/Photo';
import { RadioCard } from '../shared/ui/RadioCard';
import { Reference } from '../shared/ui/Reference';
import { Skeleton } from '../shared/ui/Skeleton';
import { SlotChip } from '../shared/ui/SlotChip';
import { StatusBadge } from '../shared/ui/StatusBadge';
import { Stepper } from '../shared/ui/Stepper';
import { Tabs } from '../shared/ui/Tabs';
import { textLinkClassName } from '../shared/ui/text-link';
import { TimeTray } from '../shared/ui/TimeTray';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4 border-t border-line pt-8">
      <h2 className="text-h2">{title}</h2>
      {children}
    </section>
  );
}

const dates = [
  { value: '2026-10-24', weekday: 'Sat', day: '24', availability: '4 times' },
  { value: '2026-10-25', weekday: 'Sun', day: '25', availability: 'Full', muted: true },
  { value: '2026-10-26', weekday: 'Mon', day: '26', availability: 'No classes', muted: true },
  { value: '2026-10-27', weekday: 'Tue', day: '27', availability: '3 times' },
  { value: '2026-10-28', weekday: 'Wed', day: '28', availability: '5 times' },
];
const slots = ['4:00 PM', '4:30 PM', '5:00 PM', '6:00 PM', '7:30 PM'];

export function Gallery() {
  const { preference, setPreference } = useTheme();
  const [tab, setTab] = useState<'create' | 'login'>('create');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [password, setPassword] = useState('hannah2026');

  return (
    <main className="mx-auto flex max-w-content flex-col gap-10 px-4 py-10">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-h1">Components</h1>
        <NativeSelect
          aria-label="Theme"
          value={preference}
          onChange={(e) => {
            setPreference(e.target.value as ThemePreference);
          }}
          className="w-40"
        >
          <option value="system">System</option>
          <option value="light">Light</option>
          <option value="dark">Dark</option>
        </NativeSelect>
      </header>

      <Section title="Type">
        <p className="text-display">Book a free coding class for your child</p>
        <p className="text-h1">Pick a time</p>
        <p className="text-h3">Evening</p>
        <p className="text-time-xl tabular-nums">5:00 PM</p>
        <p className="max-w-prose text-body text-ink-muted">
          Choose a time in your time zone and your child gets a live one-on-one class with a mentor.
        </p>
        <p className="text-small text-ink-muted">
          Reference <Reference value="CY-7K3Q9P" /> ·{' '}
          <a href="#x" className={textLinkClassName}>
            View booking
          </a>
        </p>
      </Section>

      <Section title="Buttons">
        <div className="flex flex-wrap items-center gap-3">
          <Button>Book a free trial</Button>
          <Button variant="secondary" icon={<CalendarPlusIcon size={20} aria-hidden />}>
            Add to calendar
          </Button>
          <Button variant="ghost">Log in</Button>
          <Button variant="danger">Cancel trial</Button>
          <Button pending>Confirm trial</Button>
          <Button disabled>Continue</Button>
          <Button size="compact" variant="secondary">
            Show more
          </Button>
          <IconButton icon={ListIcon} label="Menu" />
          <CopyButton
            value="https://app.example/class/abc"
            label="Copy class link"
            onCopied={() => notify.success('Link copied')}
          />
        </div>
      </Section>

      <Section title="Fields">
        <div className="grid max-w-form gap-5">
          <Field label="Email" description="We send the class details here.">
            <Input
              type="email"
              autoComplete="email"
              enterKeyHint="next"
              defaultValue="hannah@okafor.co.uk"
            />
          </Field>
          <Field label="Full name" error="Enter your full name.">
            <Input autoComplete="name" />
          </Field>
          <Field label="Phone" optional>
            <Input type="tel" autoComplete="tel" />
          </Field>
          <Field label="Age">
            <NativeSelect defaultValue="9">
              {Array.from({ length: 15 }, (_, i) => i + 4).map((age) => (
                <option key={age} value={age}>
                  {age}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Password">
            <PasswordInput
              autoComplete="new-password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
              }}
              rules={[
                { id: 'length', label: 'At least 8 characters', met: password.length >= 8 },
                { id: 'common', label: 'Not a common password', met: password.length >= 8 },
                {
                  id: 'email',
                  label: "Doesn't contain your email",
                  met: !password.includes('hannah'),
                },
              ]}
            />
          </Field>
        </div>
      </Section>

      <Section title="Notices, badges, empty, skeleton">
        <Notice>
          Clocks in London go back one hour on Sunday 25 October. Times after that are already
          adjusted.
        </Notice>
        <Notice
          tone="caution"
          action={
            <Button size="compact" variant="secondary">
              Use London time
            </Button>
          }
        >
          Your device is set to New York time. Are you booking in London time?
        </Notice>
        <Notice
          tone="danger"
          title="We couldn't reach our servers."
          action={
            <Button size="compact" variant="secondary">
              Try again
            </Button>
          }
        >
          Check your connection and try again. Reference: 7F3A-91C2
        </Notice>
        <div className="flex flex-wrap gap-2">
          <StatusBadge status="CONFIRMED" />
          <StatusBadge status="CANCELLED" />
          <StatusBadge status="RESCHEDULED" />
          <StatusBadge status="COMPLETED" />
          <LiveIndicator />
          <span className="inline-flex h-11 items-center gap-2 rounded-pill border border-line-control px-4 text-small font-medium">
            <GlobeHemisphereWestIcon size={20} aria-hidden />
            London time (GMT+1)
          </span>
        </div>
        <EmptyState
          icon={CalendarBlankIcon}
          title="No trial booked yet."
          action={<Button>Book a free trial</Button>}
        >
          Pick a time that suits your family and we will match a mentor.
        </EmptyState>
        <div className="flex gap-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-18 w-16" />
          ))}
        </div>
        <div className="flex items-center gap-3">
          <Avatar name="Priya Raghavan" />
          <Avatar name="Hannah Okafor" size="sm" />
        </div>
      </Section>

      <Section title="Booking pieces">
        <Stepper
          steps={[
            { id: 'time', label: 'Time' },
            { id: 'account', label: 'Account' },
            { id: 'confirm', label: 'Confirm' },
          ]}
          currentId="account"
        />
        <RadioGroup
          aria-label="Date"
          defaultValue="2026-10-24"
          className="flex snap-x snap-mandatory gap-2 overflow-x-auto overscroll-x-contain pb-1"
        >
          {dates.map((d) => (
            <DateChip key={d.value} {...d} />
          ))}
        </RadioGroup>
        <div>
          <h3 className="mb-3 text-h3">Evening</h3>
          <RadioGroup
            aria-label="Time"
            defaultValue="5:00 PM"
            className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5"
          >
            {slots.map((s) => (
              <SlotChip key={s} value={s}>
                {s}
              </SlotChip>
            ))}
            <SlotChip value="current" current>
              8:00 PM
            </SlotChip>
          </RadioGroup>
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <TimeTray>
            <p className="text-h3">Saturday 24 October</p>
            <p className="mt-1 text-time-xl tabular-nums">5:00 PM</p>
            <p className="mt-2 text-small text-ink-muted">5:00 to 6:00 PM London time</p>
            <p className="text-small text-ink-muted">60 min live class, free</p>
            <Button className="mt-5 w-full">Continue</Button>
          </TimeTray>
          <RadioGroup
            aria-label="Who is the class for?"
            defaultValue="leo"
            className="flex flex-col gap-2"
          >
            <RadioCard value="leo" label="Leo, 9" />
            <RadioCard
              value="maya"
              label="Maya, 12"
              disabled
              hint={
                <>
                  Maya already has a trial on Tue 27 Oct.{' '}
                  <a href="#x" className={textLinkClassName}>
                    View booking
                  </a>
                </>
              }
            />
          </RadioGroup>
        </div>
        <div className="flex items-center gap-4">
          <ConfirmedMark />
          <p className="confirmed-headline text-h1">Leo's trial is booked</p>
        </div>
        <Countdown parts={{ days: 0, hours: 1, minutes: 12, seconds: 9 }} />
      </Section>

      <Section title="Photography">
        <div className="grid gap-6 md:grid-cols-[7fr_5fr]">
          <Photo
            photo={trialClassPhoto}
            sizes="(min-width: 768px) 60vw, 100vw"
            className="rounded-surface"
          />
          <Photo
            photo={parentAndChildPhoto}
            sizes="(min-width: 768px) 40vw, 100vw"
            className="rounded-surface"
          />
        </div>
      </Section>

      <Section title="Overlays">
        <Tabs
          label="Account"
          value={tab}
          onValueChange={setTab}
          className="max-w-form"
          items={[
            {
              value: 'create',
              label: 'Create account',
              panel: <p className="text-ink-muted">Create account form</p>,
            },
            {
              value: 'login',
              label: 'Log in',
              panel: <p className="text-ink-muted">Log in form</p>,
            },
          ]}
        />
        <div className="flex flex-wrap gap-3">
          <Button
            variant="secondary"
            onClick={() => {
              setDialogOpen(true);
            }}
          >
            Open dialog
          </Button>
          <Menu trigger={<IconButton icon={DotsThreeIcon} label="More actions" />}>
            <MenuItem>Reschedule</MenuItem>
            <MenuSeparator />
            <MenuItem tone="danger">Cancel</MenuItem>
          </Menu>
          <Button variant="secondary" onClick={() => notify('Trial cancelled')}>
            Toast
          </Button>
        </div>
        <Dialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          title="Cancel Leo's trial on Sat 24 Oct?"
          description="The time will be offered to another family."
          actions={
            <>
              <Button
                variant="secondary"
                onClick={() => {
                  setDialogOpen(false);
                }}
              >
                Keep booking
              </Button>
              <Button variant="danger">Cancel trial</Button>
            </>
          }
        />
        <Accordion
          items={[
            {
              id: 'free',
              question: 'Is it really free?',
              answer: 'Yes. The trial is a free 60 minute live class with no card needed.',
            },
            {
              id: 'long',
              question: 'How long is the class?',
              answer: '60 minutes, one-on-one with a mentor.',
            },
          ]}
        />
      </Section>
    </main>
  );
}
