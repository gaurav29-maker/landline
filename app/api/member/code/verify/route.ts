import { NextResponse } from "next/server";
import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { customers, signInCodes } from "@/lib/db/schema";
import {
  CODE_DIGITS,
  CODE_MAX_ATTEMPTS,
  MEMBER_COOKIE,
  codeMatches,
  mintSession,
} from "@/lib/member-auth";
import { toE164 } from "@/lib/phone";

export const dynamic = "force-dynamic";

/**
 * Trades a code for a session cookie.
 *
 * ONE REFUSAL, WHATEVER WENT WRONG.
 *
 * Wrong digits, expired, already used, too many guesses, a number that was
 * never a member's — all of it comes back as the same "that code is not
 * right". Telling them apart would be friendlier and would also say, to
 * anybody typing 000000 at a list of numbers, which of those numbers belong
 * to customers. The one exception is the attempt cap, because a member whose
 * code just died needs to be told to ask for another rather than keep typing.
 */
export async function POST(req: Request) {
  let body: { phone?: unknown; code?: unknown };
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const no = () => NextResponse.json({ ok: false, error: "code" }, { status: 400 });

  const phone = typeof body.phone === "string" ? toE164(body.phone) : null;
  const code = typeof body.code === "string" ? body.code.replace(/\D/g, "") : "";
  if (!phone || code.length !== CODE_DIGITS) return no();

  const [customer] = await db.select().from(customers).where(eq(customers.phone, phone)).limit(1);
  if (!customer) return no();

  /*
     The newest code that is still alive: not consumed, not expired. Expiry is
     part of the query rather than a check afterwards, so an old row cannot be
     picked up and then argued with.
  */
  const [row] = await db
    .select()
    .from(signInCodes)
    .where(
      and(
        eq(signInCodes.customerId, customer.id),
        isNull(signInCodes.consumedAt),
        gt(signInCodes.expiresAt, new Date()),
      ),
    )
    .orderBy(desc(signInCodes.createdAt))
    .limit(1);

  if (!row) return no();

  if (row.attempts >= CODE_MAX_ATTEMPTS) {
    /* Burn it, so the cap cannot be waited out. */
    await db.update(signInCodes).set({ consumedAt: new Date() }).where(eq(signInCodes.id, row.id));
    return NextResponse.json({ ok: false, error: "attempts" }, { status: 400 });
  }

  if (!(await codeMatches(customer.id, code, row.codeHash))) {
    await db
      .update(signInCodes)
      .set({ attempts: row.attempts + 1 })
      .where(eq(signInCodes.id, row.id));
    return no();
  }

  /*
     Consumed before the cookie is minted, and scoped to a row that is still
     unconsumed. Two requests arriving with the same correct code race here;
     the update that changes no rows is the one that loses, and it is refused.
     Without this a code works as many times as it is submitted.
  */
  const claimed = await db
    .update(signInCodes)
    .set({ consumedAt: new Date() })
    .where(and(eq(signInCodes.id, row.id), isNull(signInCodes.consumedAt)))
    .returning({ id: signInCodes.id });

  if (claimed.length === 0) return no();

  const { value, expiresAt } = await mintSession(customer.id);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(MEMBER_COOKIE, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
  return res;
}
