import { and, desc, eq, isNull, ne } from "drizzle-orm";
import { db } from "@/lib/db";
import { bookings, intakeSubmissions } from "@/lib/db/schema";
import { verifyBookingToken } from "@/lib/tokens";
import { istDateTime } from "@/lib/format";
import SiteNav from "@/components/SiteNav";
import SiteFooter from "@/components/SiteFooter";
import IntakeForm, { type IntakeInitial } from "@/components/IntakeForm";

export const dynamic = "force-dynamic";

/**
 * The intake, with whatever the member already told us in the boxes.
 *
 * THE PAGE IS A SERVER COMPONENT NOW, and only because of one rule: the
 * prefill is somebody's holdings, so it must not be sent to a browser
 * that has not proved it owns this booking. The signed token in the URL
 * is that proof and it is checked HERE, before a single number is read
 * out of the database. A client fetch would have meant a second endpoint
 * carrying the same check written a second time.
 *
 * WHAT IT CARRIES, in order of preference:
 *
 *   1. This booking's own intake, if one has been sent. The console links
 *      "Update it" straight here, and that link used to open an empty
 *      form over an API that upserts on booking id — so pressing send
 *      replaced a finished intake with nothing.
 *   2. Otherwise the most recent intake from any of their other bookings,
 *      so a second session starts from the first rather than from blank.
 *
 * PURGED ONES ARE SKIPPED. An intake past its retention clock has
 * purgedAt set, and resurrecting it into a form would undo the deletion
 * the privacy policy promises.
 */
export default async function IntakePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ t?: string }>;
}) {
  const { id } = await params;
  const { t } = await searchParams;

  let initial: IntakeInitial | null = null;

  if (verifyBookingToken(id, t)) {
    const [booking] = await db
      .select({ customerId: bookings.customerId })
      .from(bookings)
      .where(eq(bookings.id, id))
      .limit(1);

    if (booking) {
      const [own] = await db
        .select({ payload: intakeSubmissions.payload, at: intakeSubmissions.submittedAt })
        .from(intakeSubmissions)
        .where(and(eq(intakeSubmissions.bookingId, id), isNull(intakeSubmissions.purgedAt)))
        .limit(1);

      const prior = own
        ? null
        : (
            await db
              .select({ payload: intakeSubmissions.payload, at: intakeSubmissions.submittedAt })
              .from(intakeSubmissions)
              .innerJoin(bookings, eq(bookings.id, intakeSubmissions.bookingId))
              .where(
                and(
                  eq(bookings.customerId, booking.customerId),
                  ne(intakeSubmissions.bookingId, id),
                  isNull(intakeSubmissions.purgedAt),
                ),
              )
              .orderBy(desc(intakeSubmissions.submittedAt))
              .limit(1)
          )[0];

      const found = own ?? prior;
      if (found) initial = shape(found.payload, own ? "this" : "previous", found.at);
    }
  }

  return (
    <div className="site">
      <SiteNav />
      <main id="main">
        <div className="wrap">
          <div className="doc">
            <IntakeForm id={id} initial={initial} />
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

/**
 * The stored payload is jsonb, so it is whatever was written the day it
 * was written. Every field is read defensively and a bad one becomes an
 * empty box rather than a crashed page — a form that will not load is
 * worse than a form that has lost one answer.
 */
function shape(payload: unknown, source: "this" | "previous", at: Date): IntakeInitial {
  const p = (payload ?? {}) as Record<string, unknown>;
  const str = (k: string) => (typeof p[k] === "string" ? (p[k] as string) : "");

  const holdings = Array.isArray(p.holdings)
    ? (p.holdings as unknown[])
        .map((h) => {
          const row = (h ?? {}) as { label?: unknown; pct?: unknown };
          return { label: String(row.label ?? "").trim(), pct: Number(row.pct) };
        })
        .filter((h) => h.label !== "" && Number.isFinite(h.pct))
    : [];

  const years = Number(p.experienceYears);

  return {
    holdings,
    holdingsSummary: str("holdingsSummary"),
    goals: str("goals"),
    experienceYears: Number.isFinite(years) ? years : null,
    riskComfort: str("riskComfort"),
    tradesFno: p.tradesFno === true,
    questions: str("questions"),
    source,
    when: istDateTime(at),
  };
}
