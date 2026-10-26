import crypto from "node:crypto";

/**
 * Intake links carry an HMAC of the booking id instead of requiring a login.
 * Phases 1-2 have no customer accounts; this is what stands in for auth.
 */

function secret(): string {
  const s = process.env.TOKEN_SECRET;
  if (!s) throw new Error("TOKEN_SECRET is not set");
  return s;
}

export function signBookingToken(bookingId: string): string {
  return crypto.createHmac("sha256", secret()).update(bookingId).digest("hex");
}

export function verifyBookingToken(bookingId: string, token: string | null | undefined): boolean {
  if (!token) return false;
  const expected = signBookingToken(bookingId);
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(token, "utf8");
  // Length must match before timingSafeEqual, which throws on a mismatch.
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function intakeUrl(bookingId: string): string {
  return `${siteUrl()}/booking/${bookingId}/intake?t=${signBookingToken(bookingId)}`;
}

/**
 * The calendar file, as a link that works from an inbox.
 *
 * Signed like the intake link and for the same reason: a mail client sends no
 * cookies, so the route has no session to read and the token is the only
 * proof the clicker owns this booking.
 */
export function calendarUrl(bookingId: string): string {
  return `${siteUrl()}/booking/${bookingId}/calendar?t=${signBookingToken(bookingId)}`;
}

/**
 * Where this site lives, for links that have to work from an inbox.
 *
 * Exported because emails need it too, and one fallback is better than each
 * template carrying its own guess about the port.
 */
export function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}
