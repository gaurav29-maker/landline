import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  bookings,
  bundles,
  consents,
  customers,
  experts,
  intakeSubmissions,
  memberSessions,
  memberships,
  notifications,
} from "@/lib/db/schema";
import { readSession } from "@/lib/member-session";
import { INTAKE_RETENTION_DAYS } from "@/lib/constants";
import { istDateTime, rupees } from "@/lib/format";

export const dynamic = "force-dynamic";

/**
 * Everything we hold about you, as a file.
 *
 * WHY THIS EXISTS. app/legal/privacy section 6 promises, under the
 * Digital Personal Data Protection Act 2023, that a member can ask us to
 * "tell you what we hold about you and who we have shared it with". The
 * only route it offered was "write to [grievance contact]" — a
 * placeholder that has never been filled in. So the site published a
 * right and shipped no way to exercise it. This is the way.
 *
 * IT ANSWERS BOTH HALVES. Most exports answer "what do you hold" and
 * quietly skip "who have you shared it with", which is the half a person
 * is usually more worried about. The recipients section is written from
 * the same privacy policy, and it names what each one gets rather than
 * listing logos.
 *
 * SAME BAR AS THE RECORD DOWNLOAD. A thirty-day cookie is right for
 * looking at your own bookings. It is not right for a single file
 * containing every holding you have ever declared, your IP addresses and
 * every device you have signed in from — which is the most concentrated
 * thing this platform could hand to somebody holding a swapped SIM. It
 * asks for a code again.
 *
 * PLAIN TEXT, for the reason the record is: a file somebody may open in
 * five years should not need a rendering library, and nothing here would
 * be clearer with formatting.
 *
 * WHAT IS DELIBERATELY NOT IN IT. Sign-in codes are hashed, single-use
 * and deleted after they are spent; printing them would be writing
 * credentials into a file people email to themselves. The section on
 * what we do not hold is there because "we have no record of your broker
 * login" is itself an answer to "what do you hold about me".
 */

function head(title: string): string[] {
  return ["", title.toUpperCase(), "-".repeat(title.length), ""];
}

const NONE = "  (none)";

export async function GET(req: Request) {
  const session = await readSession();
  if (!session) return new Response("Not found", { status: 404 });

  if (!session.fresh) {
    return Response.redirect(
      new URL(`/member/verify?next=${encodeURIComponent("/member/data")}`, req.url),
      303,
    );
  }

  const customerId = session.customerId;

  const [me] = await db.select().from(customers).where(eq(customers.id, customerId)).limit(1);
  if (!me) return new Response("Not found", { status: 404 });

  const myBookings = await db
    .select({
      id: bookings.id,
      startsAt: bookings.startsAt,
      status: bookings.status,
      amountPaise: bookings.amountPaise,
      meetingUrl: bookings.meetingUrl,
      expertNote: bookings.expertNote,
      expertNoteAt: bookings.expertNoteAt,
      cancelledReason: bookings.cancelledReason,
      expertName: experts.displayName,
    })
    .from(bookings)
    .innerJoin(experts, eq(experts.id, bookings.expertId))
    .where(eq(bookings.customerId, customerId))
    .orderBy(asc(bookings.startsAt));

  const ids = myBookings.map((b) => b.id);

  const intakes = ids.length
    ? await db.select().from(intakeSubmissions).where(inArray(intakeSubmissions.bookingId, ids))
    : [];
  const sent = ids.length
    ? await db
        .select()
        .from(notifications)
        .where(inArray(notifications.bookingId, ids))
        .orderBy(asc(notifications.sentAt))
    : [];
  const agreed = ids.length
    ? await db.select().from(consents).where(inArray(consents.bookingId, ids))
    : [];

  const passes = await db
    .select()
    .from(memberships)
    .where(eq(memberships.customerId, customerId))
    .orderBy(asc(memberships.startsAt));

  const myBundles = await db
    .select()
    .from(bundles)
    .where(eq(bundles.customerId, customerId))
    .orderBy(asc(bundles.createdAt));

  const devices = await db
    .select()
    .from(memberSessions)
    .where(and(eq(memberSessions.customerId, customerId)))
    .orderBy(desc(memberSessions.lastSeenAt));

  const L: string[] = [
    "LANDLINE — EVERYTHING WE HOLD ABOUT YOU",
    "=======================================",
    "",
    `Produced ${istDateTime(new Date())} IST, for ${me.email}.`,
    "",
    "This is your personal data, given under section 6 of the Digital",
    "Personal Data Protection Act 2023. It is current as of the moment",
    "this file was produced and is not updated afterwards.",
  ];

  L.push(...head("Who you are"));
  L.push(
    `  Name        ${me.name}`,
    `  Email       ${me.email}`,
    `  Phone       ${me.phone ?? "(none on file)"}`,
    `  Account id  ${me.id}`,
    `  Joined      ${istDateTime(me.createdAt)} IST`,
  );

  L.push(...head("What you have booked"));
  if (!myBookings.length) L.push(NONE);
  for (const b of myBookings) {
    L.push(`  ${istDateTime(b.startsAt)} IST — ${b.expertName} — ${b.status}`);
    L.push(`    Paid        ${rupees(b.amountPaise)}`);
    if (b.meetingUrl) L.push(`    Meeting     ${b.meetingUrl}`);
    if (b.cancelledReason) L.push(`    Cancelled   ${b.cancelledReason}`);
    L.push(`    Booking id  ${b.id}`);
    L.push("");
  }

  L.push(...head("What you told us before each call"));
  if (!intakes.length) L.push(NONE);
  for (const i of intakes) {
    const b = myBookings.find((x) => x.id === i.bookingId);
    const when = b ? `${istDateTime(b.startsAt)} IST` : i.bookingId;
    if (i.purgedAt) {
      L.push(`  ${when} — deleted ${istDateTime(i.purgedAt)} IST on the retention clock.`);
      L.push("");
      continue;
    }
    L.push(`  ${when} — sent ${istDateTime(i.submittedAt)} IST`);
    for (const line of JSON.stringify(i.payload, null, 2).split("\n")) L.push(`    ${line}`);
    L.push("");
  }

  L.push(...head("What your expert wrote back"));
  const notes = myBookings.filter((b) => b.expertNote);
  if (!notes.length) L.push(NONE);
  for (const b of notes) {
    L.push(
      `  ${istDateTime(b.startsAt)} IST — ${b.expertName}` +
        (b.expertNoteAt ? `, written ${istDateTime(b.expertNoteAt)} IST` : ""),
    );
    L.push(`    ${b.expertNote}`, "");
  }

  L.push(...head("What you have bought beyond single calls"));
  if (!passes.length && !myBundles.length) L.push(NONE);
  for (const p of passes) {
    L.push(
      `  Pass — ${p.tier}, ${rupees(p.amountPaise)}, ${istDateTime(p.startsAt)} to ` +
        `${istDateTime(p.endsAt)} IST, ${p.status}`,
    );
  }
  for (const b of myBundles) {
    L.push(
      `  Bundle — ${b.creditsUsed} of ${b.creditsTotal} used, ${rupees(b.amountPaise)}, ` +
        `expires ${istDateTime(b.expiresAt)} IST, ${b.status}`,
    );
  }

  L.push(...head("Where you are signed in"));
  if (!devices.length) L.push(NONE);
  for (const d of devices) {
    L.push(
      `  ${d.revokedAt ? "Signed out" : "Active"} — last seen ${istDateTime(d.lastSeenAt)} IST`,
    );
    L.push(`    IP address  ${d.ip ?? "(not recorded)"}`);
    L.push(`    Browser     ${(d.userAgent ?? "(not recorded)").slice(0, 120)}`);
    L.push("");
  }

  L.push(...head("What we have sent you"));
  if (!sent.length) L.push(NONE);
  for (const n of sent) {
    L.push(`  ${istDateTime(n.sentAt)} IST — ${n.kind}`);
  }

  L.push(...head("What you agreed to"));
  if (!agreed.length) L.push(NONE);
  for (const c of agreed) {
    L.push(`  ${istDateTime(c.acceptedAt)} IST — disclaimer version ${c.disclaimerVersion}`);
    L.push(`    From IP     ${c.ip ?? "(not recorded)"}`);
    L.push("");
  }

  /*
     The half most exports leave out. Written from the same list as
     app/legal/privacy section 5, and it says what each one receives
     rather than naming a company and leaving the reader to guess.
  */
  L.push(...head("Who we have shared it with"));
  L.push(
    "  Your expert",
    "    Everything in the intake above, for the call it belongs to. They",
    "    do not see your other sessions or anything you told a different",
    "    expert.",
    "",
    "  Razorpay, to take the payment",
    "    Your name, email and phone, and the amount. They never send us a",
    "    card number and we never hold one.",
    "",
    "  Resend, to deliver email",
    "    Your email address and the contents of the messages listed above.",
    "",
    "  Vercel and our database host, who run the site",
    "    Everything in this file, because it is stored on their",
    "    infrastructure. They do not use it for anything of their own.",
    "",
    "  Nobody else. We do not sell this, and there is no advertising or",
    "  analytics product on this site to sell it to.",
  );

  L.push(...head("What we do not hold"));
  L.push(
    "  No broker or demat login. There is no field anywhere on Landline",
    "  that accepts one, so there is nothing to lose.",
    "  No card or bank details. Razorpay holds those; we never see them.",
    "  No tracking or advertising profile. There is no analytics on this",
    "  site, so there is no behavioural record of you to export.",
  );

  L.push(...head("How long we keep it"));
  L.push(
    `  Your intake and your expert's note are deleted ${INTAKE_RETENTION_DAYS} days after`,
    "  the call. Anything above marked deleted has already gone.",
    "  Booking and payment records are kept as long as tax and accounting",
    "  law requires.",
    "  To correct anything, use Your details in the console. To ask for",
    "  erasure, see the privacy policy at /legal/privacy.",
    "",
  );

  return new Response(L.join("\n"), {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "content-disposition": `attachment; filename="landline-your-data-${new Date()
        .toISOString()
        .slice(0, 10)}.txt"`,
      /*
         Never cached, anywhere. This is the single most sensitive
         response the site produces and it is per-person by definition.
      */
      "cache-control": "no-store, max-age=0",
    },
  });
}
