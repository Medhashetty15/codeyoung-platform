import { z } from 'zod';

import { IanaZoneSchema, IsoInstantSchema, LocalDateSchema, SlotSchema } from './primitives.js';

/** Longest window one slots request may cover; equals the booking horizon. */
export const MAX_SLOT_DAYS = 14;

/**
 * - AVAILABLE: at least one bookable slot.
 * - FULLY_BOOKED: mentors work that day (after lead time) but every slot is taken.
 * - NO_AVAILABILITY: no mentor time left that day (none scheduled, or only inside lead time).
 */
export const DayStatus = {
  AVAILABLE: 'AVAILABLE',
  FULLY_BOOKED: 'FULLY_BOOKED',
  NO_AVAILABILITY: 'NO_AVAILABILITY',
} as const;
export type DayStatus = (typeof DayStatus)[keyof typeof DayStatus];
export const DayStatusSchema = z.enum(DayStatus);

const OffsetSchema = z.string().regex(/^[+-]\d{2}:\d{2}$/);

/** Clock change in the requested zone on that day (e.g. London falls back on 25 Oct). */
export const DstTransitionSchema = z.object({
  at: IsoInstantSchema,
  offsetBefore: OffsetSchema,
  offsetAfter: OffsetSchema,
});
export type DstTransition = z.infer<typeof DstTransitionSchema>;

export const SlotDaySchema = z.object({
  /** Date in the requested zone. */
  date: LocalDateSchema,
  status: DayStatusSchema,
  slots: z.array(SlotSchema),
  dstTransition: DstTransitionSchema.optional(),
});
export type SlotDay = z.infer<typeof SlotDaySchema>;

/** `GET /availability/slots` query. `from` defaults to today in `tz` (PD-13). */
export const SlotsQuerySchema = z.object({
  from: LocalDateSchema.optional(),
  days: z.coerce.number().int().min(1).max(MAX_SLOT_DAYS).default(MAX_SLOT_DAYS),
  tz: IanaZoneSchema,
});
export type SlotsQuery = z.infer<typeof SlotsQuerySchema>;
export type SlotsQueryInput = z.input<typeof SlotsQuerySchema>;

export const SlotsResponseSchema = z.object({
  timezone: IanaZoneSchema,
  slotDurationMinutes: z.int().positive(),
  generatedAt: IsoInstantSchema,
  /** Every date of the requested window, in order, empty days included. */
  days: z.array(SlotDaySchema),
  /** Earliest bookable slot in the whole horizon, not just this window; null means waitlist. */
  nextAvailable: SlotSchema.nullable(),
});
export type SlotsResponse = z.infer<typeof SlotsResponseSchema>;
