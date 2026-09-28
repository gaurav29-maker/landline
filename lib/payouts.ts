import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { bookings, expertPayouts, expertProducts, experts } from "@/lib/db/schema";
import { EXPERT_SHARE_BPS } from "@/lib/constants";

/**
 * The expert payout ledger.
 *
 * Every function here is safe to call twice. Closing a session is reachable
 * from the expert console and from ops, and a booking can be completed once
 * from each before anybody notices — so "record a payout" has to mean "make
 * sure exactly one exists", not "insert one".
 *
 * The database backs that up rather than trusting this file:
 * expert_payouts_one_per_booking is a unique index, so a second insert is
 * refused even if two requests land in the same millisecond.
 */

/** What a session earns today. Read once, at the moment it is earned. */
export function rateForSession(sessionValuePaise: number): number {
  /* Integer maths throughout: paise in, paise out, rounded once. */
  return Math.round((sessionValuePaise * EXPERT_SHARE_BPS) / 10000);
}

/**
 * Records what an expert is owed for a session that happened.
 *
 * Called when a booking reaches `completed` or `no_show`. A no-show still
 * earns: the refund policy says the customer is not refunded because the slot
 * was held and the intake was read, and the payout has to agree with that or
 * the two documents contradict each other.
 *
 * Returns the amount recorded, or null if there was nothing to record —
 * already recorded, booking not in a state that earns, or booking gone.
 * Never throws at the caller: closing a session must not fail because the
 * ledger had an opinion.
 */
/**
 * What this session is worth, for payout purposes.
 *
 * Product price, then the amount charged, then the expert's listed price.
 * Each fallback exists for a real row: products are new, pass-covered
 * bookings charge nothing, and a product deleted later should not strand
 * a payout at zero.
 */
async function sessionValuePaise(booking: {
  expertId: string;
  amountPaise: number;
  productId: string | null;
}): Promise<number> {
  if (booking.productId) {
    const [product] = await db
      .select({ pricePaise: expertProducts.pricePaise })
      .from(expertProducts)
      .where(eq(expertProducts.id, booking.productId))
      .limit(1);
    if (product) return product.pricePaise;
  }

  if (booking.amountPaise > 0) return booking.amountPaise;

  const [expert] = await db
    .select({ pricePaise: experts.pricePaise })
    .from(experts)
    .where(eq(experts.id, booking.expertId))
    .limit(1);
  return expert?.pricePaise ?? 0;
}

export async function recordPayout(bookingId: string): Promise<number | null> {
  try {
    const [booking] = await db
      .select({
        id: bookings.id,
        expertId: bookings.expertId,
        status: bookings.status,
        amountPaise: bookings.amountPaise,
        productId: bookings.productId,
      })
      .from(bookings)
      .where(eq(bookings.id, bookingId))
      .limit(1);

    if (!booking) return null;
    if (booking.status !== "completed" && booking.status !== "no_show") return null;

    /*
       WHAT THE SESSION IS WORTH, WHICH IS NOT WHAT THE CUSTOMER PAID.

       A session covered by a pass or a bundle records amountPaise = 0,
       because no money changed hands for that particular booking. Taking
       a share of that would pay the expert nothing for an hour of real
       work — the customer paid up front instead, and the expert is owed
       the same either way.

       So the product's price leads: it is what this session costs when
       somebody buys it outright. The amount charged is the fallback for
       bookings that predate products, and the expert's own price is the
       last resort.
    */
    const sessionValue = await sessionValuePaise(booking);
    const amountPaise = rateForSession(sessionValue);

    const inserted = await db
      .insert(expertPayouts)
      .values({ expertId: booking.expertId, bookingId: booking.id, amountPaise })
      // Already there: leave it exactly as it is. Re-running must not change
      // an amount that was fixed when the session happened, nor revive one
      // that was voided by a refund.
      .onConflictDoNothing({ target: expertPayouts.bookingId })
      .returning({ id: expertPayouts.id });

    return inserted.length > 0 ? amountPaise : null;
  } catch (err) {
    console.error("[payouts] recordPayout failed", bookingId, err);
    return null;
  }
}

/**
 * Voids the payout for a refunded booking.
 *
 * Voided rather than deleted, because "this session earned nothing, and here
 * is why" is a different and more useful statement than silence. A payout
 * already marked paid is left alone — the money has gone, and pretending
 * otherwise would make the ledger disagree with the bank.
 */
export async function voidPayout(bookingId: string, note: string): Promise<void> {
  try {
    await db
      .update(expertPayouts)
      .set({ status: "void", note, updatedAt: new Date() })
      .where(and(eq(expertPayouts.bookingId, bookingId), eq(expertPayouts.status, "pending")));
  } catch (err) {
    console.error("[payouts] voidPayout failed", bookingId, err);
  }
}

export type PayoutTotals = { pendingPaise: number; paidPaise: number; sessions: number };

/** What one expert is owed and has been paid. */
export async function totalsForExpert(expertId: string): Promise<PayoutTotals> {
  const rows = await db
    .select({
      status: expertPayouts.status,
      total: sql<number>`coalesce(sum(${expertPayouts.amountPaise}), 0)::int`,
      n: sql<number>`count(*)::int`,
    })
    .from(expertPayouts)
    .where(and(eq(expertPayouts.expertId, expertId), inArray(expertPayouts.status, ["pending", "paid"])))
    .groupBy(expertPayouts.status);

  let pendingPaise = 0;
  let paidPaise = 0;
  let sessions = 0;
  for (const r of rows) {
    if (r.status === "pending") pendingPaise = r.total;
    if (r.status === "paid") paidPaise = r.total;
    sessions += r.n;
  }
  return { pendingPaise, paidPaise, sessions };
}
