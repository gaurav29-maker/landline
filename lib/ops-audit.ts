import { cookies, headers } from "next/headers";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { opsEvents, opsUsers } from "@/lib/db/schema";
import { OPS_COOKIE, sessionOperatorId } from "@/lib/ops-auth";

/**
 * Who did it.
 *
 * Two functions, and the relationship between them is the whole design:
 * `requireOperator()` is the only way to pass the guard in front of an ops
 * action, and it returns a person rather than a boolean. `audited()` is the
 * only convenient way to change anything, and it will not compile without
 * that person. An action cannot be written that mutates without naming its
 * author, which is a stronger guarantee than remembering to log.
 *
 * The event is written INSIDE the same transaction as the change. Not after
 * it, not in a callback, not best-effort. A refund that succeeds while its
 * record fails would be the exact hole this table exists to close, so the two
 * either land together or neither does.
 */

export type Operator = {
  id: string;
  email: string;
  name: string;
};

/**
 * The signed-in operator, or a thrown error.
 *
 * Middleware already checked the cookie's signature at the edge. This is the
 * half the edge could not do: the row still has to exist and still has to be
 * active. A cookie stays valid for seven days, so without this check a
 * disabled operator keeps working for a week after being disabled — which is
 * to say, disabling somebody would not disable them.
 */
export async function requireOperator(): Promise<Operator> {
  const token = (await cookies()).get(OPS_COOKIE)?.value;
  const operatorId = await sessionOperatorId(token);
  if (!operatorId) throw new Error("Not signed in");

  const [row] = await db.select().from(opsUsers).where(eq(opsUsers.id, operatorId)).limit(1);
  if (!row || row.status !== "active") throw new Error("Not signed in");

  return { id: row.id, email: row.email, name: row.name };
}

/** What kind of thing an event is about. */
export type OpsEntity = "booking" | "expert" | "application" | "payout";

type Entry = {
  /** Dotted and stable, e.g. "booking.refund". Read by people, so read well. */
  action: string;
  entity: OpsEntity;
  entityId: string;
  /** Only the fields that moved. Never a whole row — see the schema comment. */
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  note?: string | null;
};

/**
 * Where the request came from.
 *
 * x-forwarded-for is a list when proxies chain; the first entry is the client
 * as the nearest trusted proxy saw it. It is spoofable by anyone talking to
 * the origin directly, so this is recorded as a hint and never relied on for
 * a decision — the id in the signed cookie is the thing that decides.
 */
async function origin(): Promise<{ ip: string | null; userAgent: string | null }> {
  try {
    const h = await headers();
    const fwd = h.get("x-forwarded-for");
    return {
      ip: fwd ? fwd.split(",")[0].trim() : (h.get("x-real-ip") ?? null),
      userAgent: h.get("user-agent"),
    };
  } catch {
    /* Outside a request (a script, a test). No origin is better than a wrong one. */
    return { ip: null, userAgent: null };
  }
}

/**
 * Run a change and record who made it, atomically.
 *
 * `run` receives the transaction and must do all of its database work through
 * it — work done on `db` instead escapes the transaction and can survive a
 * rollback, which quietly reintroduces the problem this closes.
 *
 * An external call that cannot be rolled back (refunding through Razorpay,
 * say) belongs OUTSIDE this, before it: do the irreversible thing first, then
 * record it together with the row it changed. That ordering can leave money
 * moved with no local record if the process dies in between, which is
 * recoverable from the provider's own ledger — the reverse ordering leaves a
 * record of a refund that never happened, which is not recoverable from
 * anything.
 */
export async function audited<T>(
  actor: Operator,
  entry: Entry,
  run: (
    tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
    /*
       For detail that is only knowable once the work has been done — which
       rows a bulk update actually settled, what a generated slug turned out
       to be. Called any number of times; each call merges into the event
       that is written when the transaction commits.
    */
    detail: (patch: Partial<Pick<Entry, "before" | "after" | "note">>) => void,
  ) => Promise<T>,
): Promise<T> {
  const { ip, userAgent } = await origin();

  return db.transaction(async (tx) => {
    let acc: Entry = { ...entry };
    const result = await run(tx, (patch) => {
      acc = {
        ...acc,
        ...patch,
        before: { ...(acc.before ?? {}), ...(patch.before ?? {}) },
        after: { ...(acc.after ?? {}), ...(patch.after ?? {}) },
      };
    });

    await tx.insert(opsEvents).values({
      actorId: actor.id,
      /* Copied, not joined: the record should read in 2027 the way it read
         the day it was written, whatever the operator's address is by then. */
      actorEmail: actor.email,
      action: acc.action,
      entity: acc.entity,
      entityId: acc.entityId,
      /* An empty object is not a change; store null so a reader can tell
         "nothing recorded here" from "recorded, and it was empty". */
      before: acc.before && Object.keys(acc.before).length > 0 ? acc.before : null,
      after: acc.after && Object.keys(acc.after).length > 0 ? acc.after : null,
      note: acc.note ?? null,
      ip,
      userAgent,
    });
    return result;
  });
}
