import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { customers } from "@/lib/db/schema";
import { MEMBER_COOKIE } from "@/lib/member-auth";
import { spendCode } from "@/lib/member-code";
import { startSession } from "@/lib/member-session";
import { toE164 } from "@/lib/phone";

export const dynamic = "force-dynamic";

/**
 * Trades a code for a session cookie.
 *
 * ONE REFUSAL, WHATEVER WENT WRONG.
 *
 * Wrong digits, expired, already used, a number that was never a member's —
 * all of it comes back as the same "that code is not right". Telling them
 * apart would be friendlier and would also say, to anybody typing 000000 at a
 * list of numbers, which of those numbers belong to customers. The one
 * exception is the attempt cap, because a member whose code just died needs
 * to be told to ask for another rather than keep typing.
 *
 * The checking itself is in lib/member-code, shared with the step-up screen.
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
  const code = typeof body.code === "string" ? body.code : "";
  if (!phone) return no();

  const [customer] = await db.select().from(customers).where(eq(customers.phone, phone)).limit(1);
  if (!customer) return no();

  const result = await spendCode(customer.id, code);
  if (result === "attempts") {
    return NextResponse.json({ ok: false, error: "attempts" }, { status: 400 });
  }
  if (result !== "ok") return no();

  const { value, expiresAt } = await startSession(customer.id);
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
