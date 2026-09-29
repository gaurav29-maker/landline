import type { Metadata } from "next";
import Link from "next/link";
import SiteNav from "@/components/SiteNav";
import SiteFooter from "@/components/SiteFooter";
import { CONTACT_EMAIL, INTAKE_RETENTION_DAYS, SINGLE_CALL_PAISE } from "@/lib/constants";
import { EXPERT_SHARE_BPS } from "@/lib/constants";
import { rupees } from "@/lib/format";
import { SLOT_MINUTES } from "@/lib/slots";

export const metadata: Metadata = {
  title: "How Landline works, and what it will not do",
  description:
    "No trackers, no marketing email, one thing to buy, and the SEBI answer published either way. Every line here is something the software already does.",
};

/**
 * The practices page, after Zerodha's.
 *
 * THE RULE FOR THIS PAGE: every sentence describes something the code does
 * today, and the suite has checks that fail if one stops being true. A page
 * of principles is the easiest page on a site to write and the easiest to
 * quietly outgrow — a claim nobody verifies becomes a claim nobody keeps.
 *
 * What is deliberately NOT here is the part Zerodha's version rests on:
 * scale. Theirs opens with a crore of customers and fifteen years. Landline
 * has taken no money from anybody. Borrowing the form of a trust page
 * without having earned any trust is its own kind of dishonesty, so the page
 * says so in its own words, near the top, rather than hoping nobody notices.
 */
export default function Principles() {
  return (
    <div className="site">
      <SiteNav />

      <div className="wrap">
        <div className="doc">
          <h1 className="doc-name">How this works, and what it will not do.</h1>
          <p className="doc-lede">
            Everything below is something the software already does. It is not a statement of
            intent — each one is a decision that is written into the code, and most of them have a
            test that fails if somebody changes their mind quietly.
          </p>

          {/*
            Said before the list rather than after it. A practices page that
            opens with the practices and admits the missing part at the
            bottom is arranged to be skimmed favourably.
          */}
          <section className="doc-sec">
            <h2 className="doc-h2">First, what we have not earned</h2>
            <p>
              Landline has not taken money from anybody yet. Pages like this one usually open with
              a customer count and a number of years, and this one cannot. Nothing below is
              evidence that we behave well under pressure, because there has not been any
              pressure. It is a description of how the thing is built, which is the only honest
              claim available before the first session happens.
            </p>
          </section>

          <section className="doc-sec">
            <h2 className="doc-h2">Nothing follows you around</h2>
            <p>
              There is no analytics on this site. No advertising trackers, no marketing pixels, no
              third-party scripts watching which pages you read or how long you stayed. Not
              &ldquo;anonymised&rdquo; analytics, and not an internal dashboard either — there is
              no measurement of visitors at all.
            </p>
            <p>
              The site talks to exactly four outside services, and each one is doing a job you
              asked for:
            </p>
            <ul className="doc-list">
              <li>
                <strong>Razorpay</strong> — to take a payment, on the page where you pay.
              </li>
              <li>
                <strong>MSG91</strong> — to send the six-digit code when you sign in.
              </li>
              <li>
                <strong>Google</strong> — a calendar invite if you connect a calendar, and the
                fonts this page is set in.
              </li>
              <li>
                <strong>Cloudflare Turnstile</strong> — a bot check on the sign-in form, so
                somebody cannot use it to send codes to strangers&rsquo; phones.
              </li>
            </ul>
            <p className="doc-note">
              If a fifth ever appears, a test in the build fails and somebody has to justify it in
              writing. That is the whole enforcement mechanism, and it is more than a promise.
            </p>
          </section>

          <section className="doc-sec">
            <h2 className="doc-h2">Three cookies, and they are all sign-in</h2>
            <p>
              One for a member&rsquo;s session, one for an expert&rsquo;s, one for an
              operator&rsquo;s. Two more remember which filter you last used on the expert list.
              None of them are advertising cookies, nothing is shared with anybody, and that is
              why this site has never shown you a consent banner — there is nothing to consent to.
            </p>
          </section>

          <section className="doc-sec">
            <h2 className="doc-h2">We only write to you about your own booking</h2>
            <p>
              Every message Landline can send is operational: your booking is confirmed, your
              session is tomorrow, your session is in an hour, your intake form is still blank,
              your sign-in code, a refund went wrong and here is what we are doing about it.
            </p>
            <p>
              There is no newsletter. There is no subscribe box anywhere on this site. There is no
              marketing email, because there is no code that could send one.
            </p>
          </section>

          <section className="doc-sec">
            <h2 className="doc-h2">There is one thing to buy</h2>
            <p>
              A call. {rupees(SINGLE_CALL_PAISE)}, {SLOT_MINUTES} minutes, video. There were
              packages and passes once; they were withdrawn, and the endpoint that used to sell
              them now refuses. Nothing recurs, nothing auto-renews, and there is nothing to
              cancel.
            </p>
          </section>

          <section className="doc-sec">
            <h2 className="doc-h2">Nobody&rsquo;s pay depends on what you buy</h2>
            <p>
              The expert takes {EXPERT_SHARE_BPS / 100}% of the session and nothing else. They are
              not distributing a product, they do not earn on a fund, a broker or an insurance
              policy, and there is no commission anywhere in the model. There is nothing for them
              to steer you towards, which is the point of paying for the hour directly.
            </p>
          </section>

          <section className="doc-sec">
            <h2 className="doc-h2">You can read all of it without an account</h2>
            <p>
              Every expert, every rate, every profile, what a session covers, the refund windows
              and the terms — all readable signed out. The only pages that need a sign-in are the
              ones showing your own bookings and records, because they are yours.
            </p>
          </section>

          <section className="doc-sec">
            <h2 className="doc-h2">The price is on the card, before you click anything</h2>
            <p>
              The rate, the length and the next open time are on the expert&rsquo;s card in the
              listing. Nothing is revealed at checkout that was not visible before it.
            </p>
          </section>

          <section className="doc-sec">
            <h2 className="doc-h2">The SEBI answer is published either way</h2>
            <p>
              Every expert&rsquo;s profile states their SEBI registration and its number, or says
              <strong> Not registered</strong> in the same place, in the same type. The row is
              never simply left out for the people who do not have one. A person checks the claim
              against the SEBI register before anyone is listed, and an expert cannot edit it
              afterwards — a fact somebody can rewrite after it was verified was never verified.
            </p>
          </section>

          <section className="doc-sec">
            <h2 className="doc-h2">We never ask for your broker login</h2>
            <p>
              Not as an option, not for convenience, not &ldquo;read-only&rdquo;. There is no
              field for one anywhere in the product. You write down what you hold, in your own
              words, and that is what your expert has in front of them on the call. It is deleted{" "}
              {INTAKE_RETENTION_DAYS} days afterwards, and you can download your own copy before
              then.
            </p>
          </section>

          <section className="doc-sec">
            <h2 className="doc-h2">No invented reviews</h2>
            <p>
              The testimonials section on the home page is empty, and it renders nothing at all
              rather than showing a heading with nothing under it. It stays that way until a real
              member has said something and agreed in writing to it being published. A fabricated
              review is not a placeholder — on a page selling portfolio reviews to retail
              investors it is a false statement to a consumer, and it is against the law.
            </p>
          </section>

          <section className="doc-sec">
            <h2 className="doc-h2">And the obvious question</h2>
            <p>
              <strong>Tracking and marketing email are what everybody does.</strong> They are, and
              they work. This is a service somebody buys once, or a few times a year, after
              deciding to trust a stranger with a list of everything they own. Nothing that makes
              that decision harder is worth the conversion it buys.
            </p>
            <p className="doc-note">
              If you find something on this site that contradicts a line on this page, write to{" "}
              <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> and it gets fixed or the
              line comes off. <Link href="/legal/privacy">The privacy policy</Link> is the longer,
              duller version of the first three sections.
            </p>
          </section>
        </div>
      </div>

      <SiteFooter />
    </div>
  );
}
