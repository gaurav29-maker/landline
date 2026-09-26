import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { customers, signInCodes } from "@/lib/db/schema";
import { CODE_MINUTES, generateCode, hashCode } from "@/lib/member-auth";
import { SIGN_IN_THROTTLE_SECONDS } from "@/lib/constants";
import { toE164 } from "@/lib/phone";
import { sendSms, signInSms } from "@/lib/sms";
import { verifyTurnstile } from "@/lib/turnstile";

export const dynamic = "force-dynamic";

/**
 * Ask for a sign-in code.
 *
 * THIS ROUTE ALWAYS SAYS THE SAME THING.
 *
 * Not "no such member", not a different status, not a faster answer. A number
 * either is or is not one of our customers, and that is a fact about a person
 * which this endpoint is in no position to hand out — anybody could stand here
 * with a list of numbers and learn which of them pay for portfolio advice.
 * Every branch below ends at the same 200.
 *
 * The work that varies is all on the inside: unknown numbers do nothing,
 * known ones get a code, and a throttled one is quietly skipped.
 */
export async function POST(req: Request) {
  let body: { phone?: unknown; turnstile?: unknown };
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const ok = () => Response.json({ ok: true });

  /*
     The bot check runs before anything touches the database, because that is
     the cost this endpoint is defending — an SMS bill and somebody else's
     handset buzzing. This is the one failure the caller is told about: a
     human who fails it needs to know to try the checkbox again.
  */
  if (!(await verifyTurnstile(typeof body.turnstile === "string" ? body.turnstile : null))) {
    return Response.json({ ok: false, error: "human" }, { status: 400 });
  }

  const phone = typeof body.phone === "string" ? toE164(body.phone) : null;
  /* A number that is not a number cannot be a member's, so: nothing, quietly. */
  if (!phone) return ok();

  try {
    const [customer] = await db
      .select()
      .from(customers)
      .where(eq(customers.phone, phone))
      .limit(1);

    if (!customer) return ok();

    /*
       One send per minute per number, the same throttle the emailed link
       uses and the same column. Without it, this endpoint is a button that
       makes a stranger's phone buzz as often as somebody likes.
    */
    const recent =
      customer.lastLinkSentAt &&
      Date.now() - customer.lastLinkSentAt.getTime() < SIGN_IN_THROTTLE_SECONDS * 1000;
    if (recent) return ok();

    /*
       Retire every code this member is still holding before issuing another.

       Otherwise asking twice leaves two live codes, and a member who asks
       three times because the first was slow has tripled the number of
       guesses that work. Newest code only, always.
    */
    await db
      .update(signInCodes)
      .set({ consumedAt: new Date() })
      .where(and(eq(signInCodes.customerId, customer.id), isNull(signInCodes.consumedAt)));

    const code = generateCode();
    await db.insert(signInCodes).values({
      customerId: customer.id,
      codeHash: await hashCode(customer.id, code),
      expiresAt: new Date(Date.now() + CODE_MINUTES * 60_000),
    });

    /*
       Stamp the throttle before sending, not after. A provider that hangs
       must not leave the throttle unset — that turns a slow send into an
       unlimited one.
    */
    await db
      .update(customers)
      .set({ lastLinkSentAt: new Date() })
      .where(eq(customers.id, customer.id));

    await sendSms({ to: phone, ...signInSms(code, CODE_MINUTES) });
  } catch (err) {
    /*
       Logged, not returned. A member who genuinely cannot be sent a code sees
       the code box and then sees their code refused, which is a worse minute
       than an error would be — but the alternative is this endpoint
       reporting, to anybody, which numbers made it as far as the SMS gateway.
    */
    console.error("[member] sign-in code failed", err);
  }

  return ok();
}
