import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { bookings, portfolioSnapshots } from "@/lib/db/schema";
import type { Holding } from "@/lib/record";

/**
 * The member's portfolio: what they say they hold, and who may look at it.
 *
 * THE ACCESS RULE IS THE IMPORTANT PART of this file. A portfolio is the most
 * sensitive thing on the platform, and the answer to "which expert may see
 * it" is exactly one rule: an expert may read it if that member has a booking
 * with THEM that is live or has happened. Not a cancelled one, not an
 * expired hold, and never another expert's customer. It is enforced in
 * `visibleToExpert` and nowhere else, so there is one place to get it right
 * and one place to check.
 *
 * WHAT IS DELIBERATELY ABSENT: anything that accepts a broker login. The
 * holdings are typed by the member in their own words, the same promise the
 * FAQ and the principles page have always made. There is no field here for a
 * credential and no import from anywhere.
 */

export type Portfolio = {
  holdings: Holding[];
  note: string;
  capturedAt: Date;
};

/** Percentages are the member's own estimate, so they are read defensively. */
export function readHoldings(raw: unknown): Holding[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((h) => ({
      label: String((h as Holding)?.label ?? "").trim().slice(0, 80),
      pct: Number((h as Holding)?.pct),
    }))
    .filter((h) => h.label !== "" && Number.isFinite(h.pct) && h.pct >= 0 && h.pct <= 100);
}

/**
 * What the member holds right now, or null.
 *
 * The latest snapshot that has not been cleared. A cleared one is a real
 * entry in the series — it records that they emptied it — so it ends the
 * current portfolio without removing the history.
 */
export async function currentPortfolio(customerId: string): Promise<Portfolio | null> {
  const [row] = await db
    .select({
      holdings: portfolioSnapshots.holdings,
      note: portfolioSnapshots.note,
      capturedAt: portfolioSnapshots.capturedAt,
      clearedAt: portfolioSnapshots.clearedAt,
    })
    .from(portfolioSnapshots)
    .where(eq(portfolioSnapshots.customerId, customerId))
    .orderBy(desc(portfolioSnapshots.capturedAt))
    .limit(1);

  if (!row || row.clearedAt) return null;

  const holdings = readHoldings(row.holdings);
  if (holdings.length === 0 && !row.note) return null;

  return { holdings, note: row.note ?? "", capturedAt: row.capturedAt };
}

/**
 * Keep a new version.
 *
 * A new row every time rather than an update in place: the series is the
 * point. Somebody correcting a typo adds a near-identical entry, which costs
 * a row and keeps the guarantee that no earlier declaration is ever rewritten.
 */
export async function savePortfolio(
  customerId: string,
  holdings: Holding[],
  note: string,
): Promise<void> {
  await db.insert(portfolioSnapshots).values({
    customerId,
    holdings: readHoldings(holdings),
    note: note.trim() === "" ? null : note.trim().slice(0, 2000),
  });
}

/** Empty it, without erasing that it was once kept. */
export async function clearPortfolio(customerId: string): Promise<void> {
  await db.insert(portfolioSnapshots).values({
    customerId,
    holdings: [],
    note: null,
    clearedAt: new Date(),
  });
}

/**
 * May this expert see this member's portfolio?
 *
 * One rule, server-side, and the only thing that decides. A booking that is
 * held but unpaid does not count: a hold is ten minutes of somebody's
 * intention, and it would let anybody with a slot read a stranger's
 * positions. Cancelled and expired do not count either. What remains is a
 * session that is going to happen or did.
 */
export async function visibleToExpert(
  expertId: string,
  customerId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(bookings)
    .where(
      and(
        eq(bookings.expertId, expertId),
        eq(bookings.customerId, customerId),
        inArray(bookings.status, ["confirmed", "completed"]),
      ),
    );
  return (row?.n ?? 0) > 0;
}

/**
 * The portfolio as an expert sees it, or null if they may not.
 *
 * The check and the read are one call on purpose. Two calls is two places for
 * a caller to use the second without the first, and the thing being guarded
 * is somebody's entire financial position.
 */
export async function portfolioForExpert(
  expertId: string,
  customerId: string,
): Promise<Portfolio | null> {
  if (!(await visibleToExpert(expertId, customerId))) return null;
  return currentPortfolio(customerId);
}

/**
 * Every version, oldest first, for The Log.
 *
 * Cleared entries are left out: they say "there is nothing here now", which
 * is not a position to plot against.
 */
export async function portfolioSeries(customerId: string): Promise<Portfolio[]> {
  const rows = await db
    .select({
      holdings: portfolioSnapshots.holdings,
      note: portfolioSnapshots.note,
      capturedAt: portfolioSnapshots.capturedAt,
    })
    .from(portfolioSnapshots)
    .where(
      and(
        eq(portfolioSnapshots.customerId, customerId),
        isNull(portfolioSnapshots.clearedAt),
      ),
    )
    .orderBy(portfolioSnapshots.capturedAt);

  return rows
    .map((r) => ({
      holdings: readHoldings(r.holdings),
      note: r.note ?? "",
      capturedAt: r.capturedAt,
    }))
    .filter((p) => p.holdings.length > 0);
}
