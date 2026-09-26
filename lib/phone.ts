/**
 * Indian mobile numbers, and one canonical spelling for each.
 *
 * A phone number people type is not a string, it is a dozen strings: with the
 * country code and without, with a leading zero, with spaces, with a hyphen
 * somebody's bank taught them to add. If sign-in matches on what was typed,
 * the member who booked as "98765 43210" and signs in as "+91 9876543210" is
 * a stranger to us. So everything that touches a number goes through here and
 * comes out as E.164 — +91 followed by ten digits, no spaces.
 *
 * INDIA ONLY, on purpose.
 *
 * Landline sells to Indian retail traders, prices in rupees, settles through
 * an Indian gateway and sends SMS through an Indian DLT registration. A
 * country picker would be a control with one usable option, which is the same
 * thing as no control — so the form shows +91 as a fixed prefix instead of a
 * dropdown that cannot go anywhere. When a second country is genuinely sold
 * to, this is the file that grows and the prefix becomes a picker.
 */

/** Mobile series in India: ten digits, first one 6 through 9. */
const INDIAN_MOBILE = /^[6-9]\d{9}$/;

/**
 * The canonical form, or null if this is not a number we can send to.
 *
 * Null is a real answer and the caller must handle it. Never guess at a
 * malformed number — a code texted to a number the member does not hold is
 * both a failed sign-in and somebody else's unexpected message.
 */
export function toE164(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");

  let local = digits;
  /* +91 98765 43210, 0091..., and 91 98765 43210 all arrive as 12 digits. */
  if (local.length === 12 && local.startsWith("91")) local = local.slice(2);
  /* The STD leading zero, still how a lot of people write their own number. */
  else if (local.length === 11 && local.startsWith("0")) local = local.slice(1);

  return INDIAN_MOBILE.test(local) ? `+91${local}` : null;
}

/**
 * For reading back to a member: +91 98765 43210.
 *
 * Grouped 5 and 5 because that is how the number is said aloud here, not
 * 3-3-4 as an American number would be. Anything we cannot parse is returned
 * untouched rather than mangled — an old free-text number in the database
 * should still be legible on a receipt.
 */
export function formatPhone(e164: string): string {
  const m = /^\+91(\d{5})(\d{5})$/.exec(e164);
  return m ? `+91 ${m[1]} ${m[2]}` : e164;
}

/**
 * The last two digits, for "we sent a code to a number ending 10".
 *
 * Enough for the member to recognise their own number, not enough to be worth
 * anything to somebody reading over their shoulder.
 */
export function phoneTail(e164: string): string {
  return e164.slice(-2);
}
