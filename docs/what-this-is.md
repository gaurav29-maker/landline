# What Landline is

Written 27 October 2026, from the code rather than from memory, after a long
session of building and several corrections. It exists so that the next person
— or the next agent — can tell within five minutes whether a change belongs
here, and so that Gaurav can see where my understanding is wrong and say so.

Everything in **What I am unsure about** at the end is a real question, not
false modesty.

---

## The one sentence

A marketplace where a person who manages their own money pays a market
professional for one honest hour, on video, about the portfolio they already
hold — and then nothing happens until they decide it should.

## The two sides

**The client** is an Indian retail investor who manages their own portfolio,
has a question they have been sitting on, and has nowhere good to take it.
Their alternatives are a relationship manager who earns on what they sell, a
WhatsApp group, or a YouTube channel. They are not looking for someone to
take the money off their hands. They want a second opinion from somebody who
has actually done this, once, without acquiring an ongoing relationship.

**The expert** is a market professional — a fund manager, an analyst, a
trader, someone who has run institutional money — who is willing to be useful
for an hour at a price they set themselves. They are explicitly not taking on
a client. No mandate, no onboarding, no ongoing obligation. They set their own
rate and their own hours, and the software holds them to what they published.

The platform's job is to put those two people on a call and then get out of
the way.

## What it sells

Priced in `lib/constants.ts`, one source of truth for the whole site.

| | Price | What it is |
|---|---|---|
| Single call | ₹5,499 | One session, no time limit |
| Three-call bundle | ₹9,999 | ₹3,333 a call, expires in 60 days |
| Quarterly pass | ₹45,000 | 90 days, unlimited, no throttle |
| Annual pass | ₹2,45,000 | 365 days, unlimited |

Two things about that ladder are knowingly odd and were shipped anyway: four
quarterly passes cost ₹1,80,000 against ₹2,45,000 for an annual with identical
coverage, and the bundle sells calls at a 39% discount to list, the widest gap
in the ladder.

A pass is **bought outright, not auto-renewed**. That sidesteps the RBI
e-mandate framework, and it means the renewal prompt in the console is not a
nudge — it is the entire renewal mechanism. Without it, people simply lapse.

Experts set their own price within `PRICE_MIN_PAISE` and `PRICE_MAX_PAISE`,
and an expert can sell more than one product — a long audit and a short second
opinion, say. The payout is `EXPERT_SHARE_BPS`, 80%, **of the product's price
rather than the amount charged**, so a pass-covered session still pays the
expert properly.

## The call

Forty-five minutes blocks the calendar. **The call itself has no time limit**
— that is the promise, and it is the right one. It has a scheduling
consequence that took a while to see: slots used to be generated back to back,
so a session running ten minutes over made the next caller wait. There is a
fifteen-minute gap now, which also lands the grid on the hour and costs about
22% of a day's capacity. That trade was made deliberately.

## What it refuses to be

This is the part that makes it different, and most of it is enforced in code
rather than promised in a paragraph.

**It is not advice.** Nobody is told what to buy. The expert's written note
records what was *discussed*, never what was *recommended* — "discussed the
concentration in IT and how it got there" is an account of a conversation;
"advised cutting IT to 30%" is a personalised recommendation sitting on
Landline's servers, which is the exact thing the terms say does not happen.
The wording of that field is load-bearing and the expert console says so at
the point of writing.

**Nobody sells you anything.** The payout is a share of the session, not a fee
for distributing a product, so nobody on the platform earns more because you
hold one thing rather than another.

**It never touches the money.** There is nothing to hand over and no mandate.
You leave the call holding exactly what you held walking in.

**It never asks for a broker login.** Not as an option, not "read-only". There
is no field anywhere in the product that accepts one, which is the cheapest
possible way to keep that promise.

**There is no marketing email.** Every sender in `lib/email.ts` is named after
an event that happened to one booking, and a test refuses a new one that is
not on an approved list. No newsletter, no subscribe box.

**There is no analytics and no tracker.** Stated on `/principles` and checked
by a test, so adding one breaks the build rather than quietly making the page
a lie.

**There are no fabricated reviews, testimonials or vetting claims.**
`lib/testimonials.ts` is an empty array on purpose and the block renders
nothing until a real person says a real thing. There are no ratings at all.

**It turns people away.** The home page carries a section saying this is the
wrong thing to buy if you want somebody to manage it for you, if you want to
be told what to buy, or if you will not open your portfolio on the call.

## The regulatory frame

Indian, and it shapes nearly every decision.

- **SEBI.** The platform does not give investment advice and is careful never
  to look as though it does. An expert's SEBI registration status is published
  either way — "Not registered" renders rather than disappearing — because a
  missing answer is not an option the software offers.
- **DPDP Act 2023.** Three of the four data rights are self-serve: the export
  at `/member/data` names who each piece has been shared with, and account
  deletion erases the person while keeping the financial record with the
  person taken out of it. Only nomination still routes through a human.
- **TRAI DLT.** Phone sign-in cannot send a code until the business is
  registered as a Principal Entity, a header is approved, and a content
  template is approved against it. This is the longest lead time in the
  project and it is blocked on the entity decision.
- **Tax and company law.** Booking and payment records survive account
  deletion because they must. How long depends on whether the business is a
  company, an LLP or a proprietorship, which is still undecided — so the
  software refuses to quote a period rather than guess.

## Where it is

Four complete surfaces: the public site, the member console, the expert
console, and an ops console with an append-only audit trail. 33 pages, 27
route handlers, 171 checks against a real database and a running server.

**It has never taken a rupee or sent a message.** Razorpay, Resend and the SMS
provider are all unconfigured. Development prints emails and SMS codes to the
console so every flow completes on a laptop; production refuses rather than
dropping them silently.

**There is one live expert.** Two more exist as drafts on purpose — nobody
goes live because a fixture said so.

As of today the directive is to build the platform out completely before
recruiting supply.

## Two decisions from this session worth carrying forward

**The intake form is switched off.** It used to be a form filled before each
call. The reasoning for removing it was that the expert will have the right
data, so asking the client to type their holdings is work for nothing. It is
hidden behind `ASK_FOR_INTAKE` rather than deleted, because The Log is built
entirely on intake payloads.

**That left a hole nobody has filled yet.** The Log — first-session holdings
against latest, the most distinctive thing in the product — renders only when
there are two snapshots to compare. With the intake off, no new member will
ever have one, so it silently never appears. The portfolio feature now
half-built (`lib/portfolio.ts`, `portfolio_snapshots`) is the intended fix: a
portfolio that lives on the account, maintained by the client, visible to an
expert they have booked, with successive versions forming the series The Log
plots. **Until that ships, a flagship feature is dark.**

## What I am unsure about

These are genuine, and getting them wrong changes what gets built.

1. **Where the holdings data actually comes from.** The stated premise is that
   experts will have the right data. There is no broker or demat integration,
   and the FAQ promises there is nowhere to put a login. So unless the
   portfolio feature is the answer, an expert's only source is what the client
   says on the call — which is fine, but it means The Log and the session
   record have nothing structured to hold.

2. **Whether this is one marketplace or ten.** The specialism taxonomy is two
   values. A platform where people browse for the expert who fits their need
   implies many more, and that list becomes the navigation, the filters and
   the SEO surface all at once.

   The machinery is already there, which I got wrong once and should not
   again: `app/experts/(list)/page.tsx` filters by focus off `specialties`
   and sorts by experience or price, URL-backed. Widening the enum lights up
   a browse page that exists. It is the list that is thin, not the plumbing.

3. **Ratings and reviews.** Every marketplace has them and this one has none.
   On a SEBI-sensitive service a star average reads as a performance claim,
   and fabricated reviews carry real exposure under the Consumer Protection
   Act 2019. I do not know whether their absence is a principle or a gap.

4. **Who the first hundred clients are and where they come from.** There is no
   content surface, no specialism landing pages, nothing for somebody
   searching a specific question. At ₹5,499 a call this needs either organic
   search or a referral loop, and neither exists in the software.

5. **Whether the price ladder is intentional.** Four quarterlies costing less
   than one annual is either a decision or an oversight, and it is recorded as
   a decision.
