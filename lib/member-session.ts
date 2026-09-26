import { cookies, headers } from "next/headers";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { memberSessions } from "@/lib/db/schema";
import { MEMBER_COOKIE, mintSession, readSessionToken } from "@/lib/member-auth";

/**
 * Member sessions, the half that needs a database. NODE ONLY.
 *
 * lib/member-auth signs and reads the cookie and is imported by middleware,
 * so it must stay free of anything the edge runtime cannot bundle. This file
 * is where the session becomes a row: whose it is, whether it is still
 * allowed, and when its owner last actually proved who they were.
 *
 * WHAT A COOKIE PROVES, AND WHAT IT DOES NOT
 *
 * Presenting a cookie proves possession of a cookie. For looking at your own
 * bookings that is the right bar, and a thirty-day session is a kindness. For
 * reading a portfolio back out, or moving the account onto a different phone,
 * it is not: somebody who took over a number gets both, and the first thing
 * they would do with either is the thing worth stopping.
 *
 * So there are two clocks. The session expires in thirty days. `verifiedAt`
 * moves only when somebody types a code, and the sensitive screens ask how
 * long ago that was.
 */

/** How recently a code must have been typed for the sensitive screens. */
export const FRESH_MINUTES = 15;

export type MemberSession = {
  sessionId: string;
  customerId: string;
  verifiedAt: Date;
  /** Whether a code was typed recently enough for the sensitive screens. */
  fresh: boolean;
};

/**
 * Where this request came from.
 *
 * Recorded so a member can recognise their own devices, never so the server
 * can decide anything — x-forwarded-for is spoofable by anyone talking to the
 * origin directly, and a user agent is whatever the client claims. The signed
 * cookie decides; these two describe.
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
    return { ip: null, userAgent: null };
  }
}

/**
 * Open a session and return the cookie value for it.
 *
 * Called at the two doors — a code verified, a sign-in link followed — and
 * nowhere else. `verifiedAt` defaults to now because both of those ARE a
 * proof of identity; it is the passage of time afterwards that makes a
 * session stale, not the way it started.
 */
export async function startSession(
  customerId: string,
): Promise<{ value: string; expiresAt: Date }> {
  const { ip, userAgent } = await origin();
  const [row] = await db
    .insert(memberSessions)
    .values({ customerId, ip, userAgent })
    .returning({ id: memberSessions.id });

  return mintSession(row.id);
}

/**
 * The session behind the current request, or null.
 *
 * Signature first, then the row — a revoked session has a cookie that still
 * verifies perfectly, which is exactly why the row has to be read. Without
 * this lookup "sign out this device" would be a button that does nothing for
 * thirty days.
 */
export async function readSession(): Promise<MemberSession | null> {
  const token = (await cookies()).get(MEMBER_COOKIE)?.value;
  const sessionId = await readSessionToken(token);
  if (!sessionId) return null;

  const [row] = await db
    .select()
    .from(memberSessions)
    .where(eq(memberSessions.id, sessionId))
    .limit(1);

  if (!row || row.revokedAt) return null;

  /*
     Touched on read, so the list a member is shown says when each device was
     last used rather than when it first signed in. Not awaited for
     correctness — a failed touch is a stale timestamp, not a failed request.
  */
  void db
    .update(memberSessions)
    .set({ lastSeenAt: new Date() })
    .where(eq(memberSessions.id, row.id))
    .catch(() => {});

  return {
    sessionId: row.id,
    customerId: row.customerId,
    verifiedAt: row.verifiedAt,
    fresh: Date.now() - row.verifiedAt.getTime() < FRESH_MINUTES * 60_000,
  };
}

/**
 * The customer id behind the current request, or null.
 *
 * The shape every existing caller already expects, so pages and routes that
 * only need to know whose data to show did not have to change when the
 * session grew a row behind it.
 */
export async function currentCustomerId(): Promise<string | null> {
  return (await readSession())?.customerId ?? null;
}

/** Stamp identity as freshly proven. Only after a code was typed. */
export async function markVerified(sessionId: string): Promise<void> {
  await db
    .update(memberSessions)
    .set({ verifiedAt: new Date() })
    .where(eq(memberSessions.id, sessionId));
}

/** Everything this member currently has open, newest first. */
export async function activeSessions(customerId: string) {
  return db
    .select()
    .from(memberSessions)
    .where(and(eq(memberSessions.customerId, customerId), isNull(memberSessions.revokedAt)))
    .orderBy(desc(memberSessions.lastSeenAt));
}

/**
 * End one session, or all of them.
 *
 * Scoped to the customer as well as the id, so a session id belonging to
 * somebody else is a no-op rather than a way to sign strangers out.
 *
 * Revoked, not deleted: a row that says when it ended is worth keeping, and a
 * member who signs everything out because something felt wrong has just
 * created the record of what was open at the time.
 */
export async function revokeSession(customerId: string, sessionId: string): Promise<void> {
  await db
    .update(memberSessions)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(memberSessions.id, sessionId),
        eq(memberSessions.customerId, customerId),
        isNull(memberSessions.revokedAt),
      ),
    );
}

export async function revokeAllSessions(customerId: string): Promise<void> {
  await db
    .update(memberSessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(memberSessions.customerId, customerId), isNull(memberSessions.revokedAt)));
}
