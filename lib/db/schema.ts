import { sql } from "drizzle-orm";
import {
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Money is always integer paise. Never floats, never rupees.
 * Times of day are minutes from midnight in the expert's timezone;
 * see the design doc for why weekly recurrence is not stored as timestamptz.
 */

export const expertStatus = pgEnum("expert_status", ["draft", "live", "paused"]);
export const sebiRegType = pgEnum("sebi_reg_type", ["ria", "ra", "none"]);
export const specialty = pgEnum("specialty", ["portfolio_audit", "fno_systematic"]);
export const exceptionKind = pgEnum("exception_kind", ["block", "extra"]);
export const applicationStatus = pgEnum("application_status", ["new", "approved", "rejected"]);
export const bookingStatus = pgEnum("booking_status", [
  "held",
  "confirmed",
  "completed",
  "no_show",
  "cancelled",
  "refunded",
  "expired",
]);
export const productType = pgEnum("product_type", [
  "single",
  "bundle_call",
  "monthly",
  "membership_call",
]);
export const membershipTier = pgEnum("membership_tier", ["quarterly", "annual"]);
export const membershipStatus = pgEnum("membership_status", [
  "pending",
  "active",
  "expired",
  "refunded",
  "cancelled",
]);
export const paymentStatus = pgEnum("payment_status", [
  "created",
  "captured",
  "failed",
  "refunded",
]);
export const bundleStatus = pgEnum("bundle_status", [
  "active",
  "exhausted",
  "expired",
  "refunded",
]);
export const notificationKind = pgEnum("notification_kind", [
  "booking_confirmed_customer",
  "booking_confirmed_expert",
  "intake_nudge",
  "reminder_24h",
  "reminder_1h",
  "followup",
  "refund_apology",
]);

export const experts = pgTable(
  "experts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull(),
    displayName: text("display_name").notNull(),
    initials: text("initials").notNull(),
    headline: text("headline").notNull(),
    bio: text("bio").notNull().default(""),

    /**
     * Where they have actually worked.
     *
     * The platform's whole claim is access to people with institutional
     * experience, and until this field existed there was no way to tell one
     * from a confident retail trader with a good headline. Stated in their
     * own words, checked by a person before they go live, and — like the SEBI
     * registration — NOT editable by the expert afterwards, because a fact
     * somebody can rewrite after it was verified was never verified.
     */
    background: text("background").notNull().default(""),
    specialties: specialty("specialties").array().notNull(),
    yearsExperience: smallint("years_experience").notNull(),
    pricePaise: integer("price_paise").notNull(),
    timezone: text("timezone").notNull().default("Asia/Kolkata"),

    // First-class, not an afterthought: see the SEBI section of the design doc.
    sebiRegType: sebiRegType("sebi_reg_type").notNull().default("none"),
    sebiRegNumber: text("sebi_reg_number"),

    /**
     * NOT copied onto bookings any more. A single room shared across every
     * session means one customer can walk into another's call — see the note
     * on bookings.meetingUrl. Kept only as a default an expert may paste.
     */
    meetingUrl: text("meeting_url"),
    contactEmail: text("contact_email").notNull(),

    status: expertStatus("status").notNull().default("draft"),
    lastLinkSentAt: timestamp("last_link_sent_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("experts_slug_idx").on(t.slug), index("experts_status_idx").on(t.status)],
);

export const availabilityRules = pgTable(
  "availability_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    expertId: uuid("expert_id")
      .notNull()
      .references(() => experts.id, { onDelete: "cascade" }),
    weekday: smallint("weekday").notNull(), // 0 = Sunday
    startMinute: integer("start_minute").notNull(),
    endMinute: integer("end_minute").notNull(),
  },
  (t) => [index("availability_rules_expert_idx").on(t.expertId, t.weekday)],
);

export const availabilityExceptions = pgTable(
  "availability_exceptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    expertId: uuid("expert_id")
      .notNull()
      .references(() => experts.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    kind: exceptionKind("kind").notNull(),
    startMinute: integer("start_minute"),
    endMinute: integer("end_minute"),
  },
  (t) => [index("availability_exceptions_expert_idx").on(t.expertId, t.date)],
);

export const customers = pgTable(
  "customers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    name: text("name").notNull(),
    phone: text("phone"),
    /** When a sign-in link was last emailed, so it cannot be used to spam. */
    lastLinkSentAt: timestamp("last_link_sent_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("customers_email_idx").on(sql`lower(${t.email})`),
    /*
       Phone is how you sign in, so two people cannot share one.

       Unique, not notNull: Postgres treats NULLs as distinct, so every
       member who booked before phone was asked for keeps their row and
       their email link. The column fills in the first time they sign in
       by phone or book again.
    */
    uniqueIndex("customers_phone_idx").on(t.phone),
  ],
);

/**
 * A sign-in code, stored the way a secret is stored.
 *
 * Never the digits themselves — an HMAC of them. A leaked table read should
 * not hand anybody a working code, and this table is read by every sign-in.
 *
 * Six digits is a million possibilities, which is minutes of work unattended.
 * Three things make that safe rather than fast: it expires, it is consumed on
 * first success, and wrong guesses are counted against a cap. Any of the three
 * alone is not enough; the cap is the one that actually stops a guesser.
 */
export const signInCodes = pgTable(
  "sign_in_codes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    customerId: uuid("customer_id")
      .notNull()
      /* Dies with the customer: a session or a code that outlives the person
         it belongs to is not a record, it is a dangling key. */
      .references(() => customers.id, { onDelete: "cascade" }),
    codeHash: text("code_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    attempts: smallint("attempts").notNull().default(0),
    /** Set on the one success. A consumed code is refused like a wrong one. */
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("sign_in_codes_customer_idx").on(t.customerId)],
);

export const bundles = pgTable("bundles", {
  id: uuid("id").primaryKey().defaultRandom(),
  customerId: uuid("customer_id")
    .notNull()
    .references(() => customers.id),
  // Nullable since memberships arrived: a bundle is tied to one expert,
  // a pass is not tied to anyone.
  expertId: uuid("expert_id").references(() => experts.id),
  creditsTotal: smallint("credits_total").notNull().default(3),
  creditsUsed: smallint("credits_used").notNull().default(0),
  amountPaise: integer("amount_paise").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  status: bundleStatus("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * A pass is a WINDOW OF TIME, not a pot of credits.
 *
 * There is deliberately no credits_total or credits_used here. Passes are
 * unlimited, so a counter would be a column that is always meaningless, and
 * bending `bundles` to carry both shapes would leave half its columns null on
 * every row. Booking under a pass asks one question: is there an active
 * membership covering this date?
 */
export const memberships = pgTable(
  "memberships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id),
    tier: membershipTier("tier").notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    amountPaise: integer("amount_paise").notNull(),
    status: membershipStatus("status").notNull().default("pending"),
    cancelledReason: text("cancelled_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("memberships_customer_idx").on(t.customerId),
    index("memberships_window_idx").on(t.status, t.endsAt),
  ],
);

export const bookings = pgTable(
  "bookings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    expertId: uuid("expert_id")
      .notNull()
      .references(() => experts.id),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    status: bookingStatus("status").notNull().default("held"),
    holdExpiresAt: timestamp("hold_expires_at", { withTimezone: true }),
    product: productType("product").notNull().default("single"),
    bundleId: uuid("bundle_id").references(() => bundles.id),
    membershipId: uuid("membership_id").references(() => memberships.id),
    amountPaise: integer("amount_paise").notNull(),
    /**
     * Set per session by the expert, and deliberately NOT inherited from
     * experts.meeting_url. Copying one room onto every booking gave four
     * customers the same link, which is a privacy breach dressed as a
     * convenience: any of them could join another's portfolio review.
     * Null until the expert supplies one; the UI already says so.
     */
    meetingUrl: text("meeting_url"),
    cancelledReason: text("cancelled_reason"),

    /**
     * What the expert recorded after the session, shown to the customer.
     *
     * The wording of this field is load-bearing. It records what was
     * DISCUSSED, never what was recommended. "Discussed the concentration in
     * IT and how it got there" is an account of a conversation; "advised
     * cutting IT to 30%" is a written personalised recommendation sitting on
     * Landline's servers and delivered to the customer, which is the exact
     * thing the terms say we do not do. The expert console says so at the
     * point of writing, and the customer's view frames it the same way.
     *
     * Purged on the same 90-day clock as the intake it describes.
     */
    expertNote: text("expert_note"),
    expertNoteAt: timestamp("expert_note_at", { withTimezone: true }),

    /** The refund policy allows one free move; this is what enforces "one". */
    rescheduleCount: smallint("reschedule_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    /**
     * The single most important line in this schema.
     *
     * Two customers paying for the same slot costs a customer and an expert
     * at once. A check-then-insert in application code loses that race; this
     * index cannot. Cancelled, refunded and expired bookings are excluded, so
     * a released slot becomes bookable again immediately.
     */
    uniqueIndex("bookings_no_double_booking")
      .on(t.expertId, t.startsAt)
      .where(sql`status in ('held','confirmed','completed')`),
    index("bookings_customer_idx").on(t.customerId),
    index("bookings_starts_at_idx").on(t.startsAt),
    index("bookings_hold_sweep_idx")
      .on(t.holdExpiresAt)
      .where(sql`status = 'held'`),
  ],
);

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bookingId: uuid("booking_id").references(() => bookings.id),
    bundleId: uuid("bundle_id").references(() => bundles.id),
    membershipId: uuid("membership_id").references(() => memberships.id),
    razorpayOrderId: text("razorpay_order_id").notNull(),
    razorpayPaymentId: text("razorpay_payment_id"),
    amountPaise: integer("amount_paise").notNull(),
    status: paymentStatus("status").notNull().default("created"),

    /*
       WHO PAID, as somebody other than us checked.

       A phone number proves possession of a SIM. A captured payment proves
       that a bank or a UPI app authenticated somebody against an instrument
       in their name, which is a materially stronger claim about a person and
       one Landline neither performs nor stores the hard parts of.

       All of this already arrived in `raw`. It sat in a jsonb blob nobody
       queried, which is the same as not having it: the question these
       answer — is the person disputing this charge the person who made it —
       gets asked months later by somebody who will not be writing json
       path expressions to find out.

       Deliberately NOT stored: the card number, the CVV, the bank
       credentials. Razorpay holds those and is certified to; last four
       digits and a UPI handle are what a human needs to recognise their own
       instrument, and nothing here is enough to charge anybody.
    */
    payerMethod: text("payer_method"),
    /** Last four of the card, or the UPI handle. Recognisable, not usable. */
    payerInstrument: text("payer_instrument"),
    /*
       The contact Razorpay verified, in E.164 where we could parse it.
       Compared against the account's own number: equal is corroboration,
       different is not fraud but is the first thing worth looking at.
    */
    payerContact: text("payer_contact"),
    payerEmail: text("payer_email"),
    raw: jsonb("raw"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("payments_order_idx").on(t.razorpayOrderId),
    // Idempotency: a redelivered capture cannot be recorded twice.
    uniqueIndex("payments_payment_idx")
      .on(t.razorpayPaymentId)
      .where(sql`razorpay_payment_id is not null`),
  ],
);

export const intakeSubmissions = pgTable(
  "intake_submissions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    /**
     * Holdings summary, goals, experience, risk comfort.
     *
     * There is deliberately no field here for demat credentials. The FAQ
     * promises users never share a login, and the cheapest way to keep that
     * promise is to have nowhere to put one. Purged 90 days after the call.
     */
    payload: jsonb("payload").notNull(),
    submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
    purgedAt: timestamp("purged_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("intake_booking_idx").on(t.bookingId)],
);

export const consents = pgTable("consents", {
  id: uuid("id").primaryKey().defaultRandom(),
  bookingId: uuid("booking_id")
    .notNull()
    .references(() => bookings.id, { onDelete: "cascade" }),
  disclaimerVersion: text("disclaimer_version").notNull(),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }).notNull().defaultNow(),
  ip: text("ip"),
  userAgent: text("user_agent"),
});

export const webhookEvents = pgTable(
  "webhook_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    provider: text("provider").notNull().default("razorpay"),
    eventId: text("event_id").notNull(),
    type: text("type").notNull(),
    payload: jsonb("payload").notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    error: text("error"),
  },
  (t) => [uniqueIndex("webhook_events_event_idx").on(t.provider, t.eventId)],
);

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    kind: notificationKind("kind").notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
  },
  // A retrying Cron must not send the same reminder three times.
  (t) => [uniqueIndex("notifications_once_idx").on(t.bookingId, t.kind)],
);

/**
 * People asking to become experts.
 *
 * Kept apart from `experts` on purpose. An applicant is not a draft expert:
 * they have no price, no availability and no account, and a row in `experts`
 * is something the booking code is entitled to assume is a real person we
 * have checked. Approval is the moment one becomes the other, and it is a
 * decision a human makes in the ops console.
 *
 * Applications carry personal data under the DPDP Act. Rejected ones should
 * not be kept indefinitely — see the note in scripts/ and the purge cron.
 */
export const expertApplications = pgTable(
  "expert_applications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    phone: text("phone"),
    headline: text("headline").notNull(),
    bio: text("bio").notNull(),
    /** Where they have worked. Required: it is the claim being assessed. */
    background: text("background").notNull().default(""),
    specialties: specialty("specialties").array().notNull(),
    yearsExperience: smallint("years_experience").notNull(),

    /**
     * Asked at the door rather than after approval. Whether someone is
     * registered changes what the listing has to say about them, and the
     * terms commit to showing it either way.
     */
    sebiRegType: sebiRegType("sebi_reg_type").notNull().default("none"),
    sebiRegNumber: text("sebi_reg_number"),

    /** Where their work can be seen, in their own words. */
    links: text("links"),
    note: text("note"),

    /**
     * A salted hash of the sender's IP, never the address itself.
     *
     * /apply is a public write with no account behind it, so it needs some
     * throttle or one script fills the database. Throttling needs to
     * recognise a repeat sender, which does not require knowing who they
     * are — the hash answers "same source again?" and nothing else, and it
     * cannot be turned back into an address or matched against logs.
     */
    ipHash: text("ip_hash"),

    status: applicationStatus("status").notNull().default("new"),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewNote: text("review_note"),
    /** Set on approval, so an application can never create two experts. */
    expertId: uuid("expert_id").references(() => experts.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    /*
     * One open application per address. A partial index rather than a plain
     * unique one, so somebody rejected in March can apply again in October
     * without a support ticket — but cannot submit the same form nine times
     * while it is still sitting in the queue.
     */
    uniqueIndex("expert_applications_one_open_idx")
      .on(sql`lower(${t.email})`)
      .where(sql`status = 'new'`),
    index("expert_applications_status_idx").on(t.status, t.createdAt),
    index("expert_applications_source_idx").on(t.ipHash, t.createdAt),
  ],
);

/**
 * An experts Google connection, so Landline can create the Meet link for a
 * session instead of asking them to paste one.
 *
 * Its own table rather than four nullable columns on experts: disconnecting
 * is then deleting a row, which cannot leave a half-cleared state behind, and
 * a table nobody has connected to is simply empty.
 *
 * The refresh token is the long-lived one — it keeps working until revoked,
 * so it is stored encrypted rather than in the clear. See lib/secretbox.ts.
 * The access token is short-lived and re-fetched from it.
 */
export const googleAccounts = pgTable("google_accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  /** One connection per expert; reconnecting replaces it. */
  expertId: uuid("expert_id")
    .notNull()
    .unique()
    .references(() => experts.id, { onDelete: "cascade" }),
  /** Shown back to the expert so they can see WHICH account is connected. */
  googleEmail: text("google_email").notNull(),
  refreshTokenEnc: text("refresh_token_enc").notNull(),
  accessToken: text("access_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const payoutStatus = pgEnum("payout_status", ["pending", "paid", "void"]);

/**
 * What an expert has earned, one row per session.
 *
 * The amount is captured HERE rather than computed from a rate when you look
 * at it. A payout is a fact about a session that already happened; changing
 * the split next quarter must not silently rewrite what somebody was owed
 * last quarter. Same reason bookings carry amountPaise instead of reading a
 * price list.
 *
 * A row exists for a completed session and for a no_show — on a no-show the
 * customer is not refunded, because the expert held the slot and prepared
 * from the intake, so the expert is still owed. Refunding a booking voids the
 * payout instead of deleting it: what happened stays visible.
 */
export const expertPayouts = pgTable(
  "expert_payouts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    expertId: uuid("expert_id")
      .notNull()
      .references(() => experts.id, { onDelete: "cascade" }),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    /** Paise, as earned on the day. Never recomputed. */
    amountPaise: integer("amount_paise").notNull(),
    status: payoutStatus("status").notNull().default("pending"),
    /** Bank reference or UTR, so a payment can be traced afterwards. */
    reference: text("reference"),
    note: text("note"),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    /*
     * One payout per session, ever. Not a convention — the database refuses.
     * Completing a booking twice, or ops and the expert both closing it, must
     * never pay somebody twice for one call.
     */
    uniqueIndex("expert_payouts_one_per_booking").on(t.bookingId),
    index("expert_payouts_expert_idx").on(t.expertId, t.status),
  ],
);

export type Expert = typeof experts.$inferSelect;
export type Membership = typeof memberships.$inferSelect;
export type Booking = typeof bookings.$inferSelect;
export type Customer = typeof customers.$inferSelect;
export type ExpertApplication = typeof expertApplications.$inferSelect;
export type GoogleAccount = typeof googleAccounts.$inferSelect;
export type ExpertPayout = typeof expertPayouts.$inferSelect;


/* ============================ WHO DID IT ============================ */

/**
 * The people who operate Landline.
 *
 * The console used to take one shared password, on the reasoning that there
 * was exactly one operator. That was true when it was written and stops being
 * true the day somebody else is told the password — and nothing in the code
 * notices. Worse, a shared secret cannot attribute anything even to that one
 * person: every refund, every approval and every payout marked paid was done
 * by "whoever knew the password".
 *
 * One row per human, so the session cookie can carry WHO rather than merely
 * THAT SOMEBODY PASSED.
 *
 * There is no self-service signup and there should never be one. Operators are
 * added by running scripts/add-operator.ts against the database, which is a
 * deliberate piece of friction: the list of people who can move money should
 * change only when somebody with database access decides it does.
 */
export const opsUserStatus = pgEnum("ops_user_status", ["active", "disabled"]);

export const opsUsers = pgTable(
  "ops_users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    name: text("name").notNull(),
    /** scrypt, with a per-row salt. See lib/ops-auth. */
    passwordHash: text("password_hash").notNull(),
    /*
       Disabled rather than deleted. A departed operator's name has to keep
       resolving, because their events do not disappear when they do — an
       audit trail pointing at a deleted row is not an audit trail.
    */
    status: opsUserStatus("status").notNull().default("active"),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("ops_users_email_idx").on(sql`lower(${t.email})`)],
);

/**
 * Every state change an operator makes, and who made it.
 *
 * APPEND ONLY, and enforced by the database rather than by everybody
 * remembering. scripts/add-ops-identity.ts installs a trigger that raises on
 * UPDATE and on DELETE.
 *
 * A trigger and not a REVOKE, which would not have worked: the application
 * connects as this table's owner, an owner can grant itself back whatever was
 * revoked, and on a local superuser grants are bypassed outright. The trigger
 * applies to everyone, us included — which is the only version of append-only
 * worth having, because a history we can tidy up answers "who did it" with
 * "whoever tidied it last".
 *
 * Written inside the same transaction as the change it describes, by
 * lib/ops-audit. That is the whole design: a refund that succeeds without
 * leaving a record is not discouraged, it is impossible — either both land or
 * neither does.
 *
 * actor_email is a copy, not a join.
 *
 * It duplicates ops_users.email on purpose. The question this table answers is
 * "who did this, at the time they did it" — if an operator's address changes
 * in 2027, the 2026 rows must still read the way they read in 2026. The id is
 * there for joining; the email is there for the record.
 */
export const opsEvents = pgTable(
  "ops_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorId: uuid("actor_id")
      .notNull()
      .references(() => opsUsers.id),
    actorEmail: text("actor_email").notNull(),
    /** Dotted and stable, e.g. "booking.refund". Text, not an enum: the list
        grows with the console and a new verb should not need a migration. */
    action: text("action").notNull(),
    /** What kind of thing was touched, e.g. "booking", "expert". */
    entity: text("entity").notNull(),
    entityId: text("entity_id").notNull(),
    /*
       The two halves of the change, as they were. Small objects, only the
       fields that moved — a whole row snapshot would quietly copy a
       customer's details into a table nobody thinks of as holding them.
    */
    before: jsonb("before"),
    after: jsonb("after"),
    /** Free text where an action has a reason attached, e.g. a refund note. */
    note: text("note"),
    /*
       Where it was done from. Weak evidence on its own — an IP is not a
       person — but it is what turns "this was done twice" into "this was
       done twice from two different places", which is the question that
       actually gets asked after something goes wrong.
    */
    ip: text("ip"),
    userAgent: text("user_agent"),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("ops_events_at_idx").on(t.at),
    index("ops_events_entity_idx").on(t.entity, t.entityId),
    index("ops_events_actor_idx").on(t.actorId),
  ],
);


/**
 * A member's signed-in devices.
 *
 * The session used to be a signed token and nothing else: the cookie said
 * "customer X, expires on this date", and the server checked the signature.
 * Stateless, cheap, and unanswerable in exactly the way the ops console was —
 * there was no record that a session existed, so there was nothing to show a
 * member and nothing to revoke. Somebody who took over a phone number stayed
 * signed in for thirty days and neither we nor the member could see it, let
 * alone end it.
 *
 * So the token now names a SESSION rather than a customer, and this table
 * says whose it is. That indirection is the whole feature: a row that can be
 * revoked is a session that can be ended, and a row with a device and an IP
 * on it is a session a member can recognise as theirs or not.
 *
 * The cost is a database read where there was none. It is paid in the server
 * route, not in middleware — the edge still checks only the signature, which
 * is enough to bounce a stranger and cheap enough to do on every request.
 */
export const memberSessions = pgTable(
  "member_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    customerId: uuid("customer_id")
      .notNull()
      /* Dies with the customer: a session or a code that outlives the person
         it belongs to is not a record, it is a dangling key. */
      .references(() => customers.id, { onDelete: "cascade" }),
    /*
       WHEN IDENTITY WAS LAST PROVEN — not when the cookie was last sent.

       Presenting a cookie proves possession of a cookie. This is stamped only
       when somebody typed a code, which is what the sensitive screens ask
       for: reading a portfolio back, or moving the account onto a different
       number. A thirty-day session is right for looking at your bookings and
       wrong for downloading what you own, and one timestamp is the
       difference between those two.
    */
    verifiedAt: timestamp("verified_at", { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
    /*
       How the member recognises it. An IP is not a person and a user agent is
       self-reported, so neither decides anything — they exist so that "Chrome
       on Windows, Mumbai, two minutes ago" can be read by the one human who
       knows whether that was them.
    */
    ip: text("ip"),
    userAgent: text("user_agent"),
    /** Set, never deleted: a revoked session is evidence that it existed. */
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("member_sessions_customer_idx").on(t.customerId)],
);


/**
 * An expert's signed-in devices.
 *
 * The same change member_sessions was, made for the same reason and a turn
 * later. The expert token was stateless — the cookie said "expert X, expires
 * then", the server checked the signature, and nothing was stored. So "sign
 * out" deleted a cookie and the token stayed valid for thirty days, which
 * meant a borrowed or lost machine could not be cut off at all.
 *
 * An expert reads other people's portfolios. That is a stronger reason for
 * this than the member side had, not a weaker one, and it is only in second
 * place because members outnumber experts.
 *
 * No verifiedAt here, deliberately. Members have one because two screens ask
 * how recently identity was proven; the expert console has no such screen, and
 * a column nothing reads is a claim about enforcement that is not true.
 */
export const expertSessions = pgTable(
  "expert_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    expertId: uuid("expert_id")
      .notNull()
      /* Dies with the expert, like a member's session dies with them. */
      .references(() => experts.id, { onDelete: "cascade" }),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
    /* Recognisable, never authoritative — see the member table's note. */
    ip: text("ip"),
    userAgent: text("user_agent"),
    /** Set, never deleted: a revoked session is evidence that it existed. */
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("expert_sessions_expert_idx").on(t.expertId)],
);
