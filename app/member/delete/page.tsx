import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { customers } from "@/lib/db/schema";
import { MEMBER_COOKIE } from "@/lib/member-auth";
import { readSession } from "@/lib/member-session";
import { alreadyErased, eraseAccount, erasurePreview } from "@/lib/erasure";
import { financialRecordRetentionYears } from "@/lib/constants";
import { istDateYear } from "@/lib/format";
import { rethrowIfNavigation } from "@/lib/nav";
import MemberBar from "@/components/MemberBar";

export const metadata: Metadata = {
  title: "Delete your account — Landline",
  robots: { index: false },
};
export const dynamic = "force-dynamic";

/**
 * The other half of the DPDP rights gap.
 *
 * app/legal/privacy section 6 lists four rights. Two became self-serve when
 * the data export shipped; "erase your data where we no longer need it" was
 * still "write to [grievance contact]" — a placeholder that has never been
 * filled in, which is to say a published right with no mechanism at all.
 *
 * ITS OWN PAGE, NOT A BUTTON ON THE PROFILE. Three reasons, in order of
 * weight. It is irreversible, and an irreversible control two centimetres
 * below a Save button will be pressed by somebody who meant to press Save.
 * It needs room to say what survives and why, which is the part a member
 * actually needs and the part a modal has never had space for. And it has to
 * be able to refuse — a page can explain a refusal and link to the fix; a
 * button can only fail.
 *
 * THE SAME IDENTITY BAR AS THE EXPORT, for the mirror of the reason. The
 * export hands over everything at once; this destroys everything at once.
 * Both are things a thirty-day cookie on a borrowed laptop must not be
 * enough for, so both ask for a code.
 *
 * AND IT OFFERS THE DOWNLOAD FIRST. Somebody deleting an account is often
 * leaving, not disowning what they did here, and the kind thing and the
 * correct thing agree: the file is theirs, this is the last moment it exists,
 * and no dark pattern is needed to say so.
 */
export default async function DeleteAccount({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  const session = await readSession();
  if (!session) redirect("/member/login");

  /* Reading your own bookings is one thing. Destroying them is another. */
  if (!session.fresh) {
    redirect("/member/verify?next=" + encodeURIComponent("/member/delete"));
  }

  let customer;
  let preview;
  try {
    [customer] = await db
      .select()
      .from(customers)
      .where(eq(customers.id, session.customerId))
      .limit(1);
    if (!customer) redirect("/member/login");

    /* Already gone: say so rather than offering it again, which would read
       as though the request had not taken. */
    if (await alreadyErased(session.customerId)) redirect("/member/deleted");

    preview = await erasurePreview(session.customerId);
  } catch (err) {
    rethrowIfNavigation(err);
    return (
      <div className="wrap bp-page member erase-page">
        <div className="bp-panel">
          <h1>Not available right now</h1>
          <p className="bp-muted">
            We could not reach your account, so nothing has been changed. Please try again
            shortly.
          </p>
        </div>
      </div>
    );
  }

  async function confirmDelete(formData: FormData) {
    "use server";

    const current = await readSession();
    if (!current) redirect("/member/login");
    /* Re-checked on the action, not only on the render: a page can be left
       open for an hour and freshness is a claim about the last fifteen
       minutes. */
    if (!current.fresh) {
      redirect("/member/verify?next=" + encodeURIComponent("/member/delete"));
    }

    /*
       The typed word.

       Not a second "are you sure" — that is a reflex, and a reflex is what
       this needs to interrupt. Typing DELETE cannot be done by a mis-click,
       by a browser restoring a form, or by somebody skimming.
    */
    const typed = String(formData.get("confirm") ?? "").trim().toUpperCase();
    if (typed !== "DELETE") redirect("/member/delete?error=confirm");

    const result = await eraseAccount(current.customerId, "member");

    if (!result.ok) {
      /* Raced: a booking was confirmed while this page was open. The page
         re-renders with the refusal and nothing has been destroyed. */
      redirect("/member/delete?error=blocked");
    }

    /*
       The cookie goes last and deliberately.

       eraseAccount deletes the session rows, so the cookie in the browser is
       already pointing at nothing and is harmless. Dropping it here is so the
       next page load does not look like a mysterious sign-out, and the order
       means a failed erasure leaves a member who is still signed in and can
       try again — the opposite order would strand them looking signed out
       with their data intact.
    */
    (await cookies()).delete(MEMBER_COOKIE);
    redirect("/member/deleted");
  }

  const blocked = preview.blockers.length > 0;
  const retentionYears = financialRecordRetentionYears();

  return (
    <div className="wrap bp-page member erase-page">
      <MemberBar name={customer.name} current="profile" />

      <p className="ops-crumb">
        <Link href="/member/profile" className="ops-link">
          ← Your details
        </Link>
      </p>

      <h1 className="ops-h1">Delete your account</h1>
      <p className="bp-muted ops-lede">
        This erases everything that says who you are and everything you have told us about what
        you own. It cannot be undone, and we cannot restore it afterwards — there is nothing left
        to restore from.
      </p>

      {error === "confirm" ? (
        <p className="bp-error">
          Type DELETE in the box to confirm. Nothing has been deleted.
        </p>
      ) : null}
      {error === "blocked" ? (
        <p className="bp-error">
          A session was confirmed while this page was open, so nothing was deleted. Cancel it
          from your console and come back.
        </p>
      ) : null}

      {/*
        The refusal, first and in its own panel, because a member who cannot
        do this needs to know that before reading two screens about what it
        would have done.
      */}
      {blocked ? (
        <section className="member-section">
          <div className="bp-panel erase-blocked">
            <h2 className="member-h2">Not yet</h2>
            {preview.blockers.map((b, n) => (
              <div key={n} className="erase-blocker">
                <p className="erase-blocker-what">{b.what}</p>
                <p className="bp-muted">{b.fix}</p>
              </div>
            ))}
            <Link className="ops-btn" href="/member">
              Open your console
            </Link>
          </div>
        </section>
      ) : null}

      <section className="member-section">
        <div className="bp-panel">
          <h2 className="member-h2">Take your file first</h2>
          <p className="bp-muted" style={{ marginBottom: 14 }}>
            Every booking, everything you told us before each call, what your expert wrote back,
            and who we have shared any of it with — in one file. This is the last moment it
            exists. You are signed in and verified, so it will download straight away.
          </p>
          <a className="ops-btn" href="/member/data">
            Download everything we hold
          </a>
        </div>
      </section>

      <section className="member-section">
        <div className="bp-panel">
          <h2 className="member-h2">What gets erased</h2>
          <ul className="erase-list">
            <li>
              <b>Your name, email address and phone number.</b> The number is released, so you
              can sign up again with it later if you want to.
            </li>
            <li>
              <b>Everything you told us before a call</b> — your holdings, your goals, your
              experience, every question you sent ahead. This is the part we most want gone.
            </li>
            <li>
              <b>What your expert wrote back.</b> Those notes describe the same conversation as
              the holdings above, so they go with them.
            </li>
            <li>
              <b>Every device you are signed in on</b>, and the IP addresses and browsers
              recorded against them.
            </li>
            <li>
              <b>Who paid, on every payment</b> — the name, email and contact number the payment
              carried, and the full record our payment provider sent us.
            </li>
          </ul>
        </div>
      </section>

      {/*
        The honest half, and the one most deletion flows leave out. A member
        who is told "everything is deleted" and later finds a payment record
        has been misled, however good the reason for keeping it.
      */}
      <section className="member-section">
        <div className="bp-panel">
          <h2 className="member-h2">What we have to keep, and why</h2>
          <p className="bp-muted" style={{ marginBottom: 14 }}>
            {preview.bookingsKept === 0 ? (
              <>
                You have no bookings, so there is no financial record to keep. Everything goes.
              </>
            ) : (
              <>
                {preview.bookingsKept === 1
                  ? "One booking and its payment stay"
                  : `${preview.bookingsKept} bookings and their payments stay`}{" "}
                as an accounting record: the date, the amount, the payment reference and whether
                it was a card or UPI. Not your name, not your email, not your number — those are
                removed from them.
              </>
            )}
          </p>
          {/*
            The period is quoted only when it is known.

            How long books must be kept follows from what the business is
            registered as — eight years for a company or an LLP, six for a
            proprietorship — and that registration is still one of the blanks
            in app/legal/privacy. This page used to print a flat "8 years" and
            a date computed from it, which on the wrong entity is two years of
            unlawful retention stated to the member as the law.

            So when the entity is unset the member gets the part that is true
            either way, and the blank shows as a blank. That is the same
            treatment the legal pages give their placeholders, for the same
            reason: visible is recoverable, reassuring and untrue is not.
          */}
          {preview.bookingsKept > 0 ? (
            retentionYears !== null && preview.keptUntil !== null ? (
              <p className="bp-muted">
                Indian tax and company law requires a business to keep its books for{" "}
                {retentionYears} years. These may be deleted after{" "}
                <b>{istDateYear(preview.keptUntil)}</b>. We are not allowed to delete them sooner
                and we are not allowed to keep them longer.
              </p>
            ) : (
              <p className="bp-muted">
                We keep them only for as long as Indian tax and company law requires, and no
                longer — we are not permitted to delete them sooner either. The exact period
                depends on how Landline is registered, which is{" "}
                <span className="todo">[not stated yet]</span>. Ask us before you
                delete if that matters to you.
              </p>
            )
          ) : null}
        </div>
      </section>

      {preview.forfeits.length > 0 ? (
        <section className="member-section">
          <div className="bp-panel erase-forfeit">
            <h2 className="member-h2">You will lose what you have paid for</h2>
            <ul className="erase-list">
              {preview.forfeits.map((f, n) => (
                <li key={n}>{f.what}</li>
              ))}
            </ul>
            <p className="bp-muted">
              Deleting your account does not refund any of it. This is your decision to make and
              we will not stand in the way of it — but you should make it knowing that.
            </p>
          </div>
        </section>
      ) : null}

      {!blocked ? (
        <section className="member-section">
          <form action={confirmDelete} className="bp-panel erase-confirm">
            <h2 className="member-h2">Confirm</h2>
            <p className="bp-muted" style={{ marginBottom: 14 }}>
              Type <b>DELETE</b> to confirm. There is no undo and no grace period.
            </p>
            <label className="bp-field">
              <span>Type DELETE</span>
              <input
                name="confirm"
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                placeholder="DELETE"
                required
              />
            </label>
            <button className="ops-btn danger" type="submit">
              Delete my account permanently
            </button>
          </form>
        </section>
      ) : null}

      <section className="member-section">
        <p className="bp-muted">
          Changed your mind? <Link href="/member/profile" className="ops-link">Go back</Link>.
          Nothing on this page does anything until you type DELETE and press the button.
        </p>
      </section>
    </div>
  );
}
