import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq, ne, and, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { customers } from "@/lib/db/schema";
import { mintEmailChange, mintPhoneChange, verifyPhoneChange } from "@/lib/member-auth";
import { issueCodeTo, spendCode } from "@/lib/member-code";
import { toE164, formatPhone } from "@/lib/phone";
import {
  activeSessions,
  currentCustomerId,
  readSession,
  revokeAllSessions,
  revokeSession,
} from "@/lib/member-session";
import { istDateTime } from "@/lib/format";
import { emailChangeConfirm, sendRaw } from "@/lib/email";
import { rethrowIfNavigation } from "@/lib/nav";
import MemberBar from "@/components/MemberBar";

export const metadata: Metadata = { title: "Your details — Landline", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function Profile({
  searchParams,
}: {
  searchParams: Promise<{
    saved?: string;
    sent?: string;
    changed?: string;
    changing?: string;
    error?: string;
  }>;
}) {
  const { saved, sent, changed, changing, error } = await searchParams;

  const customerId = await currentCustomerId();
  if (!customerId) redirect("/member/login");

  let customer;
  try {
    [customer] = await db.select().from(customers).where(eq(customers.id, customerId)).limit(1);
    if (!customer) redirect("/member/login");
  } catch (err) {
    rethrowIfNavigation(err);
    return (
      <div className="wrap bp-page member">
        <div className="bp-panel">
          <h1>Not available right now</h1>
          <p className="bp-muted">We could not reach your account. Please try again shortly.</p>
        </div>
      </div>
    );
  }

  async function saveDetails(formData: FormData) {
    "use server";
    const id = await currentCustomerId();
    if (!id) redirect("/member/login");

    const name = String(formData.get("name") ?? "").trim();

    if (name.length < 1 || name.length > 120) {
      redirect("/member/profile?error=name");
    }

    /*
       NAME ONLY. The phone used to be saved here too, in the same
       unverified one-click form, which stopped being acceptable the moment
       the phone became how people sign in.

       What that allowed: anyone holding a session — a borrowed laptop, a
       stolen cookie, one sign-in off a swapped SIM — could point the
       account at their own number and keep it. The real owner could not
       undo it, because the way back in was the number that had just been
       taken away. A typo did the same damage.

       It moved to changePhone below, which proves the new number answers
       before it becomes the way in.
    */
    await db.update(customers).set({ name }).where(eq(customers.id, id));

    redirect("/member/profile?saved=1");
  }

  async function requestEmailChange(formData: FormData) {
    "use server";
    const id = await currentCustomerId();
    if (!id) redirect("/member/login");

    const next = String(formData.get("email") ?? "").trim().toLowerCase();
    if (!/.+@.+\..+/.test(next) || next.length > 200) {
      redirect("/member/profile?error=email");
    }

    const [me] = await db.select().from(customers).where(eq(customers.id, id)).limit(1);
    if (!me) redirect("/member/login");
    if (me.email.toLowerCase() === next) redirect("/member/profile?error=same");

    // Taken addresses are checked here AND again on confirm — someone else
    // could claim it in between.
    const [clash] = await db
      .select({ id: customers.id })
      .from(customers)
      .where(and(sql`lower(${customers.email}) = ${next}`, ne(customers.id, id)))
      .limit(1);

    // The same answer either way, so this page cannot be used to discover
    // which addresses already have an account.
    if (!clash) {
      const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
      const url = `${base}/api/member/profile/email?t=${await mintEmailChange(id, next)}`;
      try {
        // Sent to the NEW address. Confirming it is what proves it is reachable.
        await sendRaw({ to: next, ...emailChangeConfirm({ customerName: me.name, url }) });
      } catch (err) {
        console.error("[profile] email change send failed", err);
      }
    }

    redirect("/member/profile?sent=1");
  }

  /**
   * Step one: ask for a new number, and send a code TO IT.
   *
   * Two separate proofs are required and they prove different things. The
   * fresh session proves the member is the one asking; the code proves
   * somebody is holding the number they asked for. Either alone is the
   * hole: a session alone is the takeover above, and a code alone would
   * let a stranger claim any number they happen to own.
   */
  async function startPhoneChange(formData: FormData) {
    "use server";
    const current = await readSession();
    if (!current) redirect("/member/login");

    /* Changing the credential is the most sensitive thing on this page, so
       a thirty-day cookie is not enough on its own. */
    if (!current.fresh) {
      redirect("/member/verify?next=" + encodeURIComponent("/member/profile"));
    }

    const wanted = toE164(String(formData.get("phone") ?? ""));
    if (!wanted) redirect("/member/profile?error=phone");

    /* One number, one account — the unique index would refuse this anyway,
       but failing here says something a member can act on. */
    const [taken] = await db
      .select({ id: customers.id })
      .from(customers)
      .where(and(eq(customers.phone, wanted), ne(customers.id, current.customerId)))
      .limit(1);
    if (taken) redirect("/member/profile?error=taken-phone");

    /* Refuse the step rather than claim a code was sent that was not. */
    const sent = await issueCodeTo(current.customerId, wanted);
    if (!sent) redirect("/member/profile?error=wait");

    const token = await mintPhoneChange(current.customerId, wanted);
    redirect("/member/profile?changing=" + encodeURIComponent(token));
  }

  /** Step two: the code that went to the new number. */
  async function confirmPhoneChange(formData: FormData) {
    "use server";
    const current = await readSession();
    if (!current) redirect("/member/login");

    const pending = await verifyPhoneChange(String(formData.get("token") ?? ""));
    /* Signed over the number as well as the customer, so the token from one
       request cannot be replayed to claim a different number. */
    if (!pending || pending.customerId !== current.customerId) {
      redirect("/member/profile?error=phone");
    }

    const result = await spendCode(current.customerId, String(formData.get("code") ?? ""));
    if (result !== "ok") {
      redirect("/member/profile?error=code&changing=" + encodeURIComponent(String(formData.get("token") ?? "")));
    }

    try {
      await db
        .update(customers)
        .set({ phone: pending.phone })
        .where(eq(customers.id, current.customerId));
    } catch {
      /* Somebody claimed it between the check and here. */
      redirect("/member/profile?error=taken-phone");
    }

    /*
       Every OTHER session goes.

       The credential just changed, and the most likely reason somebody
       changes it in a hurry is that they think another device should not
       have it. Keeping this one signed in avoids making them prove
       themselves twice in a row; ending the rest means a session opened
       against the old number cannot outlive it.
    */
    const others = await activeSessions(current.customerId);
    for (const row of others) {
      if (row.id !== current.sessionId) await revokeSession(current.customerId, row.id);
    }

    redirect("/member/profile?saved=phone");
  }

  /*
     Ending a session is not a sensitive action and deliberately asks for
     nothing extra.

     Everything else on this page guards against somebody who should not be
     here. This guards against the possibility that they already are — and a
     member who suspects that must be able to act on it in one click, from
     whatever device they happen to be holding. A confirmation step here
     protects nobody: the worst an attacker achieves by signing sessions out
     is telling the member something is wrong.
  */
  async function endSession(formData: FormData) {
    "use server";
    const current = await readSession();
    if (!current) redirect("/member/login");

    const target = String(formData.get("sessionId") ?? "");
    await revokeSession(current.customerId, target);

    /* Signing out the one you are using should land you at the door, not
       on a page that no longer knows who you are. */
    redirect(target === current.sessionId ? "/member/login" : "/member/profile?ended=1");
  }

  async function endEverything() {
    "use server";
    const current = await readSession();
    if (!current) redirect("/member/login");
    await revokeAllSessions(current.customerId);
    redirect("/member/login");
  }

  const session = await readSession();
  const sessions = session ? await activeSessions(session.customerId) : [];

  return (
    <div className="wrap bp-page member">
      <MemberBar name={customer.name} current="profile" />

      <p className="ops-crumb">
        <Link href="/member" className="ops-link">
          ← Your console
        </Link>
      </p>

      <h1 className="ops-h1">Your details</h1>
      <p className="bp-muted ops-lede">
        What your expert sees before a call, and where confirmations are sent.
      </p>

      {saved ? <p className="member-done">Saved.</p> : null}
      {changed ? <p className="member-done">Your email address has been updated.</p> : null}
      {sent ? (
        <p className="member-done">
          If that address is available, a confirmation link is on its way to it. The change takes
          effect once you follow that link.
        </p>
      ) : null}
      {error === "name" ? <p className="bp-error">Please give a name.</p> : null}
      {error === "phone" ? <p className="bp-error">That phone number is too long.</p> : null}
      {error === "email" ? <p className="bp-error">That does not look like an email address.</p> : null}
      {error === "same" ? <p className="bp-error">That is already your email address.</p> : null}
      {error === "taken" ? (
        <p className="bp-error">That address could not be used. Try another.</p>
      ) : error === "phone" ? (
        <p className="bp-error">Enter a ten-digit Indian mobile number.</p>
      ) : error === "taken-phone" ? (
        <p className="bp-error">That number is already on another Landline account.</p>
      ) : error === "wait" ? (
        <p className="bp-error">
          A code was just sent. Wait a minute before asking for another.
        </p>
      ) : error === "code" ? (
        <p className="bp-error">That code is not right. Check the digits and try again.</p>
      ) : saved === "phone" ? (
        <p className="bp-chosen" style={{ display: "block" }}>
          Your number is updated. Other devices have been signed out.
        </p>
      ) : null}

      <section className="member-section">
        <form action={saveDetails} className="bp-panel">
          <h2 className="member-h2">Your name</h2>
          <label className="bp-field">
            <span>Name</span>
            <input name="name" defaultValue={customer.name} autoComplete="name" required />
          </label>
          <button className="btn-primary" type="submit">
            Save
          </button>
        </form>
      </section>

      {/*
        The number, in its own panel and its own flow.

        It used to be a second field on the form above: type anything, press
        Save, done. That was fine while the phone was a way to reach somebody
        and became account takeover the day it became the way in — change the
        number, and the person it belonged to can never sign in again.

        Two steps now, proving two different things. The session says it is
        the member asking. The code, sent to the NEW number, says somebody is
        holding it. A typo fails at the second step instead of locking
        somebody out permanently.
      */}
      <section className="member-section">
        {changing ? (
          <form action={confirmPhoneChange} className="bp-panel">
            <h2 className="member-h2">Confirm your new number</h2>
            <p className="bp-muted" style={{ marginBottom: 14 }}>
              We texted a code to the new number. Enter it to finish — the change only takes
              effect once it answers.
            </p>
            <input type="hidden" name="token" value={changing} />
            <label className="bp-field">
              <span>Six-digit code</span>
              <input
                name="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="000000"
                required
              />
            </label>
            <button className="btn-primary" type="submit">
              Confirm
            </button>
          </form>
        ) : (
          <form action={startPhoneChange} className="bp-panel">
            <h2 className="member-h2">Mobile number</h2>
            <p className="bp-muted" style={{ marginBottom: 14 }}>
              This is how you sign in. Currently{" "}
              <b>{customer.phone ? formatPhone(customer.phone) : "not set"}</b>. Changing it
              sends a code to the new number first, and signs out your other devices.
            </p>
            <label className="bp-field">
              <span>New mobile number</span>
              <div className="bp-phone">
                <span className="bp-phone-cc">+91</span>
                <input name="phone" inputMode="numeric" placeholder="98765 43210" required />
              </div>
            </label>
            <button className="btn-primary" type="submit">
              Send a code to that number
            </button>
          </form>
        )}
      </section>

      <section className="member-section">
        <form action={requestEmailChange} className="bp-panel">
          <h2 className="member-h2">Email address</h2>
          <p className="bp-muted" style={{ marginBottom: 14 }}>
            Where receipts and confirmations are sent — you sign in with your phone, not this.
            A change only takes effect once you confirm it from the new address. Currently{" "}
            <b>{customer.email}</b>.
          </p>
          <label className="bp-field">
            <span>New email</span>
            <input type="email" name="email" placeholder="you@example.com" />
          </label>
          <button className="ops-btn" type="submit">
            Send confirmation link
          </button>
        </form>
      </section>

      {/*
        Where you are signed in.

        The session used to be a signed cookie and nothing more, so there was
        nothing to list and nothing to end: somebody who took over a phone
        number stayed signed in for thirty days, invisibly. This panel is the
        point of that change — a member is the only person who can look at
        "Chrome on Windows, two minutes ago" and know whether it was them.

        The IP is shown small and stated as approximate, because it is a hint
        and not a person. Nothing here decides anything; it exists to be
        recognised or not recognised by the one human who can tell.
      */}
      <section className="member-section">
        <div className="bp-panel">
          <h2 className="member-h2">Where you're signed in</h2>
          <p className="bp-muted" style={{ marginBottom: 14 }}>
            Don&rsquo;t recognise one? End it. If more than one looks wrong, end everything and
            sign in again — that is the fastest way to lock somebody out.
          </p>

          <ul className="member-sessions">
            {sessions.map((row) => (
              <li key={row.id} className="member-session">
                <div>
                  <p className="member-session-what">
                    {describeAgent(row.userAgent)}
                    {row.id === session?.sessionId ? (
                      <span className="pill ok">this device</span>
                    ) : null}
                  </p>
                  <p className="member-session-when">
                    Last used {istDateTime(row.lastSeenAt)} IST
                    {row.ip ? ` · around ${row.ip}` : ""}
                  </p>
                </div>
                <form action={endSession}>
                  <input type="hidden" name="sessionId" value={row.id} />
                  <button className="ops-link" type="submit">
                    End
                  </button>
                </form>
              </li>
            ))}
          </ul>

          <form action={endEverything}>
            <button className="ops-btn" type="submit">
              End every session
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}

/**
 * A user agent, as something a person recognises.
 *
 * Self-reported and easily faked, which is fine: this is not evidence, it
 * is a label a member reads to decide whether the session was theirs. Kept
 * coarse on purpose — the full string is unreadable, and a member deciding
 * "that is not my phone" needs the browser and the platform, not a version
 * number.
 */
function describeAgent(ua: string | null): string {
  if (!ua) return "Unknown device";

  const browser =
    /\bEdg\//.test(ua) ? "Edge"
    : /\bOPR\//.test(ua) ? "Opera"
    : /\bChrome\//.test(ua) ? "Chrome"
    : /\bFirefox\//.test(ua) ? "Firefox"
    : /\bSafari\//.test(ua) ? "Safari"
    : "A browser";

  const platform =
    /\bAndroid\b/.test(ua) ? "Android"
    : /\b(iPhone|iPad|iOS)\b/.test(ua) ? "iPhone or iPad"
    : /\bWindows\b/.test(ua) ? "Windows"
    : /\bMac OS X\b/.test(ua) ? "Mac"
    : /\bLinux\b/.test(ua) ? "Linux"
    : "an unknown device";

  return `${browser} on ${platform}`;
}
