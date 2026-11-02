import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { experts as expertsTable } from "@/lib/db/schema";
import { openSlotsFor } from "@/lib/availability";
import { istDayLabel, istTime, rupees } from "@/lib/format";
import {
  ASK_FOR_INTAKE,
  CONTACT_EMAIL,
  INTAKE_RETENTION_DAYS,
  SINGLE_CALL_PAISE,
} from "@/lib/constants";
import ExpertGrid, { type ExpertCard } from "@/components/ExpertGrid";
import SiteNav from "@/components/SiteNav";
import SiteFooter from "@/components/SiteFooter";
import BookShapes from "@/components/BookShapes";
import AuditExample from "@/components/AuditExample";
import QuestionsStrip from "@/components/QuestionsStrip";
import Testimonials from "@/components/Testimonials";
import PhoneCta from "@/components/PhoneCta";
import { BRAND_TAGLINE_PARTS } from "@/lib/brand";
import { TESTIMONIALS } from "@/lib/testimonials";

export const dynamic = "force-dynamic";

const BROKERS = [
  "Zerodha",
  "HDFC Sec.",
  "ICICI Direct",
  "Groww",
  "Angel One",
  "Upstox",
  "Kotak Neo",
  "5paisa",
];

/** How far ahead the hero instrument reads, and how many days it shows. */
const PREVIEW_DAYS = 14;
const PREVIEW_CELLS = 4;

type Preview = { name: string; total: number; days: { day: string; first: Date; count: number }[] };

/**
 * The credential above the headline, counted rather than claimed.
 *
 * Landline has taken no sessions, so there is no "10,000 delivered" to put
 * here and there will not be one for a while. What it does have is a panel,
 * and the panel's experience is a real number in a real column — summed from
 * years_experience, the same figure each expert card already prints beside
 * the name, so the two can never disagree.
 *
 * Null when no expert is live or the database is unreachable. A credential
 * with nothing behind it is worse than no credential, so the line disappears
 * rather than falling back to anything.
 */
type Panel = { experts: number; years: number };

async function load(): Promise<{
  experts: ExpertCard[];
  dbReady: boolean;
  preview: Preview | null;
  panel: Panel | null;
}> {
  try {
    const rows = await db
      .select({
        id: expertsTable.id,
        timezone: expertsTable.timezone,
        slug: expertsTable.slug,
        displayName: expertsTable.displayName,
        initials: expertsTable.initials,
        headline: expertsTable.headline,
        background: expertsTable.background,
        pricePaise: expertsTable.pricePaise,
        sebiRegType: expertsTable.sebiRegType,
        sebiRegNumber: expertsTable.sebiRegNumber,
        yearsExperience: expertsTable.yearsExperience,
      })
      .from(expertsTable)
      .where(eq(expertsTable.status, "live"))
      .orderBy(asc(expertsTable.pricePaise));

    const experts: ExpertCard[] = rows.map(
      ({ id: _id, timezone: _tz, yearsExperience: _yrs, ...card }) => card,
    );

    const panel: Panel | null = rows.length
      ? { experts: rows.length, years: rows.reduce((n, r) => n + r.yearsExperience, 0) }
      : null;

    /*
     * The hero carries a real availability read where a reference design would
     * put a photograph. It goes through the same helper the booking dialog
     * reads, so this panel cannot advertise a week the dialog then refuses.
     */
    let preview: Preview | null = null;
    const first = rows[0];
    if (first) {
      const from = new Date();
      const slots = await openSlotsFor(
        { id: first.id, timezone: first.timezone },
        from,
        new Date(from.getTime() + PREVIEW_DAYS * 86_400_000),
      );

      const byDay = new Map<string, Date[]>();
      for (const s of slots) {
        const key = istDayLabel(s.startsAt);
        const seen = byDay.get(key);
        if (seen) seen.push(s.startsAt);
        else byDay.set(key, [s.startsAt]);
      }

      preview = {
        name: first.displayName,
        total: slots.length,
        days: [...byDay.entries()]
          .slice(0, PREVIEW_CELLS)
          .map(([day, times]) => ({ day, first: times[0], count: times.length })),
      };
    }

    return { experts, dbReady: true, preview, panel };
  } catch {
    // No database yet. Render the page rather than a stack trace.
    return { experts: [], dbReady: false, preview: null, panel: null };
  }
}

export default async function Home() {
  const { experts, dbReady, preview, panel } = await load();

  /*
     Whether the quotes band renders, which every stripe below it depends
     on. See the note above that section: it occupies a position whether or
     not it is tinted, so the bands after it have to flip with it.
  */
  const QUOTED = TESTIMONIALS.length > 0;

  return (
    <div className="site">
      <SiteNav onLanding />
      <main id="main">

      <header className="hero-band">
        <div className="wrap">
          {/*
            Counted, not claimed. Every figure here comes out of the database,
            and the whole line is absent when there is nothing to count.
          */}
          {panel ? (
            <p className="hero-badge">
              <i aria-hidden />
              {panel.experts} expert{panel.experts === 1 ? "" : "s"} &middot; {panel.years} year
              {panel.years === 1 ? "" : "s"} in the market
            </p>
          ) : null}
          {/*
            The tagline IS the headline now, so it is read from the same parts
            every other place reads — nothing here restates the words.

            "Real experts. Real work. Real conversations." is not gone: it is
            still the line on both share cards, which is where somebody meets
            this cold. It stopped earning the top of the page once the tagline
            sat directly underneath saying the same thing more plainly.
          */}
          <h1>
            {BRAND_TAGLINE_PARTS[0]}
            <span className="said">{BRAND_TAGLINE_PARTS[1]}</span>
            {BRAND_TAGLINE_PARTS[2]}
          </h1>
          {/*
            Below the headline, not above it. It sat over the top and made two
            small-caps lines in a row under the badge, and it opened the page
            on three things Landline is NOT — a denial arriving before the
            claim it denies, which invites the doubt it exists to kill.

            It stays on the page because the prior it kills is real: in Indian
            retail, "book a market expert" usually does mean a tip group or a
            distributor on commission. "What this is not" says it again with
            room to explain, but that section is seven screens down and this
            reader may not get there.
          */}
          <p className="reject">
            <span>Not a tip service</span>
            <span>Not a Telegram group</span>
            <span>Not a distributor</span>
          </p>
          <div className="b-pair">
            <Link className="b b-fill" href="/experts">
              Find an expert
            </Link>
            <a className="b b-line" href="#audit">
              Audit my portfolio
            </a>
          </div>
        </div>
      </header>

      <div className="strip">
        <div className="strip-in">
          <span className="eyebrow">Built for investors using</span>
          {/*
            The list twice, and the second copy hidden from assistive tech.

            A marquee loops seamlessly by animating two identical tracks and
            resetting when the second lands exactly where the first began —
            which means the names really are in the DOM twice. A screen reader
            that read them twice would sound broken, so the duplicate is
            aria-hidden and the first copy is the one that is announced.
          */}
          <div className="ticker">
            <div className="ticker-track">
              <ul>
                {BROKERS.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
              <ul aria-hidden>
                {BROKERS.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>

      <section className="band ink" id="audit">
        <div className="wrap">
          <div className="band-head idx">
            <span className="eyebrow">Audit my portfolio</span>
            {/* The mark sits on the claim; the qualification is at the band foot. */}
            <h2>
              A real expert reads your actual portfolio.
              <a className="reel-mark" href="#audit-note" aria-label="See the note about this example">
                <sup>1</sup>
              </a>
            </h2>
            <p>Not an automated score.</p>
          </div>


          {/*
            The specimen, and it is a component because the reader operates
            it: three invented shapes, and picking one swaps both columns.
            The reasoning — and the rule every line of it was written
            against — is in components/AuditExample.
          */}
          <AuditExample />
        </div>
      </section>

      {/*
        The rail sits in the same ink run as the card above it and carries
        no top padding of its own, so the two blocks read as one dark
        stretch — which is how editlobby's intro card and work carousel sit
        on their page, 64px apart on one continuous ground rather than as
        two bands with the sum of their paddings between them.
      */}
      <section className="band ink work-band">
        <div className="wrap">
          <QuestionsStrip />
        </div>
      </section>

      <section className="band" id="experts">
        <div className="wrap">
          <div className="band-head idx">
            {/*
              "The expert network" was a claim about quantity, printed above a
              grid that currently holds one person — a section undermining
              itself in its own first three words.

              The standard is the claim worth making instead: true at one
              expert and still true at fifty, and it is what separates this
              from a directory anybody can buy a listing on. Every clause
              below is enforced in code — the background is checked by a
              person and locked after approval, the SEBI row renders "Not
              registered" rather than vanishing, and nobody is paid for
              distributing anything.
            */}
            <span className="eyebrow">Who you would be talking to</span>
            <h2>
              The right expert changes the <span className="said">conversation</span>.
            </h2>
            <p>
              Where each of them has worked is checked by a person before they are listed, and
              they cannot edit it afterwards. Their SEBI registration is shown either way. None
              of them earns anything from what you hold.
            </p>
          </div>
          <ExpertGrid experts={experts} dbReady={dbReady} />

          {/*
            THE AVAILABILITY INSTRUMENT LIVES HERE, not in the hero.

            It opened the page until now, which put a four-column grid of
            times under a headline on a phone and made the hero 633px of
            mostly table. It also asked the question in the wrong order:
            when somebody is free only matters once you know who they are.

            So it sits directly under the card for the person it describes,
            between the grid and the link to the rest. Same data, same
            component, read from the database on every request.
          */}
          {preview && preview.days.length > 0 ? (
            <div className="inst glassy">
              <div className="inst-top">
                <span className="eyebrow">Next available · {preview.name}</span>
                <span className="live">
                  <i className="dot" /> Live
                </span>
              </div>
              <div className="inst-grid">
                {preview.days.map((d) => (
                  <div className="inst-cell" key={d.day}>
                    <b>{d.day}</b>
                    <span>
                      from {istTime(d.first)}
                      {d.count > 1 ? ` · ${d.count} times` : ""}
                    </span>
                  </div>
                ))}
              </div>
              <p className="inst-foot">
                {preview.total} open time{preview.total === 1 ? "" : "s"} across the next{" "}
                {PREVIEW_DAYS} days · all times IST
              </p>
            </div>
          ) : null}
          {/*
            The homepage shows everyone while there are three. The page it
            links to is the one that filters, sorts and shows when each of
            them is next free — and it is where this section stops scaling.
          */}
          {experts.length > 0 ? (
            <p className="see-all">
              {/*
                Filled: it is alone on its row, so there is no alternative for
                it to be the lesser half of. An outline button with nothing
                beside it is a button apologising for itself.
              */}
              <Link className="b b-fill" href="/experts">
                See all experts
              </Link>
            </p>
          ) : null}
        </div>
      </section>

      <section className="band alt" id="how">
        <div className="wrap">
          <div className="band-head">
            <span className="eyebrow">How it works</span>
            <h2>
              From a question to a <span className="said">conversation</span>.
            </h2>
            {/*
              Was "your review, effortlessly", which promised ease two lines
              above the one bit of work we ask for. Naming that work is more
              persuasive than hiding it: people who will not open what they
              hold are people this product cannot help.

              "One piece of work on your side" meant the intake form, which
              is switched off. The work left is turning up with the portfolio
              open, which is a smaller ask and still an ask — so it is still
              named rather than smoothed away.
            */}
            <p>Three steps. Nothing to fill in first.</p>
          </div>
          {/*
            THREE, NOT SIX, AND THE SIX ARE ALL STILL HERE.

            The reference runs this section as three, and the count is the
            argument: three steps is a small thing, six is a process. Ours
            said "nothing to fill in first" directly above six numbered
            cards — a sentence and a layout disagreeing in one glance.

            Nothing was dropped to get there. Every fact the six carried is
            in the three: the question can be a holding, a company or a
            sector; the expert is chosen by a person rather than matched by
            software; availability is live and nobody emails you back; there
            is no form; the call is one to one with the portfolio open and
            read back; and nothing renews afterwards. What went is the
            numbering of them, not the content.
          */}
          <div className="flow">
            <div className="flow-step">
              <p className="n">01</p>
              <h3>Your question, your expert</h3>
              <p>
                A holding, a company, a sector &mdash; however it arrives. You pick the
                person, not a matching algorithm.
              </p>
            </div>
            <div className="flow-step">
              <p className="n">02</p>
              <h3>A real slot</h3>
              <p>
                Live availability, booked in the open. Nobody emails you back, and there
                is nothing to fill in first.
              </p>
            </div>
            <div className="flow-step">
              <p className="n">03</p>
              <h3>The call, then nothing</h3>
              <p>
                One to one, your portfolio open on your screen and read back to you.
                Nothing renews and nobody follows up.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/*
        Pricing sits after the people, not before them.

        It used to lead, on the reasoning that a list of names means nothing
        until you know what you can buy. The page argued the opposite of
        itself: this section's own button says "Find an expert", and it
        pointed DOWN at #experts — asking for a decision between 5,499 and
        2,45,000 and then sending the reader off to see who they would be
        talking to.

        The nav had the better order all along — Audit, How it works,
        Packages — while the page ran Packages first, so clicking "Packages"
        in the nav jumped backwards past two sections nobody had read.

        What it is, who it is, how it works, then how much. A premium number
        is earned by the three sections above it; leading with it asks people
        to price something they have not been shown.
      */}
      {/*
        Who should not buy this, immediately before the price.

        PLACEMENT IS THE WHOLE ARGUMENT. "Terms of the thing" already says
        what the product is not, and the hero strip says it again in three
        words — a third block of negations further up the page would just
        be the site clearing its throat. Here it is doing work: it is the
        last thing somebody reads before ₹5,499, which is the moment a
        disqualification is worth something to both sides.

        CUSTOMER-FRAMED, NOT PRODUCT-FRAMED, which is what makes it a
        different block rather than a louder one. "Terms" says the product
        is not advice; this says you are not the buyer.

        Three, and the third is the one that matters. Nobody writes "you
        will not do the work" on a sales page, and it is the single
        biggest predictor of a wasted session: what you hold IS the
        product's input. It used to say "you will not write down what you
        hold", which was about the intake form — switched off, so the
        disqualifier moved to the thing now actually asked of somebody,
        which is opening the portfolio on the call.
      */}
      {/*
        What a book looks like, and what an expert asks about it.

        Replaces the "wrong thing to buy if" band, at Gaurav's request, with
        the tabbed-media shape from davidprotein.com. The trade is worth
        naming: that band turned people away, which is the strongest trust
        signal a SEBI-sensitive page has, and this one does the opposite job
        — it shows somebody their own portfolio in the list and gives them a
        reason to book. The disqualifiers still exist in the FAQ and in the
        terms; they no longer have a band of their own.

        The media is the book rather than a photograph, because there is no
        photography in this product and a placeholder where a picture goes
        would be worse than not borrowing the pattern at all.
      */}
      <section className="band" id="shapes">
        <div className="wrap">
          <div className="band-head idx">
            <span className="eyebrow">Before you pay</span>
            <h2>
              Find the one that looks like <span className="said">yours</span>.
            </h2>
            <p>
              Three shapes a book arrives in, and the first thing an expert asks about each.
              The figures are from the example record you can download.
            </p>
          </div>
          <BookShapes />
        </div>
      </section>

      <section className="band alt" id="ways">
        <div className="wrap">
          <div className="band-head idx">
            <span className="eyebrow">What it costs</span>
            <h2>One call, one price.</h2>
            <p>
              No packages, no passes, nothing to cancel. You pay for the call you book,
              and you book the next one when you want it.
            </p>
          </div>

          <div className="price-one">
            <p className="price-one-fig">{rupees(SINGLE_CALL_PAISE)}</p>
            <p className="price-one-per">
              one call &middot; one to one &middot; video
            </p>
            <ul>
              {/*
                Was "an expert with your holdings in front of them for the
                call", which the intake form was what made true. With
                ASK_FOR_INTAKE off nothing collects them, so the claim went
                with it — the same correction this page's own note describes
                being made in nine places once already.
              */}
              <li>
                {ASK_FOR_INTAKE
                  ? "An expert with your holdings in front of them for the call"
                  : "An expert who reads your portfolio with you, on the call"}
              </li>
              <li>A specific question, a sector, or a second opinion</li>
              <li>What they saw, written up afterwards and yours to keep</li>
            </ul>
            <a className="b b-fill" href="/experts">
              Find an expert
            </a>
          </div>
        </div>
      </section>

      {/*
        What people said — absent until anybody has said anything.

        Here because the reference puts it here and the reason is sound:
        editlobby.com runs its three named quotes at roughly 70% of the
        page, after the price and before the objections. That is the moment
        a reader has seen a number and wants to know whether anyone has
        paid it.

        `band` rather than `band alt`, and that is not a coin toss. The
        bands alternate their stripe, so a section that appears only when
        data exists shifts every stripe after it the day the first quote
        lands.

        That used to be waved away as costing nothing in either state. It
        does not: a transparent band still occupies a position, so with a
        quote in place this one and the band below it were both untinted
        and read as a single slab. Nobody saw it because the array has
        always been empty.

        So the four bands after it derive their stripe from whether this
        one renders, instead of being hand-maintained against a condition.
      */}
      {TESTIMONIALS.length > 0 ? (
        <section className="band">
          <div className="wrap">
            <Testimonials />
          </div>
        </section>
      ) : null}

      <section className={QUOTED ? "band alt" : "band"}>
        <div className="wrap">
          <div className="band-head">
            <span className="eyebrow">Terms of the thing</span>
            <h2>What this is not.</h2>
          </div>
          <div className="nots">
            <div className="not">
              <p>
                <b>Not a tip, a call, or a target.</b> Nobody tells you what to buy.
              </p>
            </div>
            <div className="not">
              <p>
                <b>Not personalised investment advice.</b> A session is a review and a discussion.
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
          </div>
        </div>
      </section>

      <section className={QUOTED ? "band" : "band alt"} id="faq">
        <div className="wrap">
          <div className="band-head">
            <span className="eyebrow">Frequently asked</span>
            <h2>Still curious?</h2>
          </div>
          <div className="faq">
            <details>
              <summary>Do I need to share my demat login?</summary>
              <p>
                No. You show your expert what you hold on the call, in your own words and on your
                own screen — never login credentials. There is no field anywhere on Landline that
                accepts one.
              </p>
            </details>
            <details>
              <summary>Is this AI reading my portfolio?</summary>
              <p>
                No. A named person with market experience reads what you send and talks to you about
                it. Nothing on this platform generates an automated verdict on your holdings.
              </p>
            </details>
            <details>
              <summary>Do experts give stock tips?</summary>
              <p>
                No. Experts review your existing portfolio and approach. They do not recommend
                specific trades, and nothing said on a call is personalised investment advice.
              </p>
            </details>
            <details>
              <summary>Do I get anything in writing?</summary>
              <p>
                Your expert writes up what the session covered, and it sits in your console beside
                what you sent them. It is a record of what was discussed — not a recommendation, and
                not something to act on by itself.
              </p>
            </details>
            <details>
              <summary>What happens to my portfolio details afterwards?</summary>
              <p>
                They go only to the expert you booked, and are deleted {INTAKE_RETENTION_DAYS} days
                after the call — along with whatever your expert wrote up afterwards.
              </p>
            </details>
            <details>
              <summary>What if I am not satisfied with the call?</summary>
              <p>
                Email <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> within 24 hours and we
                will arrange a follow-up or a refund, case by case.
              </p>
            </details>
            {/*
              Last, not first. Somebody scanning this list wants to know about
              their demat login before they want the brand story — but the name
              is the promise, and nowhere else on the site explains it.
            */}
            <details>
              <summary>Why is it called Landline?</summary>
              <p>
                Because a landline is the opposite of how market advice usually reaches you: no
                forwarded screenshot, no broadcast channel, no algorithm choosing who you hear
                from. One person on the other end who has read what you hold. Then it hangs up &mdash; nothing renews and nobody follows up.
              </p>
            </details>
          </div>
        </div>
      </section>

      <section className={QUOTED ? "band alt closer" : "band closer"}>
        <div className="wrap">
          <h2>One call. One honest read.</h2>
          {/*
            Was "You book. They look. You decide."

            "Look" was the problem. Every other line on this site says READ —
            the audit section, step 05, the page title — because the read is
            the whole product. "Look" is a glance, and it was the last verb
            before the two buttons.

            READ ON THE CALL, not before it. The site used to promise in nine
            places that the expert arrived having already been through your
            portfolio, which was never something we could make true: what an
            expert does with the intake before the session is their business,
            and the session is where the work happens. What the software
            actually guarantees is that the intake is on their screen for the
            call, so that is what the copy says now.

            "You book" and "You decide" described the process for the fourth
            time on one page, after the six steps and the FAQ have both covered
            it. Somebody who has read this far does not need the order of
            events again; they need the last objection answered. So the second
            clause answers it: no, this is not a sales call. That promise fell
            off the hero when the sub-headline went, and it does more work here
            than it ever did there.

            Two clauses, not three. The first draft kept the triple and ran to
            67 characters, which wrapped as "You talk it / through" — a line
            that breaks inside a clause is worse than a line that is short.
          */}
          {/*
            A span per sentence so the only place this can break is between
            them. Left to itself it wrapped as "They read it first. Nobody /
            sells you anything." at 375 — measured, not guessed: the two line
            boxes came back 196px and 147px, and the first sentence is the
            shorter of the two, so the break could not have been at the stop.

            "First" became "with you" when the intake form was switched off.
            The intake was the thing that made reading it beforehand true,
            and this is the most prominent sentence on the page to leave
            saying otherwise. Re-measured at 375 after the change.
          */}
          <p className="closer-line">
            <span>They read it with you.</span> <span>Nobody sells you anything.</span>
          </p>
          <div className="b-pair">
            <Link className="b b-fill" href="/experts">
              Find an expert
            </Link>
            <a className="b b-line" href="#audit">
              Audit my portfolio
            </a>
          </div>
        </div>
      </section>

      {/*
        Supply is the constraint on this business, and until now the only way
        in was a footer link. Placed after the customer story rather than
        inside it: somebody reading this page is usually a customer, and the
        few who are not should not have to hunt.
      */}
      <section className={QUOTED ? "band recruit" : "band alt recruit"}>
        <div className="wrap">
          <span className="eyebrow">For market professionals</span>
          {/*
            Was "Do you take these calls?", which asks a question the reader
            has no way to answer — "these calls" is a thing they have not
            read about yet, since this band sits at the very bottom of the
            page. A statement they recognise does the work instead: the
            people this is aimed at are already asked, for nothing, by
            everybody who knows what they do. The line below then lands on
            the part that is new, which is being paid for it.
          */}
          <h2>You already take these calls.</h2>
          <p>
            Be useful and paid, without taking on a client. Your own rate, your own hours, and
            nothing to sell.
          </p>
          <Link className="b b-line" href="/apply">
            Take calls on Landline
          </Link>
        </div>
      </section>

      </main>
      <SiteFooter onLanding />

      {/* Phone only, and only once the hero has scrolled away. */}
      <PhoneCta />
    </div>
  );
}
