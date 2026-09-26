import { Combobox } from '@base-ui/react/combobox';
import { Dialog as BaseDialog } from '@base-ui/react/dialog';
import { Popover } from '@base-ui/react/popover';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import { TimezonesResponseSchema, type TimezonesResponse } from '@app/contracts';
import type { InstantLike } from '@app/time';

import { api } from '../../shared/api/client';
import { qk } from '../../shared/api/query-keys';
import { useMediaQuery } from '../../shared/hooks/useMediaQuery';
import { Button } from '../../shared/ui/Button';
import { CheckIcon, MagnifyingGlassIcon } from '../../shared/ui/icons';
import { Notice } from '../../shared/ui/Notice';
import { Skeleton } from '../../shared/ui/Skeleton';

import { useDisplayZone } from './timezone-context';
import {
  buildZoneEntries,
  groupZones,
  visibleZoneGroups,
  type ZoneEntry,
  type ZoneGroup,
} from './zone-search';
import { ZoneChipButton } from './ZoneChip';

function useTimezones() {
  return useQuery({
    queryKey: qk.meta.timezones(),
    queryFn: ({ signal }) =>
      api<TimezonesResponse>('/meta/timezones', {
        auth: false,
        signal,
        schema: import.meta.env.DEV ? TimezonesResponseSchema : undefined,
      }),
    staleTime: Infinity,
  });
}

interface ZonePickerProps {
  at: InstantLike;
  initiallyOpen?: boolean;
  /** A form field's zone (the profile zone); without it the picker changes the display zone. */
  value?: string;
  onSelect?: (zone: string) => void;
  align?: 'start' | 'end';
}

/** Zone picker: popover on desktop, bottom sheet on phones (doc 07 §6). */
export function ZonePicker({
  at,
  initiallyOpen = false,
  value,
  onSelect,
  align = 'end',
}: ZonePickerProps) {
  const display = useDisplayZone();
  const zone = value ?? display.zone;
  const [open, setOpen] = useState(initiallyOpen);
  const desktop = useMediaQuery('(min-width: 40rem)');
  const select = (next: string) => {
    if (onSelect) onSelect(next);
    else display.setZone(next);
    setOpen(false);
  };
  const trigger = <ZoneChipButton zone={zone} at={at} />;
  const list = <ZoneList value={zone} at={at} onSelect={select} />;

  if (desktop) {
    return (
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger render={trigger} />
        <Popover.Portal>
          <Popover.Positioner sideOffset={8} align={align} className="z-50">
            <Popover.Popup
              aria-label="Time zone"
              className="motion-popover flex w-[22rem] flex-col rounded-surface bg-surface shadow-float ring-1 ring-line outline-none"
            >
              {list}
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    );
  }

  return (
    <BaseDialog.Root open={open} onOpenChange={setOpen}>
      <BaseDialog.Trigger render={trigger} />
      <BaseDialog.Portal>
        <BaseDialog.Backdrop className="motion-backdrop fixed inset-0 z-60 bg-ink/40 dark:bg-canvas/70" />
        <BaseDialog.Viewport className="fixed inset-0 z-60 grid items-end">
          <BaseDialog.Popup className="motion-dialog flex h-[85dvh] flex-col rounded-t-surface bg-surface pb-[env(safe-area-inset-bottom,0px)] shadow-float ring-1 ring-line outline-none">
            <BaseDialog.Title className="px-5 pt-5 text-h2 text-ink">Time zone</BaseDialog.Title>
            {list}
          </BaseDialog.Popup>
        </BaseDialog.Viewport>
      </BaseDialog.Portal>
    </BaseDialog.Root>
  );
}

function ZoneList({
  value,
  at,
  onSelect,
}: {
  value: string;
  at: InstantLike;
  onSelect: (zone: string) => void;
}) {
  const timezones = useTimezones();
  const [query, setQuery] = useState('');
  const groups = useMemo(() => {
    if (!timezones.data) return [];
    const { suggested, all } = timezones.data;
    return groupZones(buildZoneEntries(suggested, at), buildZoneEntries(all, at));
  }, [timezones.data, at]);
  const visibleGroups = useMemo(() => visibleZoneGroups(groups, query), [groups, query]);
  const selected = groups.at(-1)?.items.find((entry) => entry.id === value) ?? null;

  if (timezones.isError) {
    return (
      <div className="p-3">
        <Notice
          tone="danger"
          action={
            <Button size="compact" variant="secondary" onClick={() => void timezones.refetch()}>
              Try again
            </Button>
          }
        >
          We couldn&apos;t load the list of time zones.
        </Notice>
      </div>
    );
  }

  return (
    <Combobox.Root
      inline
      open
      items={groups}
      filteredItems={visibleGroups}
      inputValue={query}
      onInputValueChange={setQuery}
      value={selected}
      onValueChange={(entry: ZoneEntry | null) => {
        if (entry) onSelect(entry.id);
      }}
      itemToStringLabel={(entry: ZoneEntry) => entry.name}
      isItemEqualToValue={(a: ZoneEntry, b: ZoneEntry) => a.id === b.id}
      autoHighlight
    >
      <div className="relative m-3">
        <MagnifyingGlassIcon
          aria-hidden
          size={20}
          className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-muted"
        />
        <Combobox.Input
          aria-label="Search time zones"
          placeholder="City, country or GMT offset"
          enterKeyHint="search"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          className="h-11 w-full rounded-control border border-line-control bg-surface pr-3 pl-10 text-body text-ink placeholder:text-ink-faint"
        />
      </div>
      {timezones.isPending ? (
        <div aria-hidden className="flex flex-col gap-2 px-3 pb-3">
          {[0, 1, 2, 3, 4].map((row) => (
            <Skeleton key={row} className="h-11 w-full" />
          ))}
        </div>
      ) : (
        <>
          <Combobox.Empty className="px-4 pb-4 text-small text-ink-muted empty:hidden">
            No time zone matches that. Try a city or a country.
          </Combobox.Empty>
          <Combobox.List className="max-h-[min(24rem,60dvh)] flex-1 overflow-y-auto overscroll-contain px-1.5 pb-1.5 max-sm:max-h-none">
            {(group: ZoneGroup) => (
              <Combobox.Group key={group.value} items={group.items} className="pb-2">
                <Combobox.GroupLabel className="px-3 pt-2 pb-1 text-micro text-ink-muted uppercase">
                  {group.value}
                </Combobox.GroupLabel>
                <Combobox.Collection>
                  {(entry: ZoneEntry) => (
                    <Combobox.Item
                      key={`${group.value}-${entry.id}`}
                      value={entry}
                      className="grid h-11 cursor-default grid-cols-[1.25rem_1fr_auto] items-center gap-2 rounded-control px-3 text-body text-ink select-none data-highlighted:bg-sunken"
                    >
                      <Combobox.ItemIndicator>
                        <CheckIcon aria-hidden size={16} className="text-accent" />
                      </Combobox.ItemIndicator>
                      <span className="col-start-2 truncate">
                        {entry.name}
                        {!entry.name.startsWith(entry.city) && (
                          <span className="text-ink-muted"> · {entry.city}</span>
                        )}
                      </span>
                      <span className="text-small text-ink-muted tabular-nums">{entry.offset}</span>
                    </Combobox.Item>
                  )}
                </Combobox.Collection>
              </Combobox.Group>
            )}
          </Combobox.List>
        </>
      )}
    </Combobox.Root>
  );
}
