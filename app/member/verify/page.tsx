import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { customers } from "@/lib/db/schema";
import { CODE_MINUTES } from "@/lib/member-auth";
import { issueCode, spendCode } from "@/lib/member-code";
import { markVerified, readSession } from "@/lib/member-session";
import { phoneTail } from "@/lib/phone";
import Wordmark from "@/components/Wordmark";

export const metadata: Metadata = { title: "Confirm it is you — Landline", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * Prove it is still you.
 *
 * Reached only from something that refused a merely-valid session: right now
 * that is downloading a session record, and it will be changing the number on
 * the account when that exists. The member is signed in — this is not a
 * sign-in screen and does not say "sign in", which would read as though they
 * had been logged out and is the exact moment somebody clicks a phishing link
 * instead.
 *
 * `next` is checked against a prefix rather than trusted. An open redirect on
 * a page whose whole job is to be trusted would be a gift: "confirm it is
 * you", then off to somebody else's site with the confidence already spent.
 */
function safeNext(raw: string | undefined): string {
  if (!raw) return "/member";
  /* A path on this site, and specifically one behind the member console.
     Not `startsWith("/")` alone — "//evil.example" is a protocol-relative URL
     that browsers follow off-site. */
  return raw.startsWith("/member") && !raw.startsWith("//") ? raw : "/member";
}

export default async function MemberVerify({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; sent?: string; error?: string }>;
}) {
  const { next, sent, error } = await searchParams;
  const target = safeNext(next);

  const session = await readSession();
  if (!session) redirect("/member/login");

  /* Already fresh — nothing to ask, so do not ask. Somebody who clicked two
     downloads in a row should not be made to type two codes. */
  if (session.fresh) redirect(target);

  const [customer] = await db
    .select()
    .from(customers)
    .where(eq(customers.id, session.customerId))
    .limit(1);

  async function sendCode() {
    "use server";
    const current = await readSession();
    if (!current) redirect("/member/login");

    const [row] = await db
      .select({ phone: customers.phone })
      .from(customers)
      .where(eq(customers.id, current.customerId))
      .limit(1);

    if (row?.phone) await issueCode(row.phone);
    redirect(`/member/verify?sent=1&next=${encodeURIComponent(target)}`);
  }

  async function checkCode(formData: FormData) {
    "use server";
    const current = await readSession();
    if (!current) redirect("/member/login");

    const result = await spendCode(current.customerId, String(formData.get("code") ?? ""));
    if (result !== "ok") {
      redirect(
        `/member/verify?error=${result}&sent=1&next=${encodeURIComponent(target)}`,
      );
    }

    /*
       The session is stamped, not replaced. They were already signed in; what
       just changed is how recently they proved it, and that is the only thing
       the sensitive screens are asking about.
    */
    await markVerified(current.sessionId);
    redirect(target);
  }

  return (
    <main className="site signin">
      <div className="signin-col">
        <Wordmark className="logo signin-mark" as="p" sub="os" />

        <div className="signin-body">
          <h1 className="signin-h">Confirm it&rsquo;s you</h1>
          <p className="signin-sub">
            You&rsquo;re signed in — this one asks again because it opens what you shared about
            your money. {customer?.phone ? `We'll text the number ending ${phoneTail(customer.phone)}.` : ""}
          </p>

          {error === "attempts" ? (
            <p className="signin-error" role="alert">
              Too many tries. Send a new code.
            </p>
          ) : error ? (
            <p className="signin-error" role="alert">
              That code is not right. Check the digits and try again.
            </p>
          ) : null}

          {sent ? (
            <form action={checkCode} className="signin-form">
              <label className="signin-label" htmlFor="code">
                Six-digit code
              </label>
              <input
                id="code"
                className="signin-code"
                name="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="000000"
                autoFocus
                required
              />
              <button className="b b-fill signin-go" type="submit">
                Confirm
              </button>
            </form>
          ) : (
            <form action={sendCode} className="signin-form">
              <p className="signin-legal">
                The code lasts {CODE_MINUTES} minutes. Landline will never ask you for it —
                not by phone, not by email, not by anyone claiming to be us.
              </p>
              <button className="b b-fill signin-go" type="submit">
                Text me a code
              </button>
            </form>
          )}

          <p className="signin-alt">
            <a className="signin-link" href="/member">
              Back to your console
            </a>
          </p>
        </div>
      </div>
    </main>
  );
}
