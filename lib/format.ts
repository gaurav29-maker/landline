export const IST = "Asia/Kolkata";

export function rupees(paise: number): string {
  return `₹${(paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

export function istDateTime(d: Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: IST,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(d);
}

export function istTime(d: Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: IST,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(d);
}

export function istDayLabel(d: Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: IST,
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(d);
}

/**
 * A date with the year on it, for dates far enough away that the year is the
 * part that matters.
 *
 * istDayLabel above deliberately omits the year, because every date it
 * formats is a booking within the next few weeks and "Sat, 26 Oct 2026" reads
 * as officialdom. A retention date is eight years out, where leaving the year
 * off turns "Sat, 26 Oct" into a date next week.
 */
export function istDateYear(d: Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: IST,
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
}
