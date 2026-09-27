import { cookies, headers } from "next/headers";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { expertSessions } from "@/lib/db/schema";
import { EXPERT_COOKIE, mintExpertSession, readExpertSessionToken } from "@/lib/expert-auth";

/**
 * Expert sessions, the half that needs a database. NODE ONLY.
 *
 * lib/expert-auth signs and reads the cookie and is imported by middleware, so
 * it must stay free of anything the edge runtime cannot bundle. This is where
 * the session becomes a row: whose it is, and whether it is still allowed.
 *
 * The member side got this first and the expert side is the same change, with
 * the stronger reason. A member's session reaches their own bookings; an
 * expert's reaches other people's positions, every intake sent to them, and
 * the notes they have written about somebody's money. "Sign out" needed to
 * mean something here at least as much as it did there.
 */

export type ExpertSession = {
  sessionId: string;
  expertId: string;
};

/**
 * Where this request came from.
 *
 * Recorded so a session is recognisable, never so the server can decide
 * anything: x-forwarded-for is spoofable by anyone talking to the origin, and
 * a user agent is whatever the client claims. The signed cookie decides.
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

/** Open a session and return the cookie value for it. Called at the one door. */
export async function startExpertSession(
  expertId: string,
): Promise<{ value: string; expiresAt: Date }> {
  const { ip, userAgent } = await origin();
  const [row] = await db
    .insert(expertSessions)
    .values({ expertId, ip, userAgent })
    .returning({ id: expertSessions.id });

  return mintExpertSession(row.id);
}

/**
 * The session behind the current request, or null.
 *
 * Signature first, then the row — a revoked session has a cookie that still
 * verifies perfectly, which is exactly why the row has to be read.
 */
export async function readExpertSession(): Promise<ExpertSession | null> {
  const token = (await cookies()).get(EXPERT_COOKIE)?.value;
  const sessionId = await readExpertSessionToken(token);
  if (!sessionId) return null;

  const [row] = await db
    .select()
    .from(expertSessions)
    .where(eq(expertSessions.id, sessionId))
    .limit(1);

  if (!row || row.revokedAt) return null;

  /* Touched on read, so "last used" means what it says. Not awaited for
     correctness — a failed touch is a stale timestamp, not a failed request. */
  void db
    .update(expertSessions)
    .set({ lastSeenAt: new Date() })
    .where(eq(expertSessions.id, row.id))
    .catch(() => {});

  return { sessionId: row.id, expertId: row.expertId };
}

/**
 * The expert id behind the current request, or null.
 *
 * The shape every existing caller already expected, so the pages and routes
 * that only need to know whose data to show did not change when the session
 * grew a row behind it.
 */
export async function currentExpertId(): Promise<string | null> {
  return (await readExpertSession())?.expertId ?? null;
}

/** Everything this expert currently has open, newest first. */
export async function activeExpertSessions(expertId: string) {
  return db
    .select()
    .from(expertSessions)
    .where(and(eq(expertSessions.expertId, expertId), isNull(expertSessions.revokedAt)))
    .orderBy(desc(expertSessions.lastSeenAt));
}

/**
 * End one session.
 *
 * Scoped to the expert as well as the id, so a session id belonging to
 * somebody else is a no-op rather than a way to sign strangers out.
 */
export async function revokeExpertSession(expertId: string, sessionId: string): Promise<void> {
  await db
    .update(expertSessions)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(expertSessions.id, sessionId),
        eq(expertSessions.expertId, expertId),
        isNull(expertSessions.revokedAt),
      ),
    );
}

/** End all of them — the remedy for a machine somebody no longer has. */
export async function revokeAllExpertSessions(expertId: string): Promise<void> {
  await db
    .update(expertSessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(expertSessions.expertId, expertId), isNull(expertSessions.revokedAt)));
}
