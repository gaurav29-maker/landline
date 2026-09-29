import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { experts as expertsTable } from "@/lib/db/schema";
import { openSlotsFor } from "@/lib/availability";
import { istDayLabel, istTime, rupees } from "@/lib/format";
import { SLOT_MINUTES } from "@/lib/slots";
import { CONTACT_EMAIL, INTAKE_RETENTION_DAYS, SINGLE_CALL_PAISE } from "@/lib/constants";
import ExpertGrid, { type ExpertCard } from "@/components/ExpertGrid";
import SiteNav from "@/components/SiteNav";
import SiteFooter from "@/components/SiteFooter";
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

/*
 * A worked example, because the page had nothing to look at.
 *
 * The whole site was type: no image, no screenshot, no specimen, across
 * nine screens. It asserted that an expert reads your portfolio and then
 * listed eight nouns. This is the same claim shown instead of stated.
 *
 * INVENTED. There is no client here and the figures describe nobody. That
 * is said in the markup, not only in this comment, because a reader cannot
 * see this comment — and a page selling portfolio reviews must never let
 * an illustration be mistaken for somebody's real holdings or results.
 *
 * Every line is STRUCTURAL: what the portfolio is made of and how it is
 * shaped. Nothing says buy, sell, hold, or what anything is worth, because
 * that is the line the terms already draw — a Landline session is a review
 * and a discussion, never personalised investment advice. The closing line
 * of the block says so in the reader's words rather than the lawyer's.
 *
 * Absent on purpose, as they were from the list of eight this replaced:
 * thesis development, hedging and derivative strategy. Those are advisory
 * activities and this platform is not a registered adviser.
 */
const SAMPLE_SHAPE: { label: string; value: string }[] = [
  { label: "Holdings", value: "14 stocks, 3 funds" },
  { label: "Largest position", value: "22%" },
  { label: "Top three", value: "51%" },
  { label: "Largest sector", value: "Banking, 38%" },
  { label: "Fund overlap", value: "6 names held twice" },
  { label: "Cash", value: "4%" },
];

const SAMPLE_FINDINGS: { head: string; body: string }[] = [
  {
    head: "Half the book is in three names",
    body: "Concentration is a decision, and it is worth knowing whether this one was made on purpose or arrived at one buy at a time.",
  },
  {
    head: "The funds are less diversified than the count suggests",
    body: "Two of the three hold six of the same companies, and those companies are also held directly. One position is being taken three ways.",
  },
  {
    head: "The portfolio carries a sector tilt",
    body: "Banking is 38% of the book. That is a view on banking, whether or not it was described as one.",
  },
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

  return (
    <div className="site">
      <SiteNav onLanding />

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
              {panel.years === 1 ? "" : "s"} of market experience
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
            <h2>A real expert reads your actual portfolio.</h2>
            <p>Not an automated score.</p>
          </div>


          {/*
            The specimen. See the note on SAMPLE_SHAPE: invented, and said
            to be invented where a reader can see it rather than only in a
            comment. The label is the first thing in the block and the last
            line repeats it, because this is the one place on the site where
            being mistaken for a real client's numbers would matter.
          */}
          <div className="spec">
            <p className="spec-flag">
              <span className="eyebrow">An example — not a client</span>
              <span className="spec-note">
                Invented to show the shape of a review. The figures describe nobody, and no
                Landline session has been reproduced here.
              </span>
            </p>

            <div className="spec-body">
              <div className="spec-col">
                <p className="eyebrow">What was sent in</p>
                <dl className="rec spec-rec">
                  {SAMPLE_SHAPE.map((r) => (
                    <div key={r.label}>
                      <dt>{r.label}</dt>
                      <dd>{r.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>

              <div className="spec-col">
                <p className="eyebrow">What the expert said back</p>
                <ol className="spec-findings">
                  {SAMPLE_FINDINGS.map((f) => (
                    <li key={f.head}>
                      <h3>{f.head}</h3>
                      <p>{f.body}</p>
                    </li>
                  ))}
                </ol>
                <p className="spec-not">
                  What a review does not contain: what to buy, what to sell, or a price target.
                  That is the difference between a review and a tip.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="band" id="experts">
        <div className="wrap">
          <div className="band-head idx">
            <span className="eyebrow">The expert network</span>
            <h2>
              The right expert changes the <span className="said">conversation</span>.
            </h2>
            <p>Every expert shows their SEBI registration, or says plainly that they have none.</p>
          </div>
          <ExpertGrid experts={experts} dbReady={dbReady} />
          {/*
            The homepage shows everyone while there are three. The page it
            links to is the one that filters, sorts and shows when each of
            them is next free — and it is where this section stops scaling.
          */}
          {experts.length > 0 ? (
            <p className="see-all">
              <Link className="b b-line" href="/experts">
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
              persuasive than hiding it: people who will not write down what
              they hold are people this product cannot help.
            */}
            <p>Six steps. One piece of work on your side.</p>
          </div>
          <div className="flow">
            <div className="flow-step">
              <p className="n">01</p>
              <h3>Your question</h3>
              <p>A holding, a company, a sector. However it arrives.</p>
            </div>
            <div className="flow-step">
              <p className="n">02</p>
              <h3>Your choice of expert</h3>
              <p>A person, not a matching algorithm.</p>
            </div>
            <div className="flow-step">
              <p className="n">03</p>
              <h3>A real slot</h3>
              <p>Live availability. Nobody emails you back.</p>
            </div>
            <div className="flow-step">
              <p className="n">04</p>
              <h3>Your holdings, written down</h3>
              <p>Five minutes. The only work on your side.</p>
            </div>
            <div className="flow-step">
              <p className="n">05</p>
              <h3>{SLOT_MINUTES} minutes</h3>
              <p>One to one, with somebody who has read it.</p>
            </div>
            <div className="flow-step">
              <p className="n">06</p>
              <h3>It stops</h3>
              <p>Nothing renews. Nobody follows up.</p>
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
        One product.

        This was three rungs — a call, a quarterly pass and an annual pass —
        plus a bundle offered in the booking dialog. All four are still built
        and still honoured; they are simply no longer for sale.

        The arithmetic is why. At a 2,200 payout a single call earns 3,299
        and the three-call bundle earns 3,399: three times the work and three
        times an expert's diary for a hundred rupees more. The discount was
        funded entirely out of margin, because the third call costs exactly
        what the first one does — this is a person's time, not software, and
        it does not get cheaper with volume.

        The passes had the same shape of problem from the other end. Unlimited
        for 90 days breaks even at 20.5 calls, so one enthusiastic member
        erases the margin — and an unlimited pass selects for exactly that
        member. Four quarterlies also cost less than one annual for identical
        coverage, which the price list has said in a comment since September.

        Nothing is deleted. /api/memberships/*, /api/bundles/hold and
        /api/bookings/redeem all still work, the console still honours a pass
        or a bundle somebody holds, and the suite still proves it. Selling
        them again is putting the markup back, not rebuilding the product.
      */}
      <section className="band" id="ways">
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
              one call &middot; {SLOT_MINUTES} minutes &middot; video
            </p>
            <ul>
              <li>An expert with your holdings in front of them for the call</li>
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
        data exists would shift every stripe after it the day the first
        quote lands. Transparent, it costs nothing in either state: empty
        it renders no element at all, and full it sits in the page colour
        with its own heading and the band padding either side.
      */}
      {TESTIMONIALS.length > 0 ? (
        <section className="band">
          <div className="wrap">
            <div className="band-head idx">
              <span className="eyebrow">What people said</span>
            </div>
            <div className="voices">
              {TESTIMONIALS.map((t) => (
                <figure className="voice" key={t.name + t.quote.slice(0, 24)}>
                  <blockquote>{t.quote}</blockquote>
                  <figcaption>
                    {t.name}
                    {t.note ? <span>{t.note}</span> : null}
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <section className="band alt">
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

      <section className="band" id="faq">
        <div className="wrap">
          <div className="band-head">
            <span className="eyebrow">Frequently asked</span>
            <h2>Still curious?</h2>
          </div>
          <div className="faq">
            <details>
              <summary>Do I need to share my demat login?</summary>
              <p>
                No. You share a summary of your holdings before the call — never login credentials.
                There is no field anywhere on Landline that accepts one.
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
                from. One person on the other end who has read what you hold, for {SLOT_MINUTES}
                minutes. Then it hangs up &mdash; nothing renews and nobody follows up.
              </p>
            </details>
          </div>
        </div>
      </section>

      <section className="band alt closer">
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
          */}
          <p className="closer-line">
            <span>They read it first.</span> <span>Nobody sells you anything.</span>
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
      <section className="band recruit">
        <div className="wrap">
          <span className="eyebrow">For market professionals</span>
          <h2>Do you take these calls?</h2>
          <p>
            Be useful and paid, without taking on a client. Your own rate, your own hours, and
            nothing to sell.
          </p>
          <Link className="b b-line" href="/apply">
            Take calls on Landline
          </Link>
        </div>
      </section>

      <SiteFooter onLanding />
    </div>
  );
}
