import { and, eq, gte, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  accountDeletions,
  bookings,
  bundles,
  consents,
  customers,
  intakeSubmissions,
  memberSessions,
  memberships,
  payments,
  signInCodes,
} from "@/lib/db/schema";
import { FINANCIAL_RECORD_RETENTION_YEARS } from "@/lib/constants";

/**
 * Erasing an account, which is not the same as deleting a row.
 *
 * `delete from customers` does not work and should not. Four tables point at
 * that row without `on delete cascade` — bookings, bundles, memberships and,
 * through bookings, payments — so Postgres refuses, and the refusal is
 * correct: those rows are the financial record. Tax law requires them, the
 * expert's earnings are computed from them, and a deleted customer id would
 * leave a payment belonging to nobody.
 *
 * So erasure here means: destroy everything that identifies a person or
 * describes their portfolio, and keep the money rows with the person taken
 * out of them. The customer row survives as a tombstone that exists only to
 * be a valid foreign key.
 *
 * THE LINE BETWEEN THE TWO is drawn field by field below, and the test
 * applied to each one was: would this, alone or next to the rest of what
 * stays, tell a stranger who this was or what they owned? `payer_method` says
 * "upi" and stays. `payer_contact` is a phone number and goes. `raw` is the
 * whole Razorpay payload, with the name, email and contact inside it — that
 * one took the longest to notice and is the most important thing this
 * function does.
 *
 * WHAT IT WILL NOT DO is erase around a session that is still going to
 * happen. See `erasurePreview`.
 */

export type Blocker = {
  kind: "upcoming";
  /** What to say, in the member's terms. */
  what: string;
  /** Where they can resolve it themselves. */
  fix: string;
};

export type Forfeit = {
  /** Something they paid for that erasure throws away. */
  what: string;
};

export type ErasurePreview = {
  blockers: Blocker[];
  forfeits: Forfeit[];
  /** Financial rows that will survive, and the date they may go. */
  bookingsKept: number;
  keptUntil: Date;
};

/** The date the last surviving financial row may be deleted. */
export function keptUntil(from: Date = new Date()): Date {
  const d = new Date(from);
  d.setUTCFullYear(d.getUTCFullYear() + FINANCIAL_RECORD_RETENTION_YEARS);
  return d;
}

/**
 * What stops this, and what it costs, before anything is destroyed.
 *
 * BLOCKERS ARE A REFUSAL, and there is exactly one: a session that has not
 * happened yet. An expert has that slot held and is expecting a named person
 * to join a call about a portfolio they have read. Erasing the member out
 * from under that would leave the expert with an appointment against a
 * tombstone, and it would quietly become a way around the cancellation
 * policy — delete the account, keep the fee that a cancellation inside 24
 * hours would have forfeited. Refusing is not a limit on the right: the
 * member can cancel the session themselves, under the policy they agreed to,
 * and then erase. The fix is in their hands, which is the test of whether a
 * refusal is fair.
 *
 * FORFEITS ARE NOT A REFUSAL. Unspent bundle credits and the remaining days
 * on a pass are money they will not get back, and that is their decision to
 * make rather than ours to overrule — the DPDP Act does not let a business
 * hold somebody's data hostage to the balance on their account. So they are
 * shown, plainly, and they do not block.
 */
export async function erasurePreview(customerId: string): Promise<ErasurePreview> {
  const now = new Date();

  const soon = await db
    .select({ startsAt: bookings.startsAt, status: bookings.status })
    .from(bookings)
    .where(
      and(
        eq(bookings.customerId, customerId),
        inArray(bookings.status, ["held", "confirmed"]),
        gte(bookings.startsAt, now),
      ),
    )
    .orderBy(bookings.startsAt);

  const blockers: Blocker[] = [];
  if (soon.length > 0) {
    const held = soon.filter((b) => b.status === "held").length;
    const confirmed = soon.length - held;

    if (confirmed > 0) {
      blockers.push({
        kind: "upcoming",
        what:
          confirmed === 1
            ? "You have a session booked that has not happened yet."
            : `You have ${confirmed} sessions booked that have not happened yet.`,
        fix: "Cancel it from your console first. What you get back depends on how close the session is, and it is the same either way — deleting your account is not a way around the cancellation policy.",
      });
    }

    if (held > 0) {
      blockers.push({
        kind: "upcoming",
        what: "A slot is being held for you while a payment finishes.",
        fix: "A hold releases itself within about ten minutes if the payment does not complete. Try again shortly.",
      });
    }
  }

  const forfeits: Forfeit[] = [];

  const liveBundles = await db
    .select({
      creditsTotal: bundles.creditsTotal,
      creditsUsed: bundles.creditsUsed,
    })
    .from(bundles)
    .where(and(eq(bundles.customerId, customerId), eq(bundles.status, "active")));

  const credits = liveBundles.reduce((n, b) => n + Math.max(0, b.creditsTotal - b.creditsUsed), 0);
  if (credits > 0) {
    forfeits.push({
      what:
        credits === 1
          ? "One unused call on a bundle you have paid for."
          : `${credits} unused calls on a bundle you have paid for.`,
    });
  }

  const [pass] = await db
    .select({ endsAt: memberships.endsAt, tier: memberships.tier })
    .from(memberships)
    .where(
      and(
        eq(memberships.customerId, customerId),
        eq(memberships.status, "active"),
        gte(memberships.endsAt, now),
      ),
    )
    .orderBy(memberships.endsAt)
    .limit(1);

  if (pass) {
    const days = Math.max(
      0,
      Math.ceil((pass.endsAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)),
    );
    forfeits.push({
      what: `${days} day${days === 1 ? "" : "s"} remaining on your ${pass.tier} pass.`,
    });
  }

  const [counted] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(bookings)
    .where(eq(bookings.customerId, customerId));

  return {
    blockers,
    forfeits,
    bookingsKept: counted?.n ?? 0,
    keptUntil: keptUntil(now),
  };
}

export type ErasureReceipt = {
  intakesErased: number;
  notesErased: number;
  paymentsRedacted: number;
  sessionsEnded: number;
  bookingsKept: number;
  keptUntil: Date;
};

export type ErasureResult =
  | { ok: true; receipt: ErasureReceipt }
  | { ok: false; blockers: Blocker[] };

/**
 * Do it, in one transaction, or do none of it.
 *
 * The transaction is not decoration. A half-erased account is the worst
 * outcome available: the member has been told their data is gone, the
 * portfolio detail is still sitting in intake_submissions, and nothing on any
 * screen says so. Either every statement below commits or the account is
 * untouched and the member sees an error they can act on.
 *
 * It re-checks the refusal INSIDE the transaction. The page the member read
 * was rendered seconds earlier on a different request, and a confirmed
 * booking can land in between — a Razorpay webhook does not wait for somebody
 * to finish reading a deletion page.
 */
export async function eraseAccount(
  customerId: string,
  requestedBy: "member" | "operator" = "member",
): Promise<ErasureResult> {
  const pre = await erasurePreview(customerId);
  if (pre.blockers.length > 0) return { ok: false, blockers: pre.blockers };

  const now = new Date();
  const until = keptUntil(now);

  return db.transaction(async (tx): Promise<ErasureResult> => {
    /*
       The raced check. Held slots are allowed to lose here rather than block
       a second time: the hold releases itself and no money has moved.
    */
    const [live] = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(bookings)
      .where(
        and(
          eq(bookings.customerId, customerId),
          eq(bookings.status, "confirmed"),
          gte(bookings.startsAt, now),
        ),
      );

    if ((live?.n ?? 0) > 0) {
      return {
        ok: false,
        blockers: [
          {
            kind: "upcoming",
            what: "A session was confirmed while you were on this page.",
            fix: "Open your console, cancel it, and come back. Nothing has been deleted.",
          },
        ],
      };
    }

    const mine = await tx
      .select({ id: bookings.id })
      .from(bookings)
      .where(eq(bookings.customerId, customerId));
    const bookingIds = mine.map((b) => b.id);

    /*
       THE PORTFOLIO GOES FIRST, because it is the thing that matters most and
       the thing a partial failure must not leave behind. Same shape as the
       90-day retention cron: the payload is emptied and purgedAt is stamped,
       so every reader that already understands "purged" keeps working and the
       data export reports it as deleted rather than as missing.
    */
    const intakes = bookingIds.length
      ? await tx
          .update(intakeSubmissions)
          .set({ payload: {}, purgedAt: now })
          .where(
            and(
              inArray(intakeSubmissions.bookingId, bookingIds),
              isNull(intakeSubmissions.purgedAt),
            ),
          )
          .returning({ id: intakeSubmissions.id })
      : [];

    /*
       The expert's note describes the same conversation as the intake above.
       Keeping "discussed the concentration in IT and how it got there" after
       erasing the holdings that sentence refers to would honour the request
       in letter and not in substance — which is the same reasoning the
       retention cron gives for purging the two together.
    */
    const notes = bookingIds.length
      ? await tx
          .update(bookings)
          .set({ expertNote: null, expertNoteAt: null })
          .where(and(eq(bookings.customerId, customerId), isNotNull(bookings.expertNote)))
          .returning({ id: bookings.id })
      : [];

    /*
       A room link is a live door into a call, and a cancellation reason is
       free text somebody typed about their own circumstances. Both go, on
       every booking rather than only the ones that had a note.
    */
    if (bookingIds.length) {
      await tx
        .update(bookings)
        .set({ meetingUrl: null, cancelledReason: null })
        .where(eq(bookings.customerId, customerId));
    }

    /*
       THE PAYMENT ROWS STAY. What is taken out of them is everything that
       says who paid — `raw` above all, because the Razorpay payload carries
       the name, email and contact that were sent to create the order, so
       redacting the four payer_* columns and leaving the blob would have
       erased nothing.

       What survives is the amount, the order and payment ids, the status, the
       date, and payer_method: "card" or "upi", which identifies a kind of
       instrument and not a person. That is a reconcilable accounting record
       and nothing more.
    */
    const redacted: { id: string }[] = [];

    if (bookingIds.length) {
      redacted.push(
        ...(await tx
          .update(payments)
          .set({ payerContact: null, payerEmail: null, payerInstrument: null, raw: null })
          .where(inArray(payments.bookingId, bookingIds))
          .returning({ id: payments.id })),
      );
    }

    /*
       A bundle or a pass is bought before any booking exists, so its payment
       hangs off the bundle or the membership and not off a booking. Missing
       these would have left the most expensive purchases on the platform —
       a ₹2,45,000 annual pass — with the payer's name and email intact.
    */
    const myBundles = await tx
      .select({ id: bundles.id })
      .from(bundles)
      .where(eq(bundles.customerId, customerId));

    if (myBundles.length) {
      redacted.push(
        ...(await tx
          .update(payments)
          .set({ payerContact: null, payerEmail: null, payerInstrument: null, raw: null })
          .where(
            inArray(
              payments.bundleId,
              myBundles.map((b) => b.id),
            ),
          )
          .returning({ id: payments.id })),
      );
    }

    const myPasses = await tx
      .select({ id: memberships.id })
      .from(memberships)
      .where(eq(memberships.customerId, customerId));

    if (myPasses.length) {
      redacted.push(
        ...(await tx
          .update(payments)
          .set({ payerContact: null, payerEmail: null, payerInstrument: null, raw: null })
          .where(
            inArray(
              payments.membershipId,
              myPasses.map((m) => m.id),
            ),
          )
          .returning({ id: payments.id })),
      );
    }

    /*
       The consent record is kept and emptied of the two fields that locate a
       person. That a disclaimer version was accepted, and when, is proof the
       session was delivered under terms the customer agreed to — evidence
       about the business rather than a description of the member. The IP and
       the user agent describe the member, and go.
    */
    if (bookingIds.length) {
      await tx
        .update(consents)
        .set({ ip: null, userAgent: null })
        .where(inArray(consents.bookingId, bookingIds));
    }

    /*
       Signed out everywhere, and the rows go rather than being revoked.

       Everywhere else in this codebase a session is revoked and kept, because
       "a revoked session is evidence that it existed" — evidence for the
       member, who can look at it. There is no member left to look. What the
       rows hold is an IP and a device string per sign-in, which is a location
       history, and keeping that as evidence about somebody who asked to be
       erased inverts the reason it was kept.

       Deleting them also invalidates the cookie in the member's hand the
       moment this commits, which is exactly when it should stop working.
    */
    const ended = await tx
      .delete(memberSessions)
      .where(eq(memberSessions.customerId, customerId))
      .returning({ id: memberSessions.id });

    /*
       Unspent sign-in codes. Hashed, single-use and short-lived, but a live
       credential belonging to an account that no longer exists is not a
       record of anything.
    */
    await tx.delete(signInCodes).where(eq(signInCodes.customerId, customerId));

    /*
       THE TOMBSTONE. The row survives because four tables point at it, and
       what is left of it is a valid foreign key and nothing else.

       The email cannot simply be blanked: the unique index on lower(email)
       would collide on the second account ever erased. It becomes an address
       at `.invalid`, which RFC 2606 reserves so that it can never resolve and
       nothing will ever deliver to it. The customer id inside it is already
       on every surviving row, so it discloses nothing new.

       The phone goes to null rather than to a placeholder, and that is doing
       work: the unique index on phone treats nulls as distinct, so the number
       is released and the same person can sign up again tomorrow as a new
       customer. A placeholder would have held their own number hostage.
    */
    await tx
      .update(customers)
      .set({
        name: "Deleted account",
        email: `deleted+${customerId}@landline.invalid`,
        phone: null,
        lastLinkSentAt: null,
      })
      .where(eq(customers.id, customerId));

    const receipt: ErasureReceipt = {
      intakesErased: intakes.length,
      notesErased: notes.length,
      paymentsRedacted: redacted.length,
      sessionsEnded: ended.length,
      bookingsKept: bookingIds.length,
      keptUntil: until,
    };

    /*
       Written inside the same transaction as the erasure, for the reason
       lib/ops-audit gives about refunds: an erasure that succeeded while its
       record failed would be the exact hole that record exists to close.
    */
    await tx.insert(accountDeletions).values({
      customerId,
      requestedBy,
      at: now,
      intakesErased: receipt.intakesErased,
      notesErased: receipt.notesErased,
      paymentsRedacted: receipt.paymentsRedacted,
      sessionsEnded: receipt.sessionsEnded,
      bookingsKept: receipt.bookingsKept,
      keptUntil: until,
    });

    return { ok: true, receipt };
  });
}

/**
 * Whether this account has already been erased.
 *
 * For the pages that must not offer it a second time, and for the sign-in
 * door: a tombstone has no phone number, so nobody can sign in as one, but a
 * screen that offers "delete your account" to an account already deleted is
 * telling somebody their request did not take.
 */
export async function alreadyErased(customerId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: accountDeletions.id })
    .from(accountDeletions)
    .where(eq(accountDeletions.customerId, customerId))
    .limit(1);
  return Boolean(row);
}
