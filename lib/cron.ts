import crypto from "node:crypto";
import { NextRequest } from "next/server";

/**
 * Vercel Cron sends `Authorization: Bearer $CRON_SECRET`.
 *
 * Compared in constant time, like every other secret in this codebase. `===`
 * on a string returns as soon as two bytes differ, which leaks how much of a
 * guess was right. Exploiting that across a network is genuinely hard, but
 * this is a two-line fix and the inconsistency was the real problem: a reader
 * finding one hand-rolled comparison among five careful ones cannot tell
 * whether it was reasoned about or missed.
 */
export function cronAuthorised(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const offered = req.headers.get("authorization");
  if (!offered) return false;

  const a = Buffer.from(offered, "utf8");
  const b = Buffer.from(`Bearer ${secret}`, "utf8");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/**
 * Whether an approaching session should chase its expert for a joining link.
 *
 * A PURE FUNCTION, AND THAT IS THE POINT. The window arithmetic is the part
 * of this feature that can quietly be wrong, and it is the part hardest to
 * observe from outside: sendOnce claims a notification row, attempts the
 * send, and DELETES the row again if the send throws. With no RESEND_API_KEY
 * — which is the state this site is in today — every send throws, so nothing
 * is left behind to assert on and a test of the hourly job can only prove
 * that no email went out, which it already knew.
 *
 * So the decision lives here where it can be asked directly, and the route
 * does the sending. The first version of the test went the other way, looked
 * for a notification row, found none, and reported a broken feature that was
 * working.
 *
 * TWO WINDOWS, two hours wide each, against an hourly cron: wide enough that
 * a late or skipped run still catches the booking, and the unique index on
 * (booking_id, kind) is what stops the overlap sending twice.
 *
 *   - "missing" a day out. A reminder, with time to act on it.
 *   - "urgent" about two hours out. The same fact, now a problem.
 */
export type LinkNudge = "none" | "missing" | "urgent";

export function linkNudgeDue(hoursAway: number, hasMeetingUrl: boolean): LinkNudge {
  if (hasMeetingUrl) return "none";
  if (hoursAway >= 23 && hoursAway <= 25) return "missing";
  if (hoursAway >= 1.5 && hoursAway <= 2.5) return "urgent";
  return "none";
}
