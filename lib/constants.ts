/** Bump when the disclaimer text changes; consents record the version they accepted. */
export const DISCLAIMER_VERSION = "2026-09-08";

/** How long a slot is reserved while the customer pays. */
export const HOLD_MINUTES = 10;

/**
 * The price list. One source of truth — the site, the order routes and the
 * ops console all read these, so a price can never be right in one place and
 * wrong in another.
 *
 * Set by Gaurav on 8 September 2026. Two things recorded in
 * docs/plans/2026-09-08-membership-and-pricing-design.md and knowingly
 * shipped as they stand:
 *
 *   - four quarterly passes (18,00,00 paise) cost LESS than one annual, for
 *     identical coverage;
 *   - the bundle sells calls at 3,333 rupees against a 5,499 list price, a
 *     39% discount, which is the widest gap in the ladder.
 */
export const SINGLE_CALL_PAISE = 549900;

export const BUNDLE_DAYS = 60;
export const BUNDLE_CREDITS = 3;
export const BUNDLE_PRICE_PAISE = 999900;
export const BUNDLE_PER_CALL_PAISE = Math.round(BUNDLE_PRICE_PAISE / BUNDLE_CREDITS);

/**
 * Passes are unlimited and have NO credit count. A pass bought once upfront
 * is a payment, not a mandate, which is how this sidesteps the RBI e-mandate
 * framework that stalled the monthly tier.
 */
export const MEMBERSHIP_TIERS = {
  quarterly: { label: "Quarterly pass", pricePaise: 4500000, days: 90 },
  annual: { label: "Annual pass", pricePaise: 24500000, days: 365 },
} as const;

export type MembershipTierName = keyof typeof MEMBERSHIP_TIERS;

/**
 * The expert's cut, in basis points. 8000 = 80%.
 *
 * A SHARE, NOT A FLAT AMOUNT, and that is not tidying for its own sake. It
 * used to be a fixed number of paise, which is indistinguishable from a share
 * for exactly as long as every session costs the same. Products ended that:
 * an expert can now sell a ₹5,499 audit and a ₹1,999 second opinion, and a
 * flat ₹4,399 payout would have paid them more than the customer paid for the
 * shorter one.
 *
 * Basis points rather than 0.8, because money and binary floating point
 * should not meet. 8000/10000 is exact; 0.8 is not.
 *
 * WHAT IT IS APPLIED TO is in lib/payouts: the product's price, not the
 * amount charged. A session covered by a pass records amountPaise = 0, and a
 * share of nothing is not what an expert is owed for an hour of work.
 *
 * Read by rateForSession() and written into expert_payouts the moment a
 * session is marked complete. Frozen there on purpose — the suite proves
 * changing this never rewrites what was already earned, because somebody who
 * worked under the old rate earned the old rate. So the first completed
 * session locks in whatever this is; override with EXPERT_SHARE_BPS before
 * then, not before launch.
 */
export const EXPERT_SHARE_BPS = Number(process.env.EXPERT_SHARE_BPS ?? 8000);

/**
 * What a session may be priced at, either end.
 *
 * Here rather than in one console, because three places now need the same
 * answer: the application form where somebody proposes a rate, the expert
 * console where they change it, and the ops console where it is reviewed.
 * Three copies of a bound is three chances for them to disagree, and the
 * one that disagrees is the one that lets a ₹5 session through.
 *
 * The floor is not zero on purpose. A free session is a different product
 * with different tax and different expectations, and nobody has decided to
 * offer one.
 */
export const PRICE_MIN_PAISE = 50_000;
export const PRICE_MAX_PAISE = 5_000_000;

/**
 * A pass is bought outright, not auto-renewed, so a member has to actively
 * decide to pay again. The prompt IS the renewal mechanism — without it they
 * simply lapse.
 */
export const RENEWAL_WINDOW_DAYS = 30;

/**
 * Minimum gap between sign-in emails to one address. The response to the form
 * is identical either way, so a throttled request is indistinguishable from a
 * sent one and reveals nothing.
 */
export const SIGN_IN_THROTTLE_SECONDS = 60;

/** Intake payloads are deleted this long after the call. */
export const INTAKE_RETENTION_DAYS = 90;

/**
 * The address on the site. Placeholder until the domain has mail on it —
 * change it here and the footer, and anywhere else that grows a contact
 * link, follows.
 */
export const CONTACT_EMAIL = "hello@landline.in";
