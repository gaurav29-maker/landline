import type { Metadata } from "next";
import Link from "next/link";
import { and, desc, eq, gte } from "drizzle-orm";
import { db } from "@/lib/db";
import { bookings, customers, experts, supportMessages } from "@/lib/db/schema";
import { currentCustomerId, readSession } from "@/lib/member-session";
import { CONTACT_EMAIL } from "@/lib/constants";
import { istDateTime } from "@/lib/format";
import { sendRaw } from "@/lib/email";
import { FREE_CANCEL_HOURS, LATE_CANCEL_HOURS } from "@/lib/cancellation";
import { rethrowIfNavigation } from "@/lib/nav";
import { redirect } from "next/navigation";
import MemberBar from "@/components/MemberBar";

export const metadata: Metadata = { title: "Help — Landline", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * Somewhere to write to.
 *
 * THE HOLE. The console had no contact surface anywhere in it. A member whose
 * expert did not join the call had the address in the site footer and nothing
 * else — no booking reference to quote, no way to know the message had
 * arrived, and no answer at all to the one question they actually have, which
 * is "is somebody going to fix this".
 *
 * THE ADDRESS IS WRITTEN OUT, not hidden behind a mailto. A mailto does
 * nothing on a machine with no mail client configured, and on a phone it can
 * open an account the member does not use. The link is a convenience; the
 * address beside it is the thing that always works.
 *
 * THE FORM STORES BEFORE IT SENDS. RESEND_API_KEY is not set, so every
 * outbound email throws today. A form that only emailed would lose every
 * message written before that key lands, which is precisely the period when
 * things are most likely to go wrong. The row is written first and the send
 * is allowed to fail.
 *
 * AND IT ANSWERS THE COMMON ONES IN PLACE. Most of what somebody would write
 * about — moving a session, cancelling, what a refund will be — is already a
 * button two pages away, and a support queue is a worse way to reach it than
 * a link. The questions below are the ones the console can answer itself.
 */
export default async function Help({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; error?: string; booking?: string }>;
}) {
  const { sent, error, booking } = await searchParams;

  const customerId = await currentCustomerId();
  if (!customerId) redirect("/member/login");

  let customer;
  let upcoming: { id: string; startsAt: Date; expertName: string }[] = [];
  try {
    [customer] = await db.select().from(customers).where(eq(customers.id, customerId)).limit(1);
    if (!customer) redirect("/member/login");

    upcoming = await db
      .select({
        id: bookings.id,
        startsAt: bookings.startsAt,
        expertName: experts.displayName,
      })
      .from(bookings)
      .innerJoin(experts, eq(experts.id, bookings.expertId))
      .where(
        and(
          eq(bookings.customerId, customerId),
          eq(bookings.status, "confirmed"),
          gte(bookings.startsAt, new Date()),
        ),
      )
      .orderBy(bookings.startsAt);
  } catch (err) {
    rethrowIfNavigation(err);
    return (
      <div className="wrap bp-page member">
        <div className="bp-panel">
          <h1>Not available right now</h1>
          <p className="bp-muted">
            We could not reach your account. The address below still works:{" "}
            <b>{CONTACT_EMAIL}</b>.
          </p>
        </div>
      </div>
    );
  }

  async function send(formData: FormData) {
    "use server";

    const session = await readSession();
    if (!session) redirect("/member/login");

    const body = String(formData.get("body") ?? "").trim();
    /* Long enough to say something, short enough not to be a paste bomb. */
    if (body.length < 10 || body.length > 4000) redirect("/member/help?error=body");

    const rawTopic = String(formData.get("topic") ?? "other");
    const topic = (["session", "payment", "account", "other"] as const).includes(
      rawTopic as "session",
    )
      ? (rawTopic as "session" | "payment" | "account" | "other")
      : "other";

    /*
       The booking is checked against this member rather than trusted from the
       form, so a posted id cannot attach a message to somebody else's
       session.
    */
    const wanted = String(formData.get("bookingId") ?? "");
    let bookingId: string | null = null;
    if (wanted) {
      const [own] = await db
        .select({ id: bookings.id })
        .from(bookings)
        .where(and(eq(bookings.id, wanted), eq(bookings.customerId, session.customerId)))
        .limit(1);
      bookingId = own?.id ?? null;
    }

    /* Stored first. See the note at the top of this file. */
    const [saved] = await db
      .insert(supportMessages)
      .values({ customerId: session.customerId, bookingId, topic, body })
      .returning({ id: supportMessages.id });

    const [me] = await db
      .select({ name: customers.name, email: customers.email })
      .from(customers)
      .where(eq(customers.id, session.customerId))
      .limit(1);

    try {
      await sendRaw({
        to: CONTACT_EMAIL,
        subject: `[${topic}] ${me?.name ?? "A member"} wrote in`,
        html:
          `<p><b>${me?.name ?? "Unknown"}</b> &lt;${me?.email ?? "unknown"}&gt;</p>` +
          (bookingId ? `<p>About booking <code>${bookingId}</code></p>` : "") +
          `<p style="white-space:pre-wrap">${body.replace(/</g, "&lt;")}</p>`,
      });
      await db
        .update(supportMessages)
        .set({ emailed: true })
        .where(eq(supportMessages.id, saved.id));
    } catch (err) {
      /* The message is already saved; the copy to the inbox is the optional
         half. Logged rather than shown, because the member has been heard. */
      console.error("[support] copy to inbox failed", err);
    }

    redirect("/member/help?sent=1");
  }

  const recent = await db
    .select({
      id: supportMessages.id,
      topic: supportMessages.topic,
      createdAt: supportMessages.createdAt,
      handledAt: supportMessages.handledAt,
    })
    .from(supportMessages)
    .where(eq(supportMessages.customerId, customerId))
    .orderBy(desc(supportMessages.createdAt))
    .limit(5);

  return (
    <div className="wrap bp-page member help-page">
      <MemberBar name={customer.name} current="help" />

      <p className="ops-crumb">
        <Link href="/member" className="ops-link">
          ← Your console
        </Link>
      </p>

      <h1 className="ops-h1">Help</h1>
      <p className="bp-muted ops-lede">
        Most things are faster to do yourself. If yours is not one of them, write to us below and
        a person will read it.
      </p>

      {sent ? (
        <p className="member-done">
          Sent. We have it, and we will reply to {customer.email}.
        </p>
      ) : null}
      {error === "body" ? (
        <p className="bp-error">
          Tell us a little more than that — between 10 and 4,000 characters.
        </p>
      ) : null}

      {/*
        The self-serve answers first, because a support queue is a worse way
        to reach a button than the button is.
      */}
      <section className="member-section">
        <div className="bp-panel">
          <h2 className="member-h2">You can do these yourself</h2>
          <ul className="help-list">
            <li>
              <b>Move or cancel a session.</b> Open it from{" "}
              <Link href="/member" className="ops-link">
                your console
              </Link>
              . Moving is free once. Cancelling is a full refund up to {FREE_CANCEL_HOURS} hours
              before; inside {LATE_CANCEL_HOURS} hours it cannot be cancelled.
            </li>
            <li>
              <b>No joining link on a session.</b> Your expert adds it before the call and it
              appears on your console. If it is still missing an hour before, write to us — that
              one we want to hear about immediately.
            </li>
            <li>
              <b>Change your number, email or name.</b>{" "}
              <Link href="/member/profile" className="ops-link">
                Your details
              </Link>
              .
            </li>
            <li>
              <b>A receipt.</b>{" "}
              <Link href="/member/receipts" className="ops-link">
                Receipts
              </Link>{" "}
              has every payment.
            </li>
            <li>
              <b>Everything we hold about you, or deleting your account.</b> Both are on{" "}
              <Link href="/member/profile" className="ops-link">
                Your details
              </Link>
              , and neither needs to go through us.
            </li>
          </ul>
        </div>
      </section>

      <section className="member-section">
        <form action={send} className="bp-panel">
          <h2 className="member-h2">Write to us</h2>
          <p className="bp-muted" style={{ marginBottom: 14 }}>
            We know who you are from this session, so there is nothing to fill in but the
            message. The reply goes to <b>{customer.email}</b>.
          </p>

          <label className="bp-field">
            <span>What is it about</span>
            <select name="topic" defaultValue="session">
              <option value="session">A session</option>
              <option value="payment">A payment or refund</option>
              <option value="account">My account</option>
              <option value="other">Something else</option>
            </select>
          </label>

          {upcoming.length > 0 ? (
            <label className="bp-field">
              <span>Which session, if it is about one</span>
              <select name="bookingId" defaultValue={booking ?? ""}>
                <option value="">Not about a particular session</option>
                {upcoming.map((b) => (
                  <option key={b.id} value={b.id}>
                    {istDateTime(b.startsAt)} IST — {b.expertName}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <label className="bp-field">
            <span>Message</span>
            <textarea
              name="body"
              rows={6}
              required
              minLength={10}
              maxLength={4000}
              placeholder="What happened, and what you need."
            />
          </label>

          <button className="btn-primary" type="submit">
            Send
          </button>
        </form>
      </section>

      {recent.length > 0 ? (
        <section className="member-section">
          <div className="bp-panel">
            <h2 className="member-h2">What you have sent</h2>
            <ul className="help-sent">
              {recent.map((m) => (
                <li key={m.id}>
                  <span>
                    {istDateTime(m.createdAt)} IST — {m.topic}
                  </span>
                  <span className={m.handledAt ? "pill ok" : "pill warn"}>
                    {m.handledAt ? "answered" : "with us"}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      {/*
        Written out as text, not only as a link. A mailto does nothing on a
        machine with no mail client, and on a phone it can open an account the
        member does not use.
      */}
      <section className="member-section">
        <p className="bp-muted">
          You can also write directly to <b>{CONTACT_EMAIL}</b>. Quote the date of the session
          and we will find it.
        </p>
      </section>
    </div>
  );
}
