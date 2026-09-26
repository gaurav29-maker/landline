import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { opsUsers } from "@/lib/db/schema";
import { OPS_COOKIE, mintSession } from "@/lib/ops-auth";
import { passwordMatches } from "@/lib/ops-password";
import Wordmark from "@/components/Wordmark";

export const metadata: Metadata = { title: "Ops — Landline", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * Sign in as somebody, rather than sign in as whoever.
 *
 * The form asks for an email now as well as a password. That extra field is
 * the entire point of this change: a shared password could tell us that the
 * console had been opened, and never by whom. Every refund and approval from
 * here on carries the address typed into this box.
 *
 * Accounts are made by running scripts/add-operator.ts against the database.
 * There is no signup link and there should not be one — the list of people
 * who can move money changes when somebody with database access decides it
 * does, not when somebody fills in a form.
 */
export default async function OpsLogin({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;

  async function signIn(formData: FormData) {
    "use server";
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    const target = String(formData.get("next") ?? "/ops");

    const fail = () =>
      redirect(`/ops/login?error=1${target ? `&next=${encodeURIComponent(target)}` : ""}`);

    const [operator] = await db
      .select()
      .from(opsUsers)
      .where(sql`lower(${opsUsers.email}) = ${email.toLowerCase()}`)
      .limit(1);

    /*
       One refusal for a wrong address, a wrong password and a disabled
       account alike. Told apart, this page would confirm which addresses can
       operate Landline — a short and very useful list to anybody assembling
       a phishing email.

       The password is still hashed for an unknown address, so a missing
       account does not answer measurably faster than a wrong password.
    */
    const stored =
      operator?.status === "active"
        ? operator.passwordHash
        : /* A real hash of a password nobody has, so the work is done either way. */
          "scrypt$16384$8$1$00$00";

    const ok = await passwordMatches(password, stored);
    if (!ok || !operator || operator.status !== "active") fail();

    await db
      .update(opsUsers)
      .set({ lastSeenAt: new Date() })
      .where(eq(opsUsers.id, operator!.id));

    const { value, expiresAt } = await mintSession(operator!.id);
    (await cookies()).set(OPS_COOKIE, value, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      expires: expiresAt,
    });
    // Only ever bounce to a path on this site.
    redirect(target.startsWith("/ops") ? target : "/ops");
  }

  return (
    <div className="ops-login">
      <form action={signIn} className="ops-login-card">
        <Wordmark className="logo" as="p" />
        <h1>Ops console</h1>
        <p className="ops-login-sub">Bookings, payments and intake forms. Staff only.</p>

        <input type="hidden" name="next" value={next ?? "/ops"} />
        <label className="bp-field">
          <span>Your email</span>
          <input type="email" name="email" autoFocus autoComplete="username" required />
        </label>
        <label className="bp-field">
          <span>Password</span>
          <input type="password" name="password" autoComplete="current-password" required />
        </label>

        {error ? <p className="bp-error">That email and password do not match an account.</p> : null}

        <button className="btn-primary bp-full" type="submit">
          Sign in
        </button>
      </form>
    </div>
  );
}
