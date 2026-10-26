import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { bookings, experts } from "@/lib/db/schema";
import { verifyBookingToken } from "@/lib/tokens";
import { readSession } from "@/lib/member-session";
import { icsFilename, sessionIcs } from "@/lib/ics";

export const dynamic = "force-dynamic";

/**
 * The session as a calendar file.
 *
 * TWO WAYS TO PROVE IT IS YOURS, because this link has to work in two places
 * that know different things. In the console the member is signed in and the
 * booking is theirs; in a confirmation email there is no session at all —
 * mail clients do not carry cookies — so the email carries the same signed
 * token the intake link has carried all along. Either is enough, neither is
 * assumed.
 *
 * UNDER /booking AND NOT /member, for that second case. Everything under
 * /member is behind middleware that bounces a request with no session, which
 * is exactly what a click from an inbox is.
 *
 * NO FRESHNESS CHECK, unlike the data export or the delete page. What this
 * discloses is a time, an expert's name and a joining link the member already
 * has in two emails and on their console. Asking somebody to type a code to
 * add an appointment to their calendar would be security theatre at the
 * expense of the thing being used.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const id = url.pathname.split("/")[2];
  const token = url.searchParams.get("t");

  const [row] = await db
    .select({
      id: bookings.id,
      customerId: bookings.customerId,
      startsAt: bookings.startsAt,
      endsAt: bookings.endsAt,
      status: bookings.status,
      meetingUrl: bookings.meetingUrl,
      rescheduleCount: bookings.rescheduleCount,
      expertName: experts.displayName,
    })
    .from(bookings)
    .innerJoin(experts, eq(experts.id, bookings.expertId))
    .where(eq(bookings.id, id))
    .limit(1);

  /* One answer for "no such booking" and "not yours", so this cannot be used
     to discover which booking ids exist. */
  if (!row) return new Response("Not found", { status: 404 });

  const byToken = verifyBookingToken(id, token);
  const session = byToken ? null : await readSession();
  const bySession = session !== null && session.customerId === row.customerId;

  if (!byToken && !bySession) return new Response("Not found", { status: 404 });

  /*
     A cancelled session is not an appointment. Returning a file for one would
     put a dead event back into a calendar the member may already have cleaned
     up — and a held booking is not confirmed yet, so it is not one either.
  */
  if (row.status !== "confirmed" && row.status !== "completed") {
    return new Response("Not found", { status: 404 });
  }

  const body = sessionIcs({
    bookingId: row.id,
    expertName: row.expertName,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    meetingUrl: row.meetingUrl,
    /* A moved booking is a newer version of the same event, not a new one. */
    sequence: row.rescheduleCount,
  });

  return new Response(body, {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": `attachment; filename="${icsFilename(row.startsAt)}"`,
      /*
         Never cached. The joining link can be added or changed by the expert
         at any moment, and a stale file is one a member joins nothing from.
      */
      "cache-control": "no-store, max-age=0",
    },
  });
}
