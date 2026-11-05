import type { Metadata } from "next";
import Link from "next/link";
import SiteNav from "@/components/SiteNav";
import SiteFooter from "@/components/SiteFooter";
import { ArtQuestion, ArtSlot, ArtCall } from "@/components/FlowArt";
import { SINGLE_CALL_PAISE, ASK_FOR_INTAKE } from "@/lib/constants";
import { SLOT_MINUTES } from "@/lib/slots";
import { FREE_CANCEL_HOURS, MAX_RESCHEDULES } from "@/lib/cancellation";
import { rupees } from "@/lib/format";

export const metadata: Metadata = {
  title: "What a call covers — Landline",
  description:
    "One call, 45 minutes, one to one. What an expert does with your portfolio, what they will not do, and the record you keep afterwards.",
};

/**
 * What a call covers.
 *
 * NOT A SERVICES PAGE, AND THE DIFFERENCE IS THE WHOLE POINT. A services
 * page lists things you can buy. Landline sells one thing at one price, so
 * a catalogue of three or four "services" would be a page of products that
 * do not exist — the same invention the four-product ladder was, which came
 * off this site in September and had to be corrected in two docs afterwards.
 *
 * This page answers the question somebody actually has before paying
 * ₹5,499: what happens in the forty-five minutes, and what does not.
 *
 * EVERY NUMBER IS IMPORTED, NOT TYPED. SLOT_MINUTES, SINGLE_CALL_PAISE,
 * FREE_CANCEL_HOURS and MAX_RESCHEDULES come from the modules the booking
 * flow itself reads, so this page cannot drift from the product the way a
 * hand-written "45 minutes" would the first time somebody changes the slot
 * length. ASK_FOR_INTAKE is read rather than assumed for the same reason:
 * the intake form is off, and the sentence about it follows the switch.
 *
 * NOTHING HERE IS A CLAIM ABOUT RESULTS. There is no "you will find",
 * no outcome, no before and after. Every line is a description of what is
 * done, because what is done is all we can promise — and a review that
 * promised a result would be the advice this product is careful not to be.
 */
export default function Services() {
  const minutes = SLOT_MINUTES;

  return (
    <div className="site">
      <SiteNav />
      <main id="main">
        <header className="band">
          <div className="wrap">
            <div className="band-head idx">
              <span className="eyebrow">What a call covers</span>
              <h2>
                One call, and what fits <span className="said">inside it</span>.
              </h2>
              <p>
                {minutes} minutes, one to one, on video. You bring the portfolio open on your
                screen. There is nothing to fill in first.
              </p>
            </div>
          </div>
        </header>

        {/*
          The three steps, with the pictures they already have on the home
          page. Same component, same drawings — a visitor who arrives here
          from the nav should recognise the shape of the thing, not meet a
          second explanation of it written differently.
        */}
        <section className="band alt">
          <div className="wrap">
            <div className="band-head">
              <span className="eyebrow">The shape of it</span>
              <h2>Three steps, start to finish.</h2>
            </div>
            <div className="flow">
              <div className="flow-step">
                <ArtQuestion className="flow-art" />
                <p className="n">01</p>
                <h3>You arrive with a question</h3>
                <p>
                  A holding, a company, a sector, or just the whole book and no idea where to
                  start. You pick the expert yourself.
                </p>
              </div>
              <div className="flow-step">
                <ArtSlot className="flow-art" />
                <p className="n">02</p>
                <h3>You take a real time</h3>
                <p>
                  Live availability, booked in the open. Nobody emails you back to arrange it, and
                  you can move it once up to {FREE_CANCEL_HOURS} hours before.
                </p>
              </div>
              <div className="flow-step">
                <ArtCall className="flow-art" />
                <p className="n">03</p>
                <h3>The call, then the record</h3>
                <p>
                  {minutes} minutes with your portfolio open and read back to you. What they saw is
                  written up afterwards and is yours to keep.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/*
          IN SCOPE. Written as what the expert DOES, verb first, because a
          list of nouns ("portfolio review, risk analysis") is how a
          brochure describes work nobody has done yet.
        */}
        <section className="band" id="covers">
          <div className="wrap">
            <div className="band-head">
              <span className="eyebrow">In the {minutes} minutes</span>
              <h2>
                What an expert actually <span className="said">does</span>.
              </h2>
              <p>
                It is a conversation about what you already hold. Any of these can take the whole
                call, and usually one of them does.
              </p>
            </div>
            <div className="work-table">
              <div className="work-row">
                <div className="work-row-q">
                  <p className="work-tag">Reads it</p>
                  <h3 className="work-ask">Goes through the book with you, line by line.</h3>
                </div>
                <p className="work-does">
                  Not a summary read back. The holdings open on your screen, in the order you want
                  to take them.
                </p>
              </div>
              <div className="work-row">
                <div className="work-row-q">
                  <p className="work-tag">Names the shape</p>
                  <h3 className="work-ask">Says what the book is, before saying anything about it.</h3>
                </div>
                <p className="work-does">
                  Concentrated, scattered, mostly derivatives, or something else. The shape is
                  usually the thing nobody has said out loud.
                </p>
              </div>
              <div className="work-row">
                <div className="work-row-q">
                  <p className="work-tag">Asks</p>
                  <h3 className="work-ask">Puts the questions you have not been asked.</h3>
                </div>
                <p className="work-does">
                  Why this one, why this much, and whether it arrived by decision or one buy at a
                  time.
                </p>
              </div>
              <div className="work-row">
                <div className="work-row-q">
                  <p className="work-tag">Takes your question</p>
                  <h3 className="work-ask">Answers the specific thing you came with.</h3>
                </div>
                <p className="work-does">
                  A single holding, a sector, a second opinion on something you have already
                  decided.
                </p>
              </div>
              <div className="work-row">
                <div className="work-row-q">
                  <p className="work-tag">Looks through</p>
                  <h3 className="work-ask">Checks what the funds already own for you.</h3>
                </div>
                <p className="work-does">
                  Four funds and twenty stocks is often fewer companies than it looks, and the
                  overlap is only visible if somebody looks for it.
                </p>
              </div>
              <div className="work-row">
                <div className="work-row-q">
                  <p className="work-tag">Writes it down</p>
                  <h3 className="work-ask">Leaves a record of what was discussed.</h3>
                </div>
                <p className="work-does">
                  A short note afterwards and a plain-text file you can download. Nobody has to
                  remember the call.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/*
          OUT OF SCOPE, in the same words the home page uses. Not rephrased:
          two pages saying the same disclaimer differently is how one of
          them ends up weaker than the other, and this is the half of the
          page a SEBI question would land on.
        */}
        <section className="band alt" id="not">
          <div className="wrap">
            <div className="band-head">
              <span className="eyebrow">Out of scope</span>
              <h2>What a call is not.</h2>
              <p>
                These are not omissions to be filled in later. They are what the product is, and
                the software has no field for any of them.
              </p>
            </div>
            <div className="nots">
              <div className="not">
                <p>
                  <b>Not a tip, a call, or a target.</b> Nobody tells you what to buy.
                </p>
              </div>
              <div className="not">
                <p>
                  <b>Not personalised investment advice.</b> A session is a review and a
                  discussion.
                </p>
              </div>
              <div className="not">
                <p>
                  <b>Not an automated score.</b> A person reads your portfolio, not a model.
                </p>
              </div>
              <div className="not">
                <p>
                  <b>Not a place anyone asks for your demat login.</b> There is no field for one.
                </p>
              </div>
              <div className="not">
                <p>
                  <b>Not a mandate.</b> Nobody manages money, places an order, or touches your
                  account.
                </p>
              </div>
              <div className="not">
                <p>
                  <b>Not a subscription.</b> Nothing renews, and nobody follows up to sell you the
                  next one.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/*
          What you are left holding, which is the part a reader cannot
          picture and the one thing they can inspect before paying.
        */}
        <section className="band" id="keep">
          <div className="wrap">
            <div className="band-head">
              <span className="eyebrow">Afterwards</span>
              <h2>
                You keep the <span className="said">record</span>.
              </h2>
              <p>
                A plain-text file with the expert&rsquo;s note, what was paid, and when. It is the
                same file a member downloads after a real session, and you can read one now
                without booking anything.
              </p>
            </div>
            <p className="see-all">
              <Link className="b b-line" href="/sample-record">
                Read an example record
              </Link>
            </p>
          </div>
        </section>

        <section className="band alt" id="price">
          <div className="wrap">
            <div className="band-head idx">
              <span className="eyebrow">What it costs</span>
              <h2>One call, one price.</h2>
              <p>
                {rupees(SINGLE_CALL_PAISE)} for {minutes} minutes. You can move it once, and
                cancelling more than {FREE_CANCEL_HOURS} hours ahead costs nothing.
                {ASK_FOR_INTAKE
                  ? " The intake form goes over before the call."
                  : " There is no form to fill in."}
              </p>
            </div>
            <p className="see-all">
              <Link className="b b-fill" href="/experts">
                Find an expert
              </Link>
            </p>
            {/*
              The reschedule count is imported rather than written, so this
              sentence cannot outlive the rule it describes.
            */}
            <p className="work-note">
              One reschedule per booking ({MAX_RESCHEDULES}). The full refund and cancellation
              terms are in <Link href="/legal/refunds">the refunds policy</Link>, and the
              expert&rsquo;s rate and SEBI answer are on their page before you pay.
            </p>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
