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
 *   3. The template — the exact message body, with variable slots, approved
 *                     one at a time and issued a template id. What is sent
 *                     must match what was approved; an edited word is a
 *                     rejected message, not a warning.
 *
 * Operators drop unregistered traffic. There is no test mode that reaches a
 * real handset, so this cannot be finished before the entity exists — the
 * same gate as live Razorpay keys.
 *
 * WHAT THIS FILE DOES ABOUT IT
 *
 * The provider call is written and ready. With no provider configured, a
 * development server prints the code to its own console and sign-in works end
 * to end; production with no provider throws rather than leaving somebody
 * waiting for a message nobody sent. The moment the three registrations are
 * done, four environment variables turn it on and nothing here changes.
 */

export type Sms = {
  /** E.164, from lib/phone. Never a number a person typed. */
  to: string;
  /** What the member reads. Must match the approved DLT template exactly. */
  body: string;
  /**
   * The template's variable slots, by name.
   *
   * Named rather than positional because that is what the provider wants and
   * what the DLT panel defines: these names must match the ones on the
   * approved template, or the message is rejected for not matching what was
   * registered.
   */
  vars: Record<string, string>;
};

/** Where MSG91's Flow API lives. Overridable, which is also how it is tested. */
const MSG91_ENDPOINT = "https://control.msg91.com/api/v5/flow/";

/**
 * Hand the message to the provider.
 *
 * MSG91 by name, because a provider's request shape is not guessable and one
 * written from memory produces code that typechecks, deploys, and silently
 * delivers nothing. This is built from their published Flow API
 * documentation; the ambiguity that documentation left is handled below.
 *
 * TWO THINGS THAT WOULD OTHERWISE BITE
 *
 * 1. MSG91 answers HTTP 200 with `{"type":"error"}` in the body when a send
 *    fails — a wrong template id, an unregistered header, a number on the DND
 *    registry. Checking `res.ok` alone would report every one of those as
 *    sent, which is the worst available failure for this particular message:
 *    the member sits waiting, and the logs say it went. The body decides
 *    here; the status is only a second opinion.
 *
 * 2. Their own docs disagree about the template field. The published apidoc
 *    page says `flow_id`; their current documentation and client library say
 *    `template_id`. It was renamed and both are in circulation, so both are
 *    sent carrying the same value — guessing wrong means a 200 and no
 *    message, which is precisely the failure this function exists to avoid.
 */
async function deliver(sms: Sms): Promise<void> {
  const provider = process.env.SMS_PROVIDER?.trim().toLowerCase();

  if (!provider) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "No SMS provider is configured. A sign-in code cannot be delivered. " +
          "Set SMS_PROVIDER and the DLT details, or keep phone sign-in switched off.",
      );
    }

    /*
       Development only, and the one place a live code is ever written down.
       Guarded by NODE_ENV rather than by a flag somebody can forget: printing
       a working credential to a log is fine on a laptop and is an incident
       anywhere else.
    */
    console.info(`\n[sms] to ${sms.to}\n[sms] ${sms.body}\n`);
    return;
  }

  if (provider !== "msg91") {
    throw new Error(
      `SMS_PROVIDER is "${provider}", and only "msg91" is implemented. ` +
        `Unset it to fall back to the console in development.`,
    );
  }

  const authkey = process.env.SMS_API_KEY;
  const sender = process.env.SMS_SENDER_ID;
  const template = process.env.SMS_TEMPLATE_SIGNIN;

  /*
     Checked here rather than trusted, because every one of these missing
     produces a 200 with an error body — indistinguishable at a glance from a
     message that actually went.
  */
  const missing = [
    !authkey && "SMS_API_KEY",
    !sender && "SMS_SENDER_ID",
    !template && "SMS_TEMPLATE_SIGNIN",
  ].filter(Boolean);
  if (missing.length) {
    throw new Error(`SMS_PROVIDER is msg91 but ${missing.join(", ")} is not set`);
  }

  const res = await fetch(process.env.SMS_ENDPOINT || MSG91_ENDPOINT, {
    method: "POST",
    headers: {
      authkey: authkey!,
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({
      /* Both names, on purpose — see the note above. */
      template_id: template,
      flow_id: template,
      sender,
      recipients: [
        {
          /* Country code, no plus: 919876543210, not +919876543210. */
          mobiles: sms.to.replace(/^\+/, ""),
          ...sms.vars,
        },
      ],
    }),
    /* A send that has not answered in ten seconds has not happened. */
    signal: AbortSignal.timeout(10_000),
  });

  const raw = await res.text();
  let parsed: { type?: string; message?: string } = {};
  try {
    parsed = JSON.parse(raw) as typeof parsed;
  } catch {
    /* A body that is not JSON is not a success, whatever the status says. */
  }

  if (!res.ok || parsed.type !== "success") {
    /*
       The provider's own message, trimmed. It names the cause — an
       unregistered header, a template id that does not match, a number on
       DND — and none of that is guessable from here.
    */
    throw new Error(
      `SMS refused (${res.status}): ${parsed.message ?? (raw.slice(0, 200) || "no body")}`,
    );
  }
}

/**
 * The sign-in message.
 *
 * Short, and it says the two things a code message has to say: how long it
 * lasts, and that nobody at Landline will ever ask for it. The second line is
 * not filler — a member who has been told this once is much harder to talk
 * out of their code over the phone, and portfolio access is worth a phone
 * call to somebody.
 *
 * THE BODY AND THE VARIABLES MUST AGREE WITH THE DLT TEMPLATE.
 *
 * `body` is what the console prints in development and what gets registered;
 * `vars` fills the slots the provider substitutes. Changing the wording here
 * without re-registering the template is a rejected message, so the two live
 * together rather than in two places that can drift apart.
 */
export function signInSms(code: string, minutes: number): Omit<Sms, "to"> {
  return {
    body:
      `${code} is your Landline sign-in code. It expires in ${minutes} minutes. ` +
      `Landline will never ask you for it.`,
    /* VAR1/VAR2 are MSG91's documented slot names; they must match the ones
       set on the approved template in the DLT panel. */
    vars: { VAR1: code, VAR2: String(minutes) },
  };
}

export async function sendSms(sms: Sms): Promise<void> {
  await deliver(sms);
}
