/**
 * Text messages, and the paperwork standing between this file and delivery.
 *
 * DLT, WHICH IS NOT OPTIONAL
 *
 * Under TRAI's TCCCPR every commercial sender to an Indian number registers
 * on a DLT platform run by the operators (Jio, Airtel, Vi, BSNL) before a
 * single message is delivered. Three separate registrations, in order:
 *
 *   1. The entity  — PAN, GST and business proof. Needs the company to exist.
 *   2. The header  — a six-character sender ID, e.g. LNDLNE. Transactional
 *                    headers are approved separately from promotional ones,
 *                    and a sign-in code must go out on a transactional one.
 *   3. The template — the exact message body, with {#var#} placeholders,
 *                     approved one template at a time and issued a template
 *                     id. What is sent must match what was approved; an
 *                     edited word is a rejected message, not a warning.
 *
 * Operators drop unregistered traffic. There is no test mode that reaches a
 * real handset, so this cannot be finished before the entity exists — the
 * same gate as live Razorpay keys.
 *
 * UNTIL THEN
 *
 * The flow is complete and testable without any of it. With no provider
 * configured, a development server prints the code to its own console and
 * the sign-in works end to end. Production with no provider throws, loudly,
 * because the alternative is a member waiting for a message nobody sent.
 */

export type Sms = {
  /** E.164, from lib/phone. Never a number a person typed. */
  to: string;
  /** What the member reads. Must match the approved DLT template exactly. */
  body: string;
  /** Substitutions for the {#var#} slots, in the order the template declares. */
  vars: string[];
};

/**
 * The provider seam. One function, deliberately.
 *
 * Every provider (MSG91, Kaleyra, Gupshup, Twilio's Indian route) wants a
 * different body shape, and the shape is not guessable from the outside —
 * writing one from memory produces code that typechecks, deploys, and
 * silently delivers nothing. So this stays a stub until somebody has the
 * provider's own documentation open, and it throws rather than pretending.
 *
 * What the call will need, all of it from the DLT registration above:
 *   SMS_PROVIDER      which provider, so this switch has something to match
 *   SMS_API_KEY       their key
 *   SMS_SENDER_ID     the approved six-character header
 *   SMS_TEMPLATE_SIGNIN  the approved template's id for the sign-in message
 */
async function deliver(sms: Sms): Promise<void> {
  const provider = process.env.SMS_PROVIDER;

  if (provider) {
    throw new Error(
      `SMS_PROVIDER is set to "${provider}" but no provider call is wired in lib/sms.ts. ` +
        `Unset it to fall back to the console in development, or implement the call.`,
    );
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "No SMS provider is configured. A sign-in code cannot be delivered. " +
        "Set SMS_PROVIDER and the DLT details, or keep phone sign-in switched off.",
    );
  }

  /*
     Development only, and the one place a live code is ever written down.
     Guarded by NODE_ENV above rather than by a flag somebody can forget:
     printing a working credential to a log is fine on a laptop and is an
     incident anywhere else.
  */
  console.info(`\n[sms] to ${sms.to}\n[sms] ${sms.body}\n`);
}

/**
 * The sign-in message.
 *
 * Short, and it says the two things a code message has to say: how long it
 * lasts, and that nobody at Landline will ever ask for it. The second line is
 * not filler — a member who has been told this once is much harder to talk
 * out of their code over the phone, and portfolio access is worth a phone
 * call to somebody.
 */
export function signInSms(code: string, minutes: number): Omit<Sms, "to"> {
  return {
    body:
      `${code} is your Landline sign-in code. It expires in ${minutes} minutes. ` +
      `Landline will never ask you for it.`,
    vars: [code, String(minutes)],
  };
}

export async function sendSms(sms: Sms): Promise<void> {
  await deliver(sms);
}
