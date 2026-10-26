/**
 * Slot computation.
 *
 * Slots are never stored. They are derived per request from recurring rules,
 * minus exceptions, minus bookings that already hold the time. A slots table
 * would need a generator job and would drift; this cannot go stale.
 *
 * All arithmetic is done in minutes-from-midnight in the expert's timezone,
 * and only converted to an absolute instant at the very end.
 */

/**
 * How long a booking blocks the calendar. NOT how long the call lasts.
 *
 * The call has no time limit, and nothing the site says to a visitor names
 * a duration any more. This number exists because a calendar needs a block
 * length even when a conversation does not have one: it sets the spacing of
 * offered slots, the endsAt written on a booking, and the minimum
 * availability window an expert can save.
 *
 * It is no longer the whole story: see SESSION_GAP_MINUTES below, which is
 * what computeSlots actually steps by.
 */
export const SLOT_MINUTES = 45;

/**
 * Breathing room after every session, before the next one can start.
 *
 * WHY IT HAS TO EXIST. The call has no time limit — that is the promise the
 * site makes and it is the right one. Slots used to be generated back to
 * back, which was fine while a call was forty-five minutes by definition and
 * became a collision the moment it was not: a session that runs ten minutes
 * over makes the next caller wait, and both of them can see the clock.
 *
 * WHY FIFTEEN, and not ten or twenty. Forty-five plus fifteen is sixty, so
 * the grid lands on the hour — 10:00, 11:00, 12:00 — instead of the 10:00,
 * 10:45, 11:30 it produced before. That is a real difference to somebody
 * choosing a time, and it means an expert's day reads like a calendar rather
 * than an arithmetic sequence. Fifteen minutes is also about as long as a
 * conversation sensibly overruns before it is a different conversation.
 *
 * It is one number and changing it is a scheduling decision, not a code
 * change: the grid, the spacing and the clearance around existing bookings
 * all come from here.
 */
export const SESSION_GAP_MINUTES = 15;
export const DEFAULT_HORIZON_DAYS = 21;
/** Don't offer a slot that starts sooner than this; nobody can prepare in ten minutes. */
export const DEFAULT_LEAD_MINUTES = 120;

export type Interval = { start: number; end: number };

export type AvailabilityRule = { weekday: number; startMinute: number; endMinute: number };

export type AvailabilityException = {
  date: string; // YYYY-MM-DD in the expert's timezone
  kind: "block" | "extra";
  startMinute: number | null;
  endMinute: number | null;
};

export type Slot = { startsAt: Date; endsAt: Date };

/** Milliseconds to add to a UTC instant to get the wall-clock reading in `timeZone`. */
function zoneOffsetMs(instant: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts: Record<string, string> = {};
  for (const p of dtf.formatToParts(instant)) parts[p.type] = p.value;
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour) % 24,
    Number(parts.minute),
    Number(parts.second),
  );
  return asUtc - instant.getTime();
}

/** A civil date + minute-of-day in `timeZone`, resolved to a real instant. */
export function zonedToInstant(dateStr: string, minute: number, timeZone: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  const naive = Date.UTC(y, m - 1, d, Math.floor(minute / 60), minute % 60);
  // Guess, then correct: the offset itself depends on the instant.
  const firstGuess = naive - zoneOffsetMs(new Date(naive), timeZone);
  const corrected = naive - zoneOffsetMs(new Date(firstGuess), timeZone);
  return new Date(corrected);
}

/** YYYY-MM-DD as read on the wall clock in `timeZone`. */
export function zonedDateString(instant: Date, timeZone: string): string {
  const dtf = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return dtf.format(instant);
}

/** 0 = Sunday, for a civil date string. */
export function weekdayOf(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + days));
  return next.toISOString().slice(0, 10);
}

/** Remove `cut` from every interval in `base`, splitting where it lands inside one. */
export function subtractInterval(base: Interval[], cut: Interval): Interval[] {
  const out: Interval[] = [];
  for (const iv of base) {
    if (cut.end <= iv.start || cut.start >= iv.end) {
      out.push(iv);
      continue;
    }
    if (cut.start > iv.start) out.push({ start: iv.start, end: cut.start });
    if (cut.end < iv.end) out.push({ start: cut.end, end: iv.end });
  }
  return out;
}

function mergeIntervals(intervals: Interval[]): Interval[] {
  const sorted = [...intervals].sort((a, b) => a.start - b.start);
  const out: Interval[] = [];
  for (const iv of sorted) {
    const last = out[out.length - 1];
    if (last && iv.start <= last.end) last.end = Math.max(last.end, iv.end);
    else out.push({ ...iv });
  }
  return out;
}

/** The bookable windows for one civil date, in minutes from midnight. */
export function windowsForDate(
  dateStr: string,
  rules: AvailabilityRule[],
  exceptions: AvailabilityException[],
): Interval[] {
  const dayExceptions = exceptions.filter((e) => e.date === dateStr);
  const weekday = weekdayOf(dateStr);

  let windows: Interval[] = rules
    .filter((r) => r.weekday === weekday)
    .map((r) => ({ start: r.startMinute, end: r.endMinute }));

  for (const e of dayExceptions) {
    if (e.kind !== "extra") continue;
    if (e.startMinute === null || e.endMinute === null) continue;
    windows.push({ start: e.startMinute, end: e.endMinute });
  }

  windows = mergeIntervals(windows);

  for (const e of dayExceptions) {
    if (e.kind !== "block") continue;
    // A block with no times blocks the whole day — the common case, a holiday.
    const cut =
      e.startMinute === null || e.endMinute === null
        ? { start: 0, end: 24 * 60 }
        : { start: e.startMinute, end: e.endMinute };
    windows = subtractInterval(windows, cut);
  }

  return windows;
}

export function computeSlots(opts: {
  timezone: string;
  rules: AvailabilityRule[];
  exceptions: AvailabilityException[];
  /**
     Sessions already on the calendar, as INTERVALS rather than start times.

     It used to be a list of starts, compared for equality. That is only
     correct while every booking sits on the same grid as the slots being
     generated, and it has not been: an expert can sell a 15-minute product
     alongside a 45-minute one, so the grid is generated at the requested
     product's length. A 45-minute session booked at 10:00 runs to 10:45, and
     the 15-minute grid offered 10:15 and 10:30 inside it — measured, not
     suspected. Neither start matched, so neither was excluded, and the unique
     index on (expert, startsAt) does not catch it either because the starts
     genuinely differ.
  */
  busy: { startsAt: Date; endsAt: Date }[];
  from: Date;
  to: Date;
  now?: Date;
  slotMinutes?: number;
  leadMinutes?: number;
  gapMinutes?: number;
}): Slot[] {
  const {
    timezone,
    rules,
    exceptions,
    busy,
    from,
    to,
    now = new Date(),
    slotMinutes = SLOT_MINUTES,
    leadMinutes = DEFAULT_LEAD_MINUTES,
    gapMinutes = SESSION_GAP_MINUTES,
  } = opts;

  const gapMs = gapMinutes * 60_000;
  const occupied = busy.map((b) => [b.startsAt.getTime(), b.endsAt.getTime()] as const);
  const earliest = now.getTime() + leadMinutes * 60_000;

  /*
     Does this candidate touch a session that already exists, allowing for the
     gap on BOTH sides of it? The gap belongs to the session that ran over as
     much as to the one about to start, so it is added to each end rather than
     to one.
  */
  const clashes = (startMs: number, endMs: number) =>
    occupied.some(([bs, be]) => startMs < be + gapMs && bs < endMs + gapMs);

  const slots: Slot[] = [];
  let cursor = zonedDateString(from, timezone);
  const lastDate = zonedDateString(to, timezone);

  // Bounded by the horizon so a bad range can't spin.
  for (let guard = 0; cursor <= lastDate && guard < 400; guard++, cursor = addDays(cursor, 1)) {
    for (const window of windowsForDate(cursor, rules, exceptions)) {
      /*
         Stepped by the session PLUS the gap, so the next slot starts after
         the breathing room rather than on top of it. The window-end test
         still measures the session alone: a gap that runs past the end of
         an expert's day costs nobody anything, and requiring room for it
         would silently drop the last slot of every window.
      */
      for (let m = window.start; m + slotMinutes <= window.end; m += slotMinutes + gapMinutes) {
        const startsAt = zonedToInstant(cursor, m, timezone);
        const endsAt = new Date(startsAt.getTime() + slotMinutes * 60_000);
        if (startsAt.getTime() < earliest) continue;
        if (startsAt < from || startsAt > to) continue;
        if (clashes(startsAt.getTime(), endsAt.getTime())) continue;
        slots.push({ startsAt, endsAt });
      }
    }
  }

  return slots.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
}
