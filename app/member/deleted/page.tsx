import type { Metadata } from "next";
import Link from "next/link";
import { FINANCIAL_RECORD_RETENTION_YEARS, CONTACT_EMAIL } from "@/lib/constants";
import Wordmark from "@/components/Wordmark";

export const metadata: Metadata = {
  title: "Your account is deleted — Landline",
  robots: { index: false },
};
export const dynamic = "force-static";

/**
 * The page a deleted account lands on.
 *
 * IT TAKES NO SESSION AND READS NO DATABASE, which is the whole constraint.
 * By the time anybody sees this their session rows are gone and their cookie
 * points at nothing, so every other page under /member would bounce them to
 * the login screen — and being thrown at a sign-in form is the single worst
 * confirmation that a deletion worked. It is also why this is force-static:
 * there is nothing left to look up, and a query here could only fail.
 *
 * WHICH MEANS IT CANNOT SHOW A RECEIPT, and that is a deliberate trade. The
 * counts of what was erased are in account_deletions, and reaching them would
 * need the customer id, which would need either a session that no longer
 * exists or an id in the URL — a page that reports somebody's deletion to
 * anybody who guesses a uuid. The member already read exactly what would
 * happen on the page before this one, and a number here adds nothing a person
 * who has just deleted their account wants.
 *
 * NO "UNDO", NO "YOU CAN STILL CHANGE YOUR MIND", NO WIN-BACK OFFER. The
 * previous page said there is no undo. Offering one here would make that a
 * lie, and there is nothing to undo from in any case.
 */
export default function AccountDeleted() {
  return (
    <div className="wrap bp-page member">
      <Wordmark className="logo bp-page-logo" as="div" />

      <div className="bp-panel">
        <h1 className="ops-h1">Your account is deleted</h1>
        <p className="bp-muted ops-lede">
          Your name, your number, your email, everything you told us about what you own, and
          everything your expert wrote back are gone. You have been signed out everywhere.
        </p>

        <p className="bp-muted">
          If you had any bookings, the date and amount of each payment stay on our books as an
          accounting record for {FINANCIAL_RECORD_RETENTION_YEARS} years, with your name and
          contact details removed from them. Indian tax and company law requires that, and we
          are not permitted to keep them any longer than it says.
        </p>

        <p className="bp-muted">
          Your mobile number has been released. If you ever want to come back, you can sign up
          with it again — it will be a new account, and we will not have anything from this one.
        </p>

        <p className="bp-muted">
          If anything about this looks wrong, write to{" "}
          <a className="ops-link" href={`mailto:${CONTACT_EMAIL}`}>
            {CONTACT_EMAIL}
          </a>
          . You can also complain to the Data Protection Board of India.
        </p>

        <p style={{ marginTop: 24 }}>
          <Link className="ops-btn" href="/">
            Back to Landline
          </Link>
        </p>
      </div>
    </div>
  );
}
