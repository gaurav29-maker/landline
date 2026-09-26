import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { customers, signInCodes } from "@/lib/db/schema";
import { CODE_DIGITS, CODE_MAX_ATTEMPTS, CODE_MINUTES, codeMatches, generateCode, hashCode } from "@/lib/member-auth";
import { SIGN_IN_THROTTLE_SECONDS } from "@/lib/constants";
import { sendSms, signInSms } from "@/lib/sms";

/**
 * Issuing and checking a six-digit code, in one place.
 *
 * Two screens need this now: signing in, and proving it is still you before
 * something sensitive. They are different questions — one has no session, the
 * other has a perfectly valid one — but the mechanism is identical, and a
 * second copy of "generate, hash, store, throttle, cap" is a second place for
 * the cap to quietly go missing.
 */

/**
 * Send a code, if the member exists and is not being spammed.
 *
 * Returns nothing in every case on purpose. Whether a number belongs to a
 * customer is a fact about a person, and the caller must not be able to tell
 * — /api/member/code answers a stranger and a member identically, and it can
 * only keep doing that if this function refuses to distinguish them.
 */
export async function issueCode(phone: string): Promise<void> {
  const [customer] = await db.select().from(customers).where(eq(customers.phone, phone)).limit(1);
  if (!customer) return;
  await mintAndSend(customer.id, phone, customer.lastLinkSentAt);
}

/**
 * Send a code to a number that is not the account's — yet.
 *
 * Used when changing the phone on an account: the code has to go to the NEW
 * number, because holding it is exactly the thing being proven. The caller
 * has already established who is asking (a signed-in, freshly verified
 * session), which is why this one takes a customer id instead of looking one
 * up by number.
 */
export async function issueCodeTo(customerId: string, phone: string): Promise<boolean> {
  const [customer] = await db
    .select({ lastLinkSentAt: customers.lastLinkSentAt })
    .from(customers)
    .where(eq(customers.id, customerId))
    .limit(1);
  if (!customer) return false;
  return mintAndSend(customerId, phone, customer.lastLinkSentAt);
}

async function mintAndSend(
  customerId: string,
  toPhone: string,
  lastSentAt: Date | null,
): Promise<boolean> {

  /*
     One send per minute per number, on the column the emailed link already
     used. Without it this is a button that makes a stranger's phone buzz as
     often as somebody likes.
  */
  const recent = lastSentAt && Date.now() - lastSentAt.getTime() < SIGN_IN_THROTTLE_SECONDS * 1000;
  /*
     Reported, not just obeyed.

     Sign-in swallows this silently on purpose — telling a stranger they were
     throttled tells them the number is a customer. The signed-in flows have
     no such problem and a real cost to staying quiet: a member who has just
     typed one code would be shown "we texted you" for a message that was
     never sent, and would wait for it.
  */
  if (recent) return false;

  /*
     Retire every code this member is still holding before issuing another.
     Otherwise asking twice leaves two live codes, and asking three times
     because the first was slow has tripled the guesses that work.
  */
  await db
    .update(signInCodes)
    .set({ consumedAt: new Date() })
    .where(and(eq(signInCodes.customerId, customerId), isNull(signInCodes.consumedAt)));

  const code = generateCode();
  await db.insert(signInCodes).values({
    customerId,
    codeHash: await hashCode(customerId, code),
    expiresAt: new Date(Date.now() + CODE_MINUTES * 60_000),
  });

  /* Stamped before sending: a provider that hangs must not leave the throttle
     unset, which would turn a slow send into an unlimited one. */
  await db.update(customers).set({ lastLinkSentAt: new Date() }).where(eq(customers.id, customerId));

  await sendSms({ to: toPhone, ...signInSms(code, CODE_MINUTES) });
  return true;
}

export type CodeResult = "ok" | "wrong" | "attempts";

/**
 * Spend a code, once.
 *
 * "wrong" covers a bad code, an expired one, one already used and a member
 * with no live code at all — told apart, this would answer questions about
 * other people's accounts. "attempts" is the one exception, because somebody
 * whose code just died needs to be told to ask for another rather than keep
 * typing into a box that can no longer work.
 */
export async function spendCode(customerId: string, raw: string): Promise<CodeResult> {
  const code = raw.replace(/\D/g, "");
  if (code.length !== CODE_DIGITS) return "wrong";

  const [row] = await db
    .select()
    .from(signInCodes)
    .where(
      and(
        eq(signInCodes.customerId, customerId),
        isNull(signInCodes.consumedAt),
        gt(signInCodes.expiresAt, new Date()),
      ),
    )
    .orderBy(desc(signInCodes.createdAt))
    .limit(1);

  if (!row) return "wrong";

  if (row.attempts >= CODE_MAX_ATTEMPTS) {
    /* Burned, not paused, so the cap cannot be waited out. */
    await db.update(signInCodes).set({ consumedAt: new Date() }).where(eq(signInCodes.id, row.id));
    return "attempts";
  }

  if (!(await codeMatches(customerId, code, row.codeHash))) {
    await db
      .update(signInCodes)
      .set({ attempts: row.attempts + 1 })
      .where(eq(signInCodes.id, row.id));
    return "wrong";
  }

  /*
     Claimed with the row still unconsumed in the WHERE. Two requests carrying
     the same correct code race here; the update that changes no rows loses
     and is refused. Without it a code works as often as it is submitted.
  */
  const claimed = await db
    .update(signInCodes)
    .set({ consumedAt: new Date() })
    .where(and(eq(signInCodes.id, row.id), isNull(signInCodes.consumedAt)))
    .returning({ id: signInCodes.id });

  return claimed.length === 1 ? "ok" : "wrong";
}
