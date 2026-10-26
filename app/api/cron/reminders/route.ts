import { NextRequest, NextResponse } from "next/server";
import { and, between, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { bookings, customers, experts, intakeSubmissions } from "@/lib/db/schema";
import { cronAuthorised, linkNudgeDue } from "@/lib/cron";
import { expertLinkMissing, intakeNudge, reminder, sendOnce } from "@/lib/email";

export const dynamic = "force-dynamic";

/**
 * Runs hourly. Every send is guarded by the unique index on
 * (booking_id, kind), so overlapping runs cannot double-send.
 */
export async function GET(req: NextRequest) {
  if (!cronAuthorised(req)) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const now = Date.now();
  const hours = (n: number) => new Date(now + n * 60 * 60 * 1000);

  const upcoming = await db
    .select({
      booking: bookings,
      expert: experts,
      customer: customers,
      intakeId: intakeSubmissions.id,
    })
    .from(bookings)
    .innerJoin(experts, eq(bookings.expertId, experts.id))
    .innerJoin(customers, eq(bookings.customerId, customers.id))
    .leftJoin(intakeSubmissions, eq(intakeSubmissions.bookingId, bookings.id))
    .where(and(eq(bookings.status, "confirmed"), between(bookings.startsAt, hours(0), hours(26))));

  let sent = 0;

  for (const { booking, expert, customer, intakeId } of upcoming) {
    const hoursAway = (booking.startsAt.getTime() - now) / (60 * 60 * 1000);

    if (hoursAway >= 23 && hoursAway <= 25) {
      const msg = reminder({
        customerName: customer.name,
        expertName: expert.displayName,
        startsAt: booking.startsAt,
        meetingUrl: booking.meetingUrl,
        soon: false,
        bookingId: booking.id,
      });
      if ((await sendOnce(booking.id, "reminder_24h", { to: customer.email, ...msg })) === "sent") sent++;

      if (intakeId === null) {
        const nudge = intakeNudge({
          customerName: customer.name,
          startsAt: booking.startsAt,
          bookingId: booking.id,
        });
        if ((await sendOnce(booking.id, "intake_nudge", { to: customer.email, ...nudge })) === "sent") sent++;
      }
    }

    /*
       THE EXPERT, not the customer, when the booking still has no link.

       A link is pasted in by hand until a Google Cloud project exists, so it
       can be forgotten — and the first anyone hears of that today is a
       customer with nowhere to join. Nudged a day out, and again two hours
       out if it is still missing, each exactly once thanks to the unique
       index on (booking_id, kind).

       Not folded into the 24h block above: that one is gated on the customer
       reminder window and this has to fire whether or not the customer has
       already been reminded.
    */
    const nudge = linkNudgeDue(hoursAway, booking.meetingUrl !== null);
    if (nudge !== "none") {
      const urgent = nudge === "urgent";
      const msg = expertLinkMissing({
        expertName: expert.displayName,
        customerName: customer.name,
        startsAt: booking.startsAt,
        urgent,
      });
      const kind = urgent ? "expert_link_urgent" : "expert_link_missing";
      if ((await sendOnce(booking.id, kind, { to: expert.contactEmail, ...msg })) === "sent") {
        sent++;
      }
    }

    if (hoursAway >= 0.5 && hoursAway <= 1.5) {
      const msg = reminder({
        customerName: customer.name,
        expertName: expert.displayName,
        startsAt: booking.startsAt,
        meetingUrl: booking.meetingUrl,
        soon: true,
        bookingId: booking.id,
      });
      if ((await sendOnce(booking.id, "reminder_1h", { to: customer.email, ...msg })) === "sent") sent++;
    }
  }

  return NextResponse.json({ considered: upcoming.length, sent });
}
