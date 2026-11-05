import Link from "next/link";
import Wordmark from "@/components/Wordmark";
import { FREE_CANCEL_HOURS, MAX_RESCHEDULES } from "@/lib/cancellation";

/**
 * Landline OS, shown rather than described.
 *
 * robinhood.com's "See your full financial picture": a centred headline,
 * one line under it, then the product itself as the media. Theirs is a
 * phone running the app. Ours is the console, drawn.
 *
 * DRAWN, NOT SCREENSHOTTED, AND NOT INVENTED EITHER. Every label below is
 * the console's own, read out of app/member/page.tsx and
 * components/MemberBar.tsx rather than written for this panel:
 *
 *   bar        Your console · Receipts · Your details · Help
 *   sections   Coming up · Past sessions
 *   actions    Book again
 *   fields     Your expert
 *
 * A screenshot would need a signed-in member and a real booking, and the
 * database has neither; a panel invented to look like a console would be
 * a picture of software that does not exist. This is the real vocabulary
 * with example values, and it says so underneath.
 *
 * THE TWO RULES ARE IMPORTED. FREE_CANCEL_HOURS and MAX_RESCHEDULES come
 * from lib/cancellation, which is what the console itself enforces, so
 * the sentence under the panel cannot outlive the rule it describes.
 */
export default function ConsolePeek() {
  return (
    <>
      <div className="os-peek" role="img" aria-label="The Landline console: a bar with Your console, Receipts, Your details and Help; a Coming up section showing a booked session with Move and Cancel; and a Past sessions section with a record to download.">
        <div className="os-peek-bar" aria-hidden="true">
          {/*
             THE MARK COMES FROM components/Wordmark, NOT FROM HERE.

             This was `landline<i>OS</i>`, spelled out, and the suite
             caught it: "the wordmark is drawn in exactly one place".
             The rule exists because the name was once written as two
             spans on the share cards, so a repo search for it found
             nothing and the cards shipped the wrong brand for two weeks.

             No href. The real bar links this to /member; inside a
             picture of the console it would be a focusable link in an
             aria-hidden region — reachable by keyboard and invisible to
             a screen reader. as="span" keeps it inert.
          */}
          <Wordmark className="os-peek-mark" sub="os" as="span" />
          <ul className="os-peek-nav">
            <li className="on">Your console</li>
            <li>Receipts</li>
            <li>Your details</li>
            <li>Help</li>
          </ul>
        </div>

        <div className="os-peek-body" aria-hidden="true">
          <p className="os-peek-h">Coming up</p>
          <div className="os-peek-row">
            <span className="os-peek-who">
              <b>Gaurav Khona</b>
              <span>Tue, 16 Sept &middot; 10:00 am IST</span>
            </span>
            {/*
               A LIST, NOT TWO ADJACENT SPANS. The wordmark guard looks
               for two spans of plain words next to each other, because
               that is the shape the mark took when it was last written
               by hand — and "Move" beside "Cancel" is indistinguishable
               from it to a regex. A list of actions is the truer markup
               anyway.
            */}
            <ul className="os-peek-acts">
              <li className="os-peek-btn">Move</li>
              <li className="os-peek-btn">Cancel</li>
            </ul>
          </div>

          <p className="os-peek-h">Past sessions</p>
          <div className="os-peek-row">
            <span className="os-peek-who">
              <b>Gaurav Khona</b>
              <span>Tue, 2 Sept &middot; completed</span>
            </span>
            <ul className="os-peek-acts">
              <li className="os-peek-btn">Record</li>
              <li className="os-peek-btn">Book again</li>
            </ul>
          </div>
        </div>
      </div>

      {/*
        What it actually does, under the picture of it. Four lines, each
        one a thing the console enforces rather than a feature it lists.
      */}
      <ul className="os-peek-list">
        <li>
          <b>Move or cancel it yourself.</b> One reschedule per booking, and cancelling more
          than {FREE_CANCEL_HOURS} hours ahead costs nothing. No email, no asking.
        </li>
        <li>
          <b>Every receipt, kept.</b> Downloadable, with what was paid and when.
        </li>
        <li>
          <b>The record from each session.</b> The expert&rsquo;s note and a plain-text file,
          yours to keep.
        </li>
        <li>
          <b>Your details, and the way out.</b> Change your email with a verified code, or
          erase the account entirely.
        </li>
      </ul>

      <p className="os-peek-note">
        A depiction of the console with example values &mdash; {MAX_RESCHEDULES} reschedule and
        the {FREE_CANCEL_HOURS}-hour window are the rules the software enforces. Nobody is
        described and no session shown here happened.
      </p>

      <Link className="b b-line" href="/member/login">
        Open Landline OS
      </Link>
    </>
  );
}
