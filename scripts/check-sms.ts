import { loadEnv } from "./load-env";
loadEnv();

import { CODE_MINUTES } from "../lib/member-auth";
import { sendSms, signInSms } from "../lib/sms";
import { toE164 } from "../lib/phone";

/**
 * Is phone sign-in actually going to work?
 *
 * The companion to check-email, and the same argument applies with more
 * force: phone is the FRONT DOOR. Email is a second way in; if SMS is
 * misconfigured in production, nobody signs in at all.
 *
 * It is also harder to get right than email, because four separate things
 * have to agree and only the provider can tell you which one does not: the
 * entity registered on the DLT portal, the header approved against it, the
 * content template approved against that header, and the flow on MSG91 that
 * maps to the template. Any mismatch produces a refusal naming the cause,
 * and lib/sms already surfaces that message rather than swallowing it.
 *
 *   npm run check:sms                 what is configured, and what must match
 *   npm run check:sms 9876543210      the same, then actually send a code there
 *
 * The send is real. It costs a message and it goes to a real handset, so it
 * only happens when a number is named on the command line.
 */

const PROVIDER = process.env.SMS_PROVIDER?.trim().toLowerCase();
const KEY = process.env.SMS_API_KEY?.trim();
const SENDER = process.env.SMS_SENDER_ID?.trim();
const TEMPLATE = process.env.SMS_TEMPLATE_SIGNIN?.trim();
const TO = process.argv[2]?.trim();

const ok = (s: string) => console.log(`  ok    ${s}`);
const bad = (s: string) => console.log(`  FAIL  ${s}`);
const warn = (s: string) => console.log(`  warn  ${s}`);
const note = (s: string) => console.log(`        ${s}`);

async function main() {
  console.log("");

  /*
     The exact text that has to be approved on the DLT portal, printed from
     the function that sends it. Written out rather than described, because
     the template is matched character by character and a paraphrase in a
     README is how the two drift apart.
  */
  const sample = signInSms("123456", CODE_MINUTES);
  console.log("  The message this sends, with the slots marked:");
  console.log("");
  console.log(`    ${sample.body.replace("123456", "##VAR1##").replace(String(CODE_MINUTES), "##VAR2##")}`);
  console.log("");
  note("Register that on the DLT portal exactly as written, and name the two");
  note("variables VAR1 and VAR2 on the MSG91 flow. The code fills VAR1 with");
  note("the digits and VAR2 with the minutes; different names send a message");
  note("with empty slots, which the provider accepts and nobody can read.");
  console.log("");

  if (!PROVIDER) {
    bad("SMS_PROVIDER is not set, so no code can be delivered.");
    note("");
    note("In development that is deliberate: the code prints to the server");
    note("console and sign-in completes. A production server with no provider");
    note("throws rather than leaving somebody at a form that never answers.");
    note("");
    note("To make it real, in this order. The first step takes weeks, so start");
    note("it before you need it:");
    note("  1. Register as a Principal Entity on a telecom DLT portal. This");
    note("     needs the registered business: PAN, GST and incorporation");
    note("     documents. It cannot be done before the entity exists.");
    note("  2. Register a Header (sender id) against that entity. Six");
    note("     alphanumeric characters for a transactional header.");
    note("  3. Get the content template above approved against that header.");
    note("  4. On MSG91: map your DLT entity id to the header, then create a");
    note("     flow from the approved template. That gives you the flow id.");
    note("  5. Set SMS_PROVIDER=msg91, SMS_API_KEY, SMS_SENDER_ID and");
    note("     SMS_TEMPLATE_SIGNIN, then run this again with your number.");
    console.log("");
    process.exitCode = 1;
    return;
  }

  if (PROVIDER !== "msg91") {
    bad(`SMS_PROVIDER is "${PROVIDER}", and only "msg91" is implemented.`);
    note("Unset it to fall back to the console in development, or add the");
    note("provider to lib/sms.");
    console.log("");
    process.exitCode = 1;
    return;
  }
  ok("SMS_PROVIDER is msg91");

  const missing = [
    !KEY && "SMS_API_KEY",
    !SENDER && "SMS_SENDER_ID",
    !TEMPLATE && "SMS_TEMPLATE_SIGNIN",
  ].filter(Boolean) as string[];

  if (missing.length) {
    bad(`${missing.join(", ")} not set.`);
    note("Every one of these missing produces a 200 with an error body from");
    note("MSG91, which is indistinguishable at a glance from a message that");
    note("actually went. lib/sms refuses rather than guessing.");
    console.log("");
    process.exitCode = 1;
    return;
  }

  ok(`SMS_API_KEY is set (${KEY!.slice(0, 6)}…)`);
  ok(`SMS_TEMPLATE_SIGNIN is ${TEMPLATE}`);

  /* A transactional header is six alphanumeric characters. A wrong one is
     refused by the operator, not by MSG91, so it fails late. */
  if (/^[A-Za-z0-9]{6}$/.test(SENDER!)) {
    ok(`SMS_SENDER_ID is ${SENDER}`);
  } else {
    warn(`SMS_SENDER_ID is "${SENDER}", which is not six alphanumeric characters.`);
    note("Indian transactional headers are six. If the operator approved a");
    note("different shape, ignore this.");
  }

  if (!TO) {
    console.log("");
    note("Pass a number to send a real code to it:");
    note("  npm run check:sms 9876543210");
    console.log("");
    return;
  }

  const e164 = toE164(TO);
  if (!e164) {
    bad(`"${TO}" is not a mobile number this accepts.`);
    note("Ten digits, or +91 and ten digits.");
    console.log("");
    process.exitCode = 1;
    return;
  }

  console.log("");
  console.log(`  sending a real code to ${e164}…`);

  try {
    await sendSms({ to: e164, ...signInSms("000000", CODE_MINUTES) });
    ok("MSG91 accepted it");
    note("Now look at the handset. Accepted is not delivered: a number on DND,");
    note("or a header the operator has not bound to this template, is refused");
    note("downstream and never reaches you.");
  } catch (err) {
    bad(err instanceof Error ? err.message : String(err));
    note("");
    note("That message is the provider's own and it names the cause. The four");
    note("that account for most of them:");
    note("  template id not found      the flow id is wrong, or not yours");
    note("  header not associated      the sender id is not bound to that");
    note("                             template on the DLT portal");
    note("  entity not registered      the PE id is not mapped on MSG91");
    note("  invalid authkey            SMS_API_KEY is wrong or revoked");
    process.exitCode = 1;
  }

  console.log("");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
