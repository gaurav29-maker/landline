import { NextRequest, NextResponse } from "next/server";
import { toE164 } from "@/lib/phone";
import { z } from "zod";
import { and, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  availabilityExceptions,
  availabilityRules,
  bookings,
  consents,
  customers,
  experts,
} from "@/lib/db/schema";
import { computeSlots } from "@/lib/slots";
import { bookableProduct, defaultProduct } from "@/lib/products";
import { DISCLAIMER_VERSION, HOLD_MINUTES } from "@/lib/constants";
import { occupiesSlot, releaseStaleHold } from "@/lib/bookings";

export const dynamic = "force-dynamic";

const Body = z.object({
  expertSlug: z.string().min(1),
  /*
     Which of the expert's products. Optional: every booking link that
     predates expert_products omits it, and those must keep working —
     they resolve to the expert's default product instead.
  */
  productSlug: z.string().min(1).max(60).optional(),
  startsAt: z.string().datetime(),
  name: z.string().min(1).max(120),
  email: z.string().email().max(200),
  /*
     Required since phone became the way members sign in.

     It was optional, and every seeded customer proved what that meant:
     a null phone column and no way back into the console except the
     emailed link. A number collected at the till is a number that works
     later; one asked for at sign-in is asked for from somebody already
     locked out.

     Validated here rather than trusted from the form, because the form is
     not the only thing that can post to this route.
  */
  phone: z.string().min(1).max(20),
  disclaimerAccepted: z.literal(true),
});

function isUniqueViolation(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: string }).code === "23505";
}

/**
 * WHICH unique index was violated.
 *
 * customers now has two — one on the address, one on the number — and the
 * two mean opposite things here. Email means this person already exists and
 * we raced somebody to insert them, so the answer is to go and read their
 * row. Phone means the number belongs to a DIFFERENT account, and reading
 * the row by email would find nothing at all.
 *
 * Treating both the same is how a phone collision became an insert that
 * failed, a re-select that matched nothing, and a crash three queries later
 * on a customer id of undefined.
 */
function violatedIndex(err: unknown): string | null {
  if (typeof err !== "object" || err === null) return null;
  const e = err as { constraint_name?: string; constraint?: string };
  return e.constraint_name ?? e.constraint ?? null;
}

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", detail: parsed.error.flatten() }, { status: 400 });
  }
  const input = parsed.data;
  const startsAt = new Date(input.startsAt);

  const [expert] = await db
    .select()
    .from(experts)
    .where(and(eq(experts.slug, input.expertSlug), eq(experts.status, "live")))
    .limit(1);
  if (!expert) return NextResponse.json({ error: "Expert not found" }, { status: 404 });

  // Never trust the client that a slot is real. Recompute and check membership:
  // otherwise someone can book 3am, or a time the expert never offered.
  const horizonEnd = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);
  const [rules, exceptions, taken] = await Promise.all([
    db.select().from(availabilityRules).where(eq(availabilityRules.expertId, expert.id)),
    db.select().from(availabilityExceptions).where(eq(availabilityExceptions.expertId, expert.id)),
    db
      .select({ startsAt: bookings.startsAt })
      .from(bookings)
      .where(
        and(
          eq(bookings.expertId, expert.id),
          occupiesSlot(),
          gte(bookings.startsAt, new Date()),
          lte(bookings.startsAt, horizonEnd),
        ),
      ),
  ]);

  /*
     PRICE AND DURATION COME FROM THE PRODUCT, NOT THE EXPERT ROW.

     experts.price_paise is a denormalised 'from' price for the listing
     page; it is not what anybody is charged. Resolving here also means a
     hidden product stops being bookable with no other change, because
     bookableProduct only returns active ones.
  */
  const product = input.productSlug
    ? await bookableProduct(expert.id, input.productSlug)
    : await defaultProduct(expert.id);

  if (!product) {
    return NextResponse.json({ error: "That session is not available" }, { status: 404 });
  }

  const offered = computeSlots({
    timezone: expert.timezone,
    rules: rules.map((r) => ({ weekday: r.weekday, startMinute: r.startMinute, endMinute: r.endMinute })),
    exceptions: exceptions.map((e) => ({
      date: e.date,
      kind: e.kind,
      startMinute: e.startMinute,
      endMinute: e.endMinute,
    })),
    takenStarts: taken.map((b) => b.startsAt),
    from: new Date(),
    to: horizonEnd,
    slotMinutes: product.minutes,
  });

  if (!offered.some((s) => s.startsAt.getTime() === startsAt.getTime())) {
    return NextResponse.json({ error: "That slot is no longer available" }, { status: 409 });
  }

  const email = input.email.trim();

  /* One canonical spelling, or a refusal — never a number we cannot text. */
  const phone = toE164(input.phone);
  if (!phone) {
    return NextResponse.json(
      { error: "Enter a ten-digit Indian mobile number" },
      { status: 400 },
    );
  }
  let [customer] = await db
    .select()
    .from(customers)
    .where(sql`lower(${customers.email}) = ${email.toLowerCase()}`)
    .limit(1);

  if (!customer) {
    try {
      [customer] = await db
        .insert(customers)
        .values({ email, name: input.name, phone })
        .returning();
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;

      /*
         A number already on another account. One number, one account — it
         is the sign-in credential now, so letting a second account claim
         it would be handing one person's console to whoever booked last.
         Said plainly, because the way out is to sign in, not to retry.
      */
      if (violatedIndex(err) === "customers_phone_idx") {
        return NextResponse.json(
          {
            error:
              "That mobile number is already on a Landline account. Sign in with it, or book with the number you registered.",
          },
          { status: 409 },
        );
      }

      /* Otherwise the address raced us in: read the row that won. */
      [customer] = await db
        .select()
        .from(customers)
        .where(sql`lower(${customers.email}) = ${email.toLowerCase()}`)
        .limit(1);
    }
  }

  /*
     Nothing below can work without a customer, and a missing one used to
     travel three queries further before Postgres refused an id of
     "undefined". Fail here, where the reason is still legible.
  */
  if (!customer) {
    return NextResponse.json(
      { error: "Could not open an account for that address. Try again." },
      { status: 500 },
    );
  }

  /*
     A returning customer who had no number on file gets one now.

     Only when the column is empty: an existing number is how they sign in,
     and a booking form is not the place to let somebody quietly move an
     account onto a different handset. Changing a number on file is its own
     flow, verified, the way changing the email address already is.

     A number already claimed by another account is left alone rather than
     fought over — the unique index would refuse it anyway, and failing a
     paid booking over it would be the wrong thing to lose.
  */
  if (customer && !customer.phone) {
    try {
      await db.update(customers).set({ phone }).where(eq(customers.id, customer.id));
      customer = { ...customer, phone };
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
    }
  }

  // Clear a lapsed hold on this exact slot before inserting; the unique index
  // would otherwise refuse a slot nobody actually occupies.
  await releaseStaleHold(expert.id, startsAt);

  try {
    const [booking] = await db
      .insert(bookings)
      .values({
        expertId: expert.id,
        customerId: customer.id,
        startsAt,
        endsAt: new Date(startsAt.getTime() + product.minutes * 60_000),
        status: "held",
        holdExpiresAt: new Date(Date.now() + HOLD_MINUTES * 60_000),
        product: "single",
        productId: product.id,
        amountPaise: product.pricePaise, // server-side price, always
      })
      .returning();

    await db.insert(consents).values({
      bookingId: booking.id,
      disclaimerVersion: DISCLAIMER_VERSION,
      ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      userAgent: req.headers.get("user-agent") ?? null,
    });

    return NextResponse.json({
      bookingId: booking.id,
      holdExpiresAt: booking.holdExpiresAt?.toISOString(),
      amountPaise: booking.amountPaise,
    });
  } catch (err) {
    // Lost the race between computing slots and inserting. The partial unique
    // index is what actually decides who got the slot.
    if (isUniqueViolation(err)) {
      return NextResponse.json({ error: "That slot was just taken" }, { status: 409 });
    }
    throw err;
  }
}
