import { BRAND_NAME } from "@/lib/brand";

/**
 * A calendar file for one session.
 *
 * WHY THIS EXISTS. The site told a member when their session was and left
 * them to copy it. Every other part of the flow is careful — a signed intake
 * link, a reminder at 24 hours and another at one — and the single most
 * reflexive thing a person does with an appointment, putting it in their
 * calendar, was the one thing not offered. The expert already gets a
 * prefilled Google Calendar link from lib/meet; the customer got a date
 * written in an email.
 *
 * ICS AND NOT A GOOGLE LINK, because a Google link only serves people on
 * Google. RFC 5545 is what Apple Calendar, Outlook, Fastmail and Google all
 * import, and a .ics file is also the only form that survives being forwarded
 * to a spouse or saved for later.
 *
 * THE FORMAT IS FUSSY IN WAYS THAT ARE NOT OPTIONAL, and each rule below is
 * one that silently produces a file some calendar refuses:
 *
 *   - lines end CRLF, not LF (RFC 5545 §3.1)
 *   - lines fold at 75 OCTETS, not characters, with a leading space on the
 *     continuation — so a rupee sign, three bytes in UTF-8, counts as three
 *   - commas, semicolons, backslashes and newlines inside a value are escaped
 *   - timestamps are UTC with a trailing Z, so no VTIMEZONE block is needed
 *     and no reader has to agree with us about IST
 *   - UID is stable per booking, so a reissued file UPDATES the event the
 *     member already has rather than adding a second one next to it
 *   - SEQUENCE rises when the booking is moved, which is what tells a
 *     calendar the update is newer than what it holds
 */

/**
 * The right-hand side of every UID.
 *
 * A LITERAL, deliberately, and not NEXT_PUBLIC_SITE_URL. A UID identifies the
 * event for the life of the booking, so it has to survive the site moving to
 * a new domain, running on a preview URL, or being read on localhost. Build
 * it from the environment and the same booking downloaded twice from two
 * hosts becomes two events sitting next to each other in somebody's calendar.
 */
const UID_DOMAIN = "landline.in";

/** RFC 5545 §3.3.11: these four characters have meaning inside a value. */
function escapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/**
 * Fold at 75 octets.
 *
 * Measured in bytes rather than characters, and the split never lands inside
 * a multi-byte character — a half-written rupee sign is not a rupee sign. So
 * the walk is over code points, counting the UTF-8 width of each.
 */
function fold(line: string): string {
  const LIMIT = 75;
  const out: string[] = [];
  let current = "";
  let bytes = 0;

  for (const ch of line) {
    const width = Buffer.byteLength(ch, "utf8");
    /* 74 on a continuation line, because the leading space costs one octet. */
    const limit = out.length === 0 ? LIMIT : LIMIT - 1;
    if (bytes + width > limit) {
      out.push(current);
      current = "";
      bytes = 0;
    }
    current += ch;
    bytes += width;
  }
  out.push(current);

  return out.map((part, n) => (n === 0 ? part : ` ${part}`)).join("\r\n");
}

/** 20261026T103000Z — UTC, so nothing has to agree with us about IST. */
function stamp(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

export type SessionEvent = {
  bookingId: string;
  expertName: string;
  startsAt: Date;
  endsAt: Date;
  /** Null until the expert supplies one. */
  meetingUrl: string | null;
  /** bookings.rescheduleCount — a moved booking is a newer version of itself. */
  sequence?: number;
  /** When the file was produced. Injectable so a test can pin it. */
  now?: Date;
};

export function sessionIcs(e: SessionEvent): string {
  const now = e.now ?? new Date();

  /*
     The description says what the member needs if they open this event six
     days from now with the email long gone: who they are speaking to, and
     where to join. The meeting link goes in both DESCRIPTION and LOCATION,
     because different calendars surface different fields — Google shows
     LOCATION, Apple makes a URL in the description tappable.
  */
  const lines: string[] = [];
  lines.push(`A session with ${e.expertName}.`);
  if (e.meetingUrl) {
    lines.push("", `Join: ${e.meetingUrl}`);
  } else {
    lines.push(
      "",
      "Your expert will add a joining link before the call. It appears in your Landline console and in your reminder.",
    );
  }

  const fields: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:-//${BRAND_NAME}//Session//EN`,
    "CALSCALE:GREGORIAN",
    /*
       PUBLISH and not REQUEST. REQUEST makes this an invitation with us as
       the organiser, which puts an accept/decline on it and makes some
       clients mail a reply to an address that does not take replies. The
       member already booked; they are not being invited.
    */
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    /* Stable per booking, so re-downloading updates rather than duplicates. */
    `UID:booking-${e.bookingId}@${UID_DOMAIN}`,
    `DTSTAMP:${stamp(now)}`,
    `DTSTART:${stamp(e.startsAt)}`,
    `DTEND:${stamp(e.endsAt)}`,
    `SEQUENCE:${e.sequence ?? 0}`,
    `SUMMARY:${escapeText(`${BRAND_NAME} — ${e.expertName}`)}`,
    `DESCRIPTION:${escapeText(lines.join("\n"))}`,
    "STATUS:CONFIRMED",
    "TRANSP:OPAQUE",
  ];

  if (e.meetingUrl) {
    fields.push(`LOCATION:${escapeText(e.meetingUrl)}`);
    fields.push(`URL:${escapeText(e.meetingUrl)}`);
  }

  /*
     One alarm, fifteen minutes out. Not a second one at 24 hours: we already
     send an email then, and two notices for the same thing from two channels
     is how people start muting a sender.
  */
  fields.push(
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    `DESCRIPTION:${escapeText(`${BRAND_NAME} session in 15 minutes`)}`,
    "TRIGGER:-PT15M",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  );

  return fields.map(fold).join("\r\n") + "\r\n";
}

/** What the file is called when it lands in somebody's downloads. */
export function icsFilename(startsAt: Date): string {
  const d = startsAt.toISOString().slice(0, 10);
  return `landline-${d}.ics`;
}
