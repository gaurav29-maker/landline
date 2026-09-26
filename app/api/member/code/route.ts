import { toE164 } from "@/lib/phone";
import { issueCode } from "@/lib/member-code";
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
 * The work that varies lives in issueCode, which the step-up screen shares and
 * which refuses to distinguish a stranger from a member for the same reason.
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
    await issueCode(phone);
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
