import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Passes are not sold any more. This route refuses.
 *
 * WHY IT IS A REFUSAL AND NOT A DELETED FILE
 *
 * The storefront says "No packages, no passes, nothing to cancel" — one
 * product, the call. This endpoint disagreed with that, and it disagreed
 * loudly: it accepted an unauthenticated POST carrying a name and an email
 * and opened a live Razorpay order for up to ₹2,45,000, creating a customer
 * row on the way through. Nothing linked to it but one button in the member
 * console, and a route does not need a link to be reachable — "nobody knows
 * it is there" was never a control.
 *
 * Deleting the file would answer 404, which reads as a mistake worth
 * retrying: a bad deploy, a renamed path. 410 says the thing existed, a
 * decision was taken, and retrying will not change it. It also leaves this
 * note where the next person will look, so the endpoint does not quietly come
 * back the first time somebody wants to sell a pass again.
 *
 * DELIBERATELY STILL ALIVE: /api/memberships/book, which lets somebody who
 * already holds a pass book inside it. Ceasing to sell something and refusing
 * to honour what was already sold are different decisions, and only the first
 * one has been made.
 */
export async function POST() {
  return NextResponse.json(
    { error: "Passes are no longer sold. Sessions are booked and paid for one at a time." },
    { status: 410 },
  );
}
