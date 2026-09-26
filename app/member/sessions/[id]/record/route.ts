import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { bookings, experts, intakeSubmissions } from "@/lib/db/schema";
import { readSession } from "@/lib/member-session";
import { INTAKE_RETENTION_DAYS } from "@/lib/constants";
import { istDayLabel, istTime, rupees } from "@/lib/format";

export const dynamic = "force-dynamic";

/**
 * The session record, as a file the member keeps.
 *
 * Everything this platform produces is deleted on a clock. purge-intake nulls
 * expert_note and the intake payload ninety days after the call, which is the
 * right thing to do with somebody's portfolio — but it meant the only durable
 * output of a 5,499 session evaporated, with nowhere in the console to save a
 * copy first. Retention that short is a promise to the member; it should not
 * also be a way of taking back what they bought.
 *
 * So: their copy leaves, ours still expires.
 *
 * Plain text, deliberately. A record somebody may open in five years should
 * not depend on a rendering library, a font file or a browser — and there is
 * nothing here that formatting would clarify. It is dates, figures and two
 * pieces of prose. A PDF is a later upgrade to the same route.
 */

type Holding = { label: string; pct: number };
type Intake = {
  holdings?: Holding[];
  holdingsSummary?: string;
  goals?: string;
  experienceYears?: number;
  riskComfort?: "low" | "medium" | "high";
  tradesFno?: boolean;
  questions?: string;
};

const RISK: Record<string, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

/** A heading with a rule under it, so the file has structure without markup. */
function head(title: string): string[] {
  return ["", title.toUpperCase(), "-".repeat(title.length), ""];
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const session = await readSession();
  if (!session) return new Response("Not found", { status: 404 });

  /*
     A VALID SESSION IS NOT ENOUGH FOR THIS ONE.

     Everything else behind /member is a list of your own bookings, and a
     thirty-day cookie is the right bar for that. This is the file with
     somebody's holdings in it and an expert's written opinion of them — the
     single most valuable thing the platform holds about a person, and the
     first thing worth taking.

     Signing in proves possession of a phone number. So does taking one over,
     which is neither difficult nor rare, and a stolen session stays good for
     a month. Asking for a code again costs a member fifteen seconds once in
     fifteen minutes and costs somebody holding a swapped SIM the one thing
     they were relying on: time, and the member not noticing.

     A redirect rather than a 403, because this is reached by clicking a
     download link in a browser — the member should land on the box that
     asks, not on an error telling them to find it.
  */
  if (!session.fresh) {
    const next = encodeURIComponent(`/member/sessions/${id}/record`);
    return Response.redirect(new URL(`/member/verify?next=${next}`, _req.url), 303);
  }

  const customerId = session.customerId;

  /*
   * Scoped to the signed-in member, not just to the id.
   *
   * /api/bookings/[id] is guarded by the uuid alone, which is defensible for
   * what it returns. This returns what somebody wrote about their own money,
   * so it asks who is holding the link. A booking belonging to someone else
   * is 404 rather than 403 — a 403 would confirm the id exists.
   */
  const [row] = await db
    .select({
      booking: bookings,
      expertName: experts.displayName,
      payload: intakeSubmissions.payload,
      purgedAt: intakeSubmissions.purgedAt,
    })
    .from(bookings)
    .innerJoin(experts, eq(bookings.expertId, experts.id))
    .leftJoin(intakeSubmissions, eq(intakeSubmissions.bookingId, bookings.id))
    .where(and(eq(bookings.id, id), eq(bookings.customerId, customerId)))
    .limit(1);

  if (!row) return new Response("Not found", { status: 404 });

  const b = row.booking;
  const intake = (row.payload ?? null) as Intake | null;
  const when = `${istDayLabel(b.startsAt)}, ${istTime(b.startsAt)} IST`;

  const lines: string[] = [
    "LANDLINE — SESSION RECORD",
    "=========================",
    "",
    `Expert    ${row.expertName}`,
    `When      ${when}`,
    `Status    ${b.status}`,
    `Paid      ${b.amountPaise > 0 ? rupees(b.amountPaise) : "covered by a pass or bundle"}`,
    `Reference ${b.id}`,
  ];

  lines.push(...head("What you shared before the call"));
  if (!intake) {
    lines.push(
      row.purgedAt
        ? "Deleted. Intake is removed after the call on the retention schedule below."
        : "Nothing was sent before this call.",
    );
  } else {
    if (intake.holdings?.length) {
      lines.push("Holdings");
      for (const h of intake.holdings) lines.push(`  ${h.pct}%  ${h.label}`);
      lines.push("");
    }
    if (intake.holdingsSummary) lines.push("Summary", `  ${intake.holdingsSummary}`, "");
    if (intake.goals) lines.push("Goals", `  ${intake.goals}`, "");
    const facts: string[] = [];
    if (intake.experienceYears !== undefined) facts.push(`Experience  ${intake.experienceYears} years`);
    if (intake.riskComfort) facts.push(`Risk        ${RISK[intake.riskComfort] ?? intake.riskComfort}`);
    facts.push(`F&O         ${intake.tradesFno ? "yes" : "no"}`);
    lines.push(...facts);
    if (intake.questions) lines.push("", "What you asked", `  ${intake.questions}`);
  }

  lines.push(...head(`What ${row.expertName.split(" ")[0]} wrote back`));
  lines.push(b.expertNote ?? "Nothing was written for this session.");

  lines.push(
    ...head("About this record"),
    `Landline keeps your intake and the expert's note for ${INTAKE_RETENTION_DAYS} days after`,
    "the call, then deletes both. This file is your copy and is not deleted.",
    "",
    "A Landline session is a review and a discussion of a portfolio you already",
    "hold. It is not personalised investment advice, and nothing above is a",
    "recommendation to buy or sell anything.",
    "",
    `Downloaded ${new Date().toISOString().slice(0, 10)}.`,
    "",
  );

  /* Date first so a folder of these sorts by when the call happened. */
  const stamp = b.startsAt.toISOString().slice(0, 10);
  const who = row.expertName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  const filename = `landline-${stamp}-${who}.txt`;

  return new Response(lines.join("\n"), {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
      /* Nobody's portfolio belongs in a shared cache. */
      "cache-control": "no-store, private",
    },
  });
}
