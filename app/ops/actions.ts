"use server";

import { revalidatePath } from "next/cache";
import { defaultProduct, ensureDefaultProduct, syncExpertFromProducts } from "@/lib/products";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { bookings, bundles, expertApplications, experts, expertProducts, payments, expertPayouts } from "@/lib/db/schema";
import { OPS_COOKIE } from "@/lib/ops-auth";
import { audited, requireOperator } from "@/lib/ops-audit";
import { refundPayment } from "@/lib/razorpay";
import { uniqueSlug } from "@/lib/slug";
import { SINGLE_CALL_PAISE } from "@/lib/constants";
import { expertSignInLink, sendRaw } from "@/lib/email";
import { mintExpertLink } from "@/lib/expert-auth";
import { recordPayout, voidPayout } from "@/lib/payouts";

/**
 * Every action here names the person who ran it.
 *
 * The guard used to be `requireOps()`, which returned nothing — it answered
 * "is somebody signed in" and threw away the only interesting part of the
 * answer. It returns an operator now, and `audited()` will not run without
 * one, so an action that changes something without recording who changed it
 * is not a thing this file can express.
 *
 * Server actions are POST endpoints in their own right, so the middleware
 * guard in front of /ops is not sufficient on its own. Every action re-checks,
 * and the re-check now also confirms the operator is still active — a cookie
 * lasts seven days, and without that lookup disabling somebody would not
 * actually disable them until it expired.
 */

export async function signOut() {
  (await cookies()).delete(OPS_COOKIE);
  redirect("/ops/login");
}

export async function markComplete(formData: FormData) {
  const operator = await requireOperator();
  const id = String(formData.get("bookingId"));

  const [before] = await db
    .select({ status: bookings.status })
    .from(bookings)
    .where(eq(bookings.id, id))
    .limit(1);

  await audited(
    operator,
    {
      action: "booking.complete",
      entity: "booking",
      entityId: id,
      before: { status: before?.status ?? null },
      after: { status: "completed" },
    },
    async (tx) => {
      await tx
        .update(bookings)
        .set({ status: "completed" })
        .where(and(eq(bookings.id, id), eq(bookings.status, "confirmed")));
    },
  );

  /*
     Outside the transaction, and after it, deliberately.

     recordPayout is reachable from the expert console too and is built to be
     safe when called twice — a unique index refuses a second row. So the
     worst case here is a completed booking whose payout has not been written
     yet, which the next close from either console repairs. The reverse
     ordering would write a payout for a session that then failed to complete,
     and money owed on a session that never happened is the harder mistake to
     find.
  */
  await recordPayout(id);

  revalidatePath(`/ops/bookings/${id}`);
  revalidatePath("/ops/bookings");
  revalidatePath("/ops");
}

export async function cancelBooking(formData: FormData) {
  const operator = await requireOperator();
  const id = String(formData.get("bookingId"));
  const reason = String(formData.get("reason") ?? "").trim() || "cancelled from ops console";

  const [before] = await db
    .select({ status: bookings.status })
    .from(bookings)
    .where(eq(bookings.id, id))
    .limit(1);

  await audited(
    operator,
    {
      action: "booking.cancel",
      entity: "booking",
      entityId: id,
      before: { status: before?.status ?? null },
      after: { status: "cancelled" },
      note: reason,
    },
    async (tx) => {
      await tx
        .update(bookings)
        .set({ status: "cancelled", cancelledReason: reason, holdExpiresAt: null })
        .where(eq(bookings.id, id));
    },
  );

  revalidatePath(`/ops/bookings/${id}`);
  revalidatePath("/ops/bookings");
  revalidatePath("/ops");
}

/**
 * Refunds the money and then marks the booking. If Razorpay refuses, nothing
 * is marked — a booking that says "refunded" when no money moved is worse than
 * an error message.
 *
 * The Razorpay call sits OUTSIDE the audited transaction, before it, because
 * it cannot be rolled back. If the process dies between the refund and the
 * record, the money has moved and Landline has no local note of it — which is
 * recoverable from Razorpay's own ledger. The other ordering would leave a
 * signed record of a refund that never happened, which is recoverable from
 * nothing.
 */
export async function refundBooking(formData: FormData) {
  const operator = await requireOperator();
  const id = String(formData.get("bookingId"));
  const reason = String(formData.get("reason") ?? "").trim() || "refunded from ops console";

  const [booking] = await db.select().from(bookings).where(eq(bookings.id, id)).limit(1);
  if (!booking) throw new Error("Booking not found");

  const [payment] = await db
    .select()
    .from(payments)
    .where(and(eq(payments.bookingId, id), eq(payments.status, "captured")))
    .limit(1);

  if (!payment?.razorpayPaymentId) {
    throw new Error("No captured payment on this booking — cancel it instead");
  }

  await refundPayment(payment.razorpayPaymentId, payment.amountPaise, reason);

  await audited(
    operator,
    {
      action: "booking.refund",
      entity: "booking",
      entityId: id,
      before: { status: booking.status, paymentStatus: "captured" },
      after: {
        status: "refunded",
        paymentStatus: "refunded",
        amountPaise: payment.amountPaise,
        razorpayPaymentId: payment.razorpayPaymentId,
      },
      note: reason,
    },
    async (tx) => {
      await tx.update(payments).set({ status: "refunded" }).where(eq(payments.id, payment.id));
      await tx
        .update(bookings)
        .set({ status: "refunded", cancelledReason: reason })
        .where(eq(bookings.id, id));

      // A refunded bundle is spent, not returned to the customer's credits.
      if (booking.bundleId) {
        await tx.update(bundles).set({ status: "refunded" }).where(eq(bundles.id, booking.bundleId));
      }
    },
  );

  // The customer got their money back, so this session earned nothing. Voided
  // rather than deleted — a row that says why it is worth nothing beats one
  // that quietly disappeared. A payout already marked paid is left alone,
  // because that money has gone.
  await voidPayout(id, `booking refunded: ${reason}`);

  revalidatePath(`/ops/bookings/${id}`);
  revalidatePath("/ops/bookings");
  revalidatePath("/ops");
}

export async function setExpertStatus(formData: FormData) {
  const operator = await requireOperator();
  const id = String(formData.get("expertId"));
  const status = String(formData.get("status"));
  if (status !== "live" && status !== "paused" && status !== "draft") {
    throw new Error("Unknown status");
  }

  const [before] = await db
    .select({ status: experts.status, name: experts.displayName })
    .from(experts)
    .where(eq(experts.id, id))
    .limit(1);

  await audited(
    operator,
    {
      action: "expert.status",
      entity: "expert",
      entityId: id,
      before: { status: before?.status ?? null },
      after: { status, displayName: before?.name ?? null },
    },
    async (tx) => {
      await tx.update(experts).set({ status, updatedAt: new Date() }).where(eq(experts.id, id));
    },
  );

  revalidatePath("/ops/experts");
  revalidatePath("/");
}

export async function setExpertPrice(formData: FormData) {
  const operator = await requireOperator();
  const id = String(formData.get("expertId"));
  const rupees = Number(formData.get("rupees"));

  if (!Number.isFinite(rupees) || rupees < 0 || rupees > 200000) {
    throw new Error("Price must be between 0 and 2,00,000 rupees");
  }

  const pricePaise = Math.round(rupees * 100);
  const [before] = await db
    .select({ pricePaise: experts.pricePaise, name: experts.displayName })
    .from(experts)
    .where(eq(experts.id, id))
    .limit(1);

  await audited(
    operator,
    {
      action: "expert.price",
      entity: "expert",
      entityId: id,
      before: { pricePaise: before?.pricePaise ?? null },
      after: { pricePaise, displayName: before?.name ?? null },
    },
    async (tx) => {
      /*
         The authoritative write stays INSIDE the transaction, with the
         audit event.

         Calling changeProductPrice here instead would be tidier and
         wrong: it writes on its own connection, so a failure after it
         would roll back the event and leave the price changed — a
         change with no record, which is the one thing ops_events
         exists to make impossible.

         The cache refresh is the only part that happens afterwards. If
         that fails the listing is briefly stale while the truth is
         correct and recorded, which is the right way round to fail.
      */
      const primary = await defaultProduct(id);
      if (!primary) throw new Error("That expert has nothing to reprice");

      await tx
        .update(expertProducts)
        .set({ pricePaise, updatedAt: new Date() })
        .where(eq(expertProducts.id, primary.id));
    },
  );

  await syncExpertFromProducts(id);

  revalidatePath("/ops/experts");
  revalidatePath("/");
}

/**
 * Approve an application: the moment an applicant becomes an expert.
 *
 * Deliberately conservative about what it creates. The new expert is `draft`,
 * not `live` — they have no availability yet, so publishing them immediately
 * would put a profile on the site whose every slot is empty. They go live from
 * the ops experts page once they have set their hours.
 *
 * The price is the standard rate rather than anything they asked for. What
 * someone puts in a form is a request; what a session costs is a decision,
 * and they can change it themselves afterwards.
 *
 * This is the action most worth attributing. Who decided that this person may
 * sell financial advice to retail investors on Landline is a question with a
 * regulator-shaped answer, and until now the answer was nobody in particular.
 */
export async function approveApplication(formData: FormData) {
  const operator = await requireOperator();
  const id = String(formData.get("applicationId"));

  const [application] = await db
    .select()
    .from(expertApplications)
    .where(and(eq(expertApplications.id, id), eq(expertApplications.status, "new")))
    .limit(1);

  // Already handled — two operators with the queue open, or a double submit.
  if (!application) {
    revalidatePath("/ops/applications");
    return;
  }

  const taken = await db.select({ slug: experts.slug }).from(experts);
  const slug = uniqueSlug(application.name, taken.map((e) => e.slug));

  /*
     What they asked for, or the standard rate.

     The applicant proposed a number on the form; approving is what makes it
     a price. Bounds were checked when it was submitted, and they are the
     same constants the expert console enforces, so nothing needs
     re-validating here — but the audit event records it either way, because
     'why is this expert on ₹8,000' is a question with an answer and this is
     where the answer is written down.

     One number, used for both the product and the cached price on the
     expert row, so the two agree from the moment they exist.
  */
  const pricePaise = application.askedPricePaise ?? SINGLE_CALL_PAISE;

  const initials = application.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");

  const expert = await audited(
    operator,
    {
      action: "application.approve",
      entity: "application",
      entityId: id,
      before: { status: "new", applicantName: application.name, email: application.email },
      after: {
        status: "approved",
        slug,
        sebiRegType: application.sebiRegType,
        sebiRegNumber: application.sebiRegNumber,
        pricePaise,
        priceAskedFor: application.askedPricePaise,
      },
    },
    async (tx) => {
      const [created] = await tx
        .insert(experts)
        .values({
          slug,
          displayName: application.name,
          initials: initials || "??",
          headline: application.headline,
          bio: application.bio,
          background: application.background,
          specialties: application.specialties,
          yearsExperience: application.yearsExperience,
          pricePaise,
          sebiRegType: application.sebiRegType,
          sebiRegNumber: application.sebiRegNumber,
          contactEmail: application.email,
          status: "draft",
        })
        .returning();

      /*
         An expert with no product is not bookable: the hold route reads the
         product to get the price and the duration, and finds nothing. Same
         transaction as the expert row, so approval never half-happens.
      */
      await ensureDefaultProduct(created.id, pricePaise, tx);

      await tx
        .update(expertApplications)
        .set({ status: "approved", reviewedAt: new Date(), expertId: created.id })
        .where(eq(expertApplications.id, id));

      return created;
    },
  );

  /*
   * The sign-in link is how they get in to set their hours. If the email
   * cannot go out the approval still stands — the expert row exists and ops
   * can resend — so this must not throw the whole action away. Outside the
   * transaction for the same reason the Razorpay call is: an email cannot be
   * un-sent by a rollback.
   */
  try {
    const base = process.env.NEXT_PUBLIC_SITE_URL ?? "";
    const token = await mintExpertLink(expert.id);
    await sendRaw({
      to: expert.contactEmail,
      ...expertSignInLink({
        expertName: expert.displayName,
        url: `${base}/api/expert/session?token=${token}`,
      }),
    });
  } catch (err) {
    console.error(`[ops] approved ${expert.id} but could not send their sign-in link`, err);
  }

  revalidatePath("/ops/applications");
  revalidatePath("/ops/experts");
}

export async function rejectApplication(formData: FormData) {
  const operator = await requireOperator();
  const id = String(formData.get("applicationId"));
  const note = String(formData.get("reviewNote") ?? "").trim();

  const [before] = await db
    .select({ status: expertApplications.status, name: expertApplications.name })
    .from(expertApplications)
    .where(eq(expertApplications.id, id))
    .limit(1);

  await audited(
    operator,
    {
      action: "application.reject",
      entity: "application",
      entityId: id,
      before: { status: before?.status ?? null, applicantName: before?.name ?? null },
      after: { status: "rejected" },
      note: note === "" ? null : note,
    },
    async (tx) => {
      await tx
        .update(expertApplications)
        .set({
          status: "rejected",
          reviewedAt: new Date(),
          reviewNote: note === "" ? null : note,
        })
        .where(and(eq(expertApplications.id, id), eq(expertApplications.status, "new")));
    },
  );

  revalidatePath("/ops/applications");
}

/**
 * Records that an expert has been paid everything outstanding.
 *
 * Settles all their pending rows at once, because that is how the bank
 * transfer actually happens — one payment covering many sessions — and the
 * reference is what ties the ledger back to it.
 *
 * Only touches `pending`. A voided payout stays void and a paid one keeps its
 * original reference; re-running this must never rewrite history.
 *
 * The event records which rows were settled and for how much, not just that
 * somebody pressed the button. "You said you paid me" is a conversation that
 * needs the list, and the list stops being reconstructable the moment those
 * rows are no longer pending.
 */
export async function markPayoutsPaid(formData: FormData) {
  const operator = await requireOperator();
  const expertId = String(formData.get("expertId"));
  const reference = String(formData.get("reference") ?? "").trim();
  if (!reference) throw new Error("A payment reference is required");

  await audited(
    operator,
    {
      action: "payout.paid",
      entity: "payout",
      entityId: expertId,
      note: reference,
    },
    async (tx, detail) => {
      const settled = await tx
        .update(expertPayouts)
        .set({ status: "paid", reference, paidAt: new Date(), updatedAt: new Date() })
        .where(and(eq(expertPayouts.expertId, expertId), eq(expertPayouts.status, "pending")))
        .returning({ id: expertPayouts.id, amountPaise: expertPayouts.amountPaise });

      /*
         Recorded from inside, because what was settled is only knowable from
         the update itself — before it runs there is no list, and after it
         commits those rows are no longer pending and the list cannot be
         rebuilt.
      */
      detail({
        after: {
          reference,
          settledCount: settled.length,
          settledPaise: settled.reduce((sum, row) => sum + row.amountPaise, 0),
          payoutIds: settled.map((row) => row.id),
        },
      });
      return settled;
    },
  );

  revalidatePath("/ops/payouts");
}
