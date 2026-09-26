import { toE164 } from "@/lib/phone";

/**
 * Who paid, as Razorpay verified them.
 *
 * A phone number proves somebody holds a SIM. A captured payment proves a
 * bank or a UPI app authenticated somebody against an instrument in their
 * name — a much stronger claim about a person, made by an institution that
 * does that for a living, and one Landline gets for free on every booking.
 *
 * It already arrived, in `payments.raw`. Sitting in a jsonb blob nobody
 * queries is the same as not having it: the question this answers — is the
 * person disputing this charge the person who made it — gets asked months
 * later by somebody who will not be writing json path expressions to find
 * out.
 *
 * WHAT IS DELIBERATELY NOT TAKEN
 *
 * The card number, the CVV, the bank credentials. Razorpay holds those and is
 * certified to; taking a copy would move Landline inside a compliance regime
 * it has no reason to be in, to store something it can never use. Last four
 * digits and a UPI handle are what a human needs to recognise their own
 * instrument, and neither is enough to charge anybody.
 */

export type Payer = {
  method: string | null;
  /** Last four of the card, or the UPI handle. Recognisable, not usable. */
  instrument: string | null;
  contact: string | null;
  email: string | null;
};

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

/**
 * Read the payer facts out of a Razorpay payment entity.
 *
 * Defensive about shape throughout. This is somebody else's payload and the
 * fields present vary by method — a UPI payment has no card object, a
 * netbanking one has neither — so every read is optional and a missing field
 * is null rather than a crash in a webhook that must not fail.
 */
export function readPayer(entity: unknown): Payer {
  if (typeof entity !== "object" || entity === null) {
    return { method: null, instrument: null, contact: null, email: null };
  }

  const e = entity as Record<string, unknown>;
  const card = (e.card ?? null) as Record<string, unknown> | null;

  const last4 = card ? str(card.last4) : null;
  const network = card ? str(card.network) : null;

  return {
    method: str(e.method),
    /* "Visa ····4242" or "gaurav@okhdfcbank" — whichever the member would
       recognise as theirs at a glance. */
    instrument: last4 ? [network, `····${last4}`].filter(Boolean).join(" ") : str(e.vpa),
    /*
       Normalised where it parses, so it can be compared with the account's
       own number rather than eyeballed. Razorpay sends "+919876543210",
       "9876543210" and sometimes "91-9876543210" for the same person.
    */
    contact: str(e.contact) ? (toE164(String(e.contact)) ?? str(e.contact)) : null,
    email: str(e.email),
  };
}

/**
 * Whether the payer's verified number is the account's number.
 *
 * `null` when either side is missing — an unknown answer, not a negative one.
 * A mismatch is NOT fraud and must never be treated as such: people pay for
 * their parents, spouses pay for each other, and somebody paying from a work
 * UPI handle is doing nothing wrong. It is simply the first thing worth
 * looking at when a charge is disputed, and the last thing worth guessing
 * about when it is not.
 */
export function contactMatches(payerContact: string | null, accountPhone: string | null): boolean | null {
  if (!payerContact || !accountPhone) return null;
  return toE164(payerContact) === toE164(accountPhone);
}
