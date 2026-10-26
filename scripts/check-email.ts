import { loadEnv } from "./load-env";
loadEnv();

/**
 * Is email actually going to work?
 *
 * WHY A SCRIPT AND NOT A README PARAGRAPH. Setting Resend up has four parts
 * and three of them fail silently. The key can be wrong, revoked or from the
 * wrong account. EMAIL_FROM can point at a domain that was added but never
 * verified, or at a domain that is verified while a typo sends from a
 * different one. And the sandbox sender works just well enough to convince
 * you it is all configured: `onboarding@resend.dev` delivers, but only ever
 * to the address that owns the Resend account, so the first person to notice
 * is a customer who did not get a receipt.
 *
 * None of that shows up as an error anywhere in this codebase, because every
 * send is wrapped: a booking survives a failed confirmation by design. The
 * cost of that correct decision is that nothing tells you email is broken.
 * This does.
 *
 *   npm run check:email                  what is configured, and whether it works
 *   npm run check:email you@example.in   the same, then actually send one there
 *
 * It only ever READS, except for the test send, which needs an address on the
 * command line. Nothing here changes a setting.
 */

const KEY = process.env.RESEND_API_KEY?.trim();
const FROM = process.env.EMAIL_FROM?.trim();
const REPLY_TO = process.env.EMAIL_REPLY_TO?.trim();
const TO = process.argv[2]?.trim();

const ok = (s: string) => console.log(`  ok    ${s}`);
const bad = (s: string) => console.log(`  FAIL  ${s}`);
const warn = (s: string) => console.log(`  warn  ${s}`);
const note = (s: string) => console.log(`        ${s}`);

/** "Landline <hello@landline.in>" and "hello@landline.in" both give the domain. */
function domainOf(from: string): string | null {
  const angled = from.match(/<([^>]+)>/);
  const address = (angled ? angled[1] : from).trim();
  const at = address.lastIndexOf("@");
  return at === -1 ? null : address.slice(at + 1).toLowerCase();
}

type Domain = { id: string; name: string; status: string };

async function main() {
  console.log("");

  if (!KEY) {
    bad("RESEND_API_KEY is not set, so nothing can be delivered.");
    note("");
    note("In development that is fine and deliberate: every message prints to");
    note("the server console instead, and sign-in, booking and reminder flows");
    note("all complete. A production server with no key refuses to send rather");
    note("than printing a booking confirmation into a log.");
    note("");
    note("To make it real, in this order:");
    note("  1. Create a Resend account and add your sending domain.");
    note("  2. Put the DNS records it gives you on that domain. The DKIM and");
    note("     DMARC records are not optional — without them Gmail and Outlook");
    note("     will refuse or spam-bin the mail even though Resend reports a");
    note("     successful send.");
    note("  3. Wait for Resend to show the domain as verified.");
    note("  4. Set RESEND_API_KEY, and EMAIL_FROM to an address on that domain.");
    note("  5. Run this again.");
    console.log("");
    process.exitCode = 1;
    return;
  }

  ok(`RESEND_API_KEY is set (${KEY.slice(0, 7)}…, ${KEY.length} characters)`);
  if (!KEY.startsWith("re_")) {
    warn("Resend keys normally begin with 're_'. This one does not.");
  }

  /* Does the key authenticate at all, and what can it see? */
  let domains: Domain[] = [];
  try {
    const res = await fetch("https://api.resend.com/domains", {
      headers: { authorization: `Bearer ${KEY}` },
    });

    if (!res.ok) {
      /*
         Resend answers a bad key with 400 and a message, not the 401 you
         would expect — found by pointing this at a made-up key rather than
         assuming. So the message decides what to say, and the status is
         only reported.
      */
      const body = (await res.json().catch(() => ({}))) as { message?: string };
      const message = body.message ?? `Resend answered ${res.status}.`;

      bad(message);
      if (/api key/i.test(message)) {
        note("It is wrong, revoked, or from a different account. Make a new");
        note("one in the Resend dashboard under API Keys.");
      } else {
        note(`Status ${res.status} from GET /domains.`);
      }
      console.log("");
      /* exitCode rather than exit(): an immediate exit while the fetch
         socket is still closing trips a libuv assertion on Windows. */
      process.exitCode = 1;
      return;
    }

    const body = (await res.json()) as { data?: Domain[] };
    domains = body.data ?? [];
    ok(`the key works — Resend knows ${domains.length} domain(s)`);
  } catch (err) {
    bad("Could not reach api.resend.com.");
    note(err instanceof Error ? err.message : String(err));
    console.log("");
    process.exitCode = 1;
    return;
  }

  for (const d of domains) {
    const mark = d.status === "verified" ? "ok   " : "warn ";
    console.log(`  ${mark} ${d.name} — ${d.status}`);
  }

  /*
     THE SANDBOX TRAP. With EMAIL_FROM unset, lib/email falls back to
     onboarding@resend.dev, which sends successfully and is delivered only to
     the address that owns the Resend account. Everything looks configured
     and no customer receives anything.
  */
  if (!FROM) {
    warn("EMAIL_FROM is not set, so mail goes out as onboarding@resend.dev.");
    note("That sends, and delivers ONLY to the address that owns the Resend");
    note("account. It is fine for one test and is not a launch state.");
  } else {
    const domain = domainOf(FROM);
    if (!domain) {
      bad(`EMAIL_FROM (${FROM}) has no address in it.`);
      note('Use either "hello@landline.in" or "Landline <hello@landline.in>".');
    } else {
      const match = domains.find((d) => d.name.toLowerCase() === domain);
      if (!match) {
        bad(`EMAIL_FROM sends from ${domain}, which is not on this account.`);
        note("Resend refuses every send from a domain it does not hold. Add it,");
        note("or correct EMAIL_FROM to a domain listed above.");
      } else if (match.status !== "verified") {
        bad(`${domain} is on the account but its status is "${match.status}".`);
        note("Sends will be refused until it is verified. Finish its DNS records.");
      } else {
        ok(`EMAIL_FROM sends from ${domain}, which is verified`);
      }
    }
  }

  if (REPLY_TO) ok(`replies go to ${REPLY_TO}`);
  else warn("EMAIL_REPLY_TO is not set, so replies go to a no-reply address.");

  /* The only write in this script, and only when asked for by name. */
  if (!TO) {
    console.log("");
    note("Pass an address to send a real test message:");
    note("  npm run check:email you@example.in");
    console.log("");
    return;
  }

  console.log("");
  console.log(`  sending a test message to ${TO}…`);

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${KEY}`, "content-type": "application/json" },
    body: JSON.stringify({
      from: FROM ?? "Landline <onboarding@resend.dev>",
      ...(REPLY_TO ? { reply_to: REPLY_TO } : {}),
      to: TO,
      subject: "Landline — email is working",
      html:
        "<p>If you are reading this, Resend is configured correctly and " +
        "Landline can send booking confirmations, sign-in links and receipts.</p>" +
        "<p>Sent by <code>npm run check:email</code>.</p>",
    }),
  });

  const out = (await res.json().catch(() => ({}))) as { id?: string; message?: string };

  if (res.ok && out.id) {
    ok(`sent — Resend id ${out.id}`);
    note("Now go and look. If it is not in the inbox within a minute, check the");
    note("spam folder: landing there is a DKIM or DMARC problem, not a code one.");
  } else {
    bad(`Resend refused the send (${res.status}).`);
    note(out.message ?? JSON.stringify(out).slice(0, 200));
  }

  console.log("");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
