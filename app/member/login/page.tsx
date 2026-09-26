import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { customers } from "@/lib/db/schema";
import { mintLink } from "@/lib/member-auth";
import { SIGN_IN_THROTTLE_SECONDS } from "@/lib/constants";
import { memberSignInLink, sendRaw } from "@/lib/email";
import { turnstileSiteKey } from "@/lib/turnstile";
import PhoneSignIn from "@/components/PhoneSignIn";
import Wordmark from "@/components/Wordmark";

export const metadata: Metadata = { title: "Sign in — Landline", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * The front door.
 *
 * A phone number and a code by default; the emailed link kept behind ?email=1
 * for members who predate phone sign-in and for anyone whose number has
 * changed. Two routes to one session cookie — nothing downstream of here can
 * tell which door somebody came through.
 *
 * Dressed as the site rather than as the console. The console is dense on
 * purpose because it is operated, but this page is read once by somebody who
 * is not yet certain they are in the right place, and it is the only screen
 * where the brand has to do that reassuring on its own.
 */
export default async function MemberLogin({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; email?: string; expired?: string; out?: string }>;
}) {
  const { sent, email: emailRoute, expired, out } = await searchParams;

  async function requestLink(formData: FormData) {
    "use server";
    const email = String(formData.get("email") ?? "").trim();

    if (email) {
      try {
        const [customer] = await db
          .select()
          .from(customers)
          .where(sql`lower(${customers.email}) = ${email.toLowerCase()}`)
          .limit(1);

        // One link per minute per address. Without this, anyone who knows a
        // member's email can have Landline mail them on demand, forever.
        const recent =
          customer?.lastLinkSentAt &&
          Date.now() - customer.lastLinkSentAt.getTime() < SIGN_IN_THROTTLE_SECONDS * 1000;

        if (customer && !recent) {
          const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
          const url = `${base}/api/member/session?t=${await mintLink(customer.id)}`;
          await sendRaw({
            to: customer.email,
            ...memberSignInLink({ customerName: customer.name, url }),
          });
          await db
            .update(customers)
            .set({ lastLinkSentAt: new Date() })
            .where(eq(customers.id, customer.id));
        }
      } catch (err) {
        console.error("[member] sign-in link failed", err);
      }
    }

    // Always the same answer, whether or not the address is known — otherwise
    // this page tells a stranger who your customers are.
    redirect("/member/login?email=1&sent=1");
  }

  return (
    <main className="site signin">
      <div className="signin-col">
        <Wordmark className="logo signin-mark" as="p" sub="os" />

        {/*
          Signing out is not the same as being timed out, and the page
          should not imply something went wrong. One line, past tense, no
          apology.
        */}
        {out ? (
          <p className="signin-note" role="status">
            You are signed out. That session has been ended on this device.
          </p>
        ) : null}

        {expired ? (
          <p className="signin-note" role="status">
            That sign-in link has expired. Links last 30 minutes — here is a fresh way in.
          </p>
        ) : null}

        {emailRoute ? (
          <div className="signin-body">
            <h1 className="signin-h">Sign in by email</h1>
            <p className="signin-sub">
              Enter the address you booked with. We will send a link — no password.
            </p>

            {sent ? (
              <p className="signin-note" role="status">
                If that address has a Landline account, a sign-in link is on its way. It expires in
                30 minutes.
              </p>
            ) : null}

            <form action={requestLink} className="signin-form">
              <label className="signin-label" htmlFor="email">
                Email address
              </label>
              <input
                id="email"
                className="signin-num signin-solo"
                type="email"
                name="email"
                autoComplete="email"
                placeholder="you@example.in"
                required
              />
              <button className="b b-fill signin-go" type="submit">
                Send me a link
              </button>
            </form>

            <p className="signin-alt">
              <a className="signin-link" href="/member/login">
                Sign in with your phone instead
              </a>
            </p>
          </div>
        ) : (
          <PhoneSignIn siteKey={turnstileSiteKey()} />
        )}
      </div>
    </main>
  );
}
