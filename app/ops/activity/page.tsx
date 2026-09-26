import type { Metadata } from "next";
import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { opsEvents } from "@/lib/db/schema";
import { istDateTime, rupees } from "@/lib/format";

export const metadata: Metadata = { title: "Activity — Landline ops", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * Who did what, most recent first.
 *
 * The console could always tell you a booking was refunded. It could not tell
 * you who refunded it, and that is the question that gets asked — by an expert
 * who says they were not paid, by a customer disputing a charge, by a
 * regulator asking who approved an adviser. This page is the answer to all
 * three, and it is the reason the rest of this change exists.
 *
 * Read-only, with no controls at all. Nothing here can be edited from the
 * application, and the database refuses an UPDATE or DELETE on this table
 * outright — a history somebody can tidy up answers "who did it" with
 * "whoever tidied it last".
 */

/** A sentence, rather than a row of raw columns. */
function describe(e: typeof opsEvents.$inferSelect): string {
  const before = (e.before ?? {}) as Record<string, unknown>;
  const after = (e.after ?? {}) as Record<string, unknown>;

  switch (e.action) {
    case "booking.complete":
      return "marked a session complete";
    case "booking.cancel":
      return "cancelled a session";
    case "booking.refund":
      return `refunded ${typeof after.amountPaise === "number" ? rupees(after.amountPaise) : "a session"}`;
    case "expert.status":
      return `set ${after.displayName ?? "an expert"} to ${after.status}`;
    case "expert.price":
      return `changed ${after.displayName ?? "an expert"}'s price from ${
        typeof before.pricePaise === "number" ? rupees(before.pricePaise) : "—"
      } to ${typeof after.pricePaise === "number" ? rupees(after.pricePaise) : "—"}`;
    case "application.approve":
      return `approved ${before.applicantName ?? "an applicant"} as an expert`;
    case "application.reject":
      return `rejected ${before.applicantName ?? "an applicant"}`;
    case "payout.paid":
      return `marked ${
        typeof after.settledCount === "number" ? `${after.settledCount} payout(s)` : "payouts"
      } paid${typeof after.settledPaise === "number" ? `, ${rupees(after.settledPaise)}` : ""}`;
    default:
      return e.action;
  }
}

/** Where the entity lives, when there is somewhere to go. */
function linkFor(e: typeof opsEvents.$inferSelect): string | null {
  switch (e.entity) {
    case "booking":
      return `/ops/bookings/${e.entityId}`;
    case "expert":
      return "/ops/experts";
    case "application":
      return "/ops/applications";
    case "payout":
      return "/ops/payouts";
    default:
      return null;
  }
}

export default async function OpsActivity({
  searchParams,
}: {
  searchParams: Promise<{ entity?: string; id?: string }>;
}) {
  const { entity, id } = await searchParams;

  const rows = await db
    .select()
    .from(opsEvents)
    .where(entity && id ? eq(opsEvents.entityId, id) : undefined)
    .orderBy(desc(opsEvents.at))
    .limit(200);

  return (
    <>
      <h1 className="ops-h1">Activity</h1>
      <p className="ops-sub">
        Every change made from this console, and who made it. Append-only — nothing here can be
        edited or removed, including by us.
        {entity && id ? (
          <>
            {" "}
            Showing one {entity}. <Link href="/ops/activity">Show everything</Link>.
          </>
        ) : null}
      </p>

      {rows.length === 0 ? (
        <p className="ops-empty">
          Nothing recorded yet. Events start the first time somebody changes something here.
        </p>
      ) : (
        <ul className="ops-feed">
          {rows.map((e) => {
            const href = linkFor(e);
            return (
              <li key={e.id} className="ops-feed-row">
                <div className="ops-feed-main">
                  <span className="ops-feed-who">{e.actorEmail}</span>{" "}
                  <span className="ops-feed-what">{describe(e)}</span>
                  {href ? (
                    <>
                      {" "}
                      <Link className="ops-link" href={href}>
                        open
                      </Link>
                    </>
                  ) : null}
                  {e.note ? <p className="ops-feed-note">{e.note}</p> : null}
                </div>
                <div className="ops-feed-meta">
                  <span>{istDateTime(e.at)} IST</span>
                  {/* An IP is a hint, not a person. Shown small, and never
                      used to decide anything — the id in the signed cookie
                      is what decided. */}
                  {e.ip ? <span className="ops-feed-ip">{e.ip}</span> : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
