# The first five calls

**6 November 2026.** A demand test, and the model it is meant to settle.

Written after a session on pivoting Landline to a marketplace of SEBI-registered
advisers. The pivot may well be right. This document exists because it cannot be
evaluated yet, and building it first would be building on an assumption nobody
has tested.

---

## The one thing being tested

> **Will an Indian retail investor pay ₹5,499 to spend 45 minutes with a
> stranger, about money they already hold?**

Landline has existed for months. It has one listed expert, a booking flow that
passes 171 checks, a payment integration, a console, a record a member keeps,
and nine sections of home page. It has **zero completed sessions**.

Every other question is downstream of this one. If the answer is no, the
marketplace has no demand to aggregate and recruiting fifty advisers produces
fifty people waiting on an empty platform — which is a worse position than one.

## What this is NOT testing

Naming these, because the temptation is to fold them in and learn nothing
cleanly:

- Whether SEBI-registered advisers will join. (Supply. Later, and only if this
  passes.)
- Whether the rails/subscription model works. (Needs advisers first.)
- Whether the site converts. Five calls will be sold by hand, not by the
  funnel. The funnel is tested when there is something proven to funnel.
- Whether ₹5,499 is the optimal price. It tests whether it is a *possible*
  price.

---

## Who to approach

In descending order of signal. The order matters more than the count.

**1. People who already ask Gaurav for free advice.** The strongest demand
signal that exists, because it is revealed rather than stated. Someone who has
already messaged him about a holding has done the hardest part — admitted they
want a second opinion. The ask is: *"I'm doing these properly now, it's ₹5,499
for 45 minutes. Want one?"*

**2. Second-degree contacts.** Someone a colleague or client suggests, who does
not know Gaurav personally. This is the first real test, because politeness is
not available as a motive.

**3. Strangers from one public post.** One post, one place — wherever Gaurav
already has a reputation. Not a campaign. If one post to an existing audience
produces nothing, that is a finding.

### Who to avoid

**Friends.** A friend paying ₹5,499 to be supportive is the classic false
positive, and it is indistinguishable from real demand until you have built
six months on top of it. If a friend insists, take the call and **do not count
it**.

**Anyone offered a discount.** The price is part of the hypothesis. A call sold
at ₹2,000 tests a different business.

---

## What counts as a pass

All five must be true:

1. **Five people pay the full ₹5,499**, none of them a friend, none discounted.
2. **At least three arrive with a question that matches one of the six shapes**
   already written on the site — concentrated, scattered, derivatives,
   inherited, first year, overlap. If nobody's situation resembles any of them,
   the copy is describing a customer who does not exist.
3. **Nobody asks for a tip, a target, or a specific trade** — or if they do,
   they accept the answer and stay. This tests whether the honest positioning
   survives contact with a real buyer, which is the thing the whole site is
   built on.
4. **At least two ask, unprompted, when they can book again.** One-shot demand
   and repeat demand are different businesses, and the marketplace economics
   are much worse for the first.
5. **The record gets downloaded** by at least three of them. If the artefact
   nobody has tested goes unopened, it is not the differentiator the page says
   it is.

## What to record, per call

Short, same six fields each time. This is the whole dataset.

| | |
|---|---|
| Where they came from | which of the three sources above |
| What they arrived with | in their words, before any framing |
| Which shape it matched | or "none" |
| What they expected to get | asked before the call |
| What they said afterwards | asked within 24 hours |
| Would they pay again, and how much | asked plainly |

---

## What each outcome means

**Five pay, three repeat.** Demand exists at this price. Proceed to supply — and
the RIA pivot gets stronger, because now you know what to recruit *for*: you
have five real situations to match advisers against, rather than a guess.

**Five pay, none repeat.** It is a one-shot product. The marketplace take on a
single introduction is then the entire lifetime revenue per customer, which
makes the rails subscription load-bearing rather than optional — and makes the
newly-registered-RIA wedge more important, not less.

**They pay but want tips.** The buyer who will pay is not the buyer the site
describes. This is the most dangerous pass, because the money is real and the
temptation to serve them is enormous. It is also the moment the SEBI exposure
stops being theoretical.

**Two or three pay, slowly.** Price is probably wrong, or the proposition needs
a sharper situation. Re-run at a different price before concluding anything
about the model.

**Nobody pays.** The pivot is not the problem and neither is the site. Something
upstream is — most likely that "a review of what you already hold" is a thing
people want and not a thing they buy. Worth knowing before fifty advisers are
recruited into it.

---

## The model this is meant to settle

Recorded so the test has something to resolve against. None of it is decided.

- **Marketplace at the front, rails underneath.** A take on a standardised first
  session; a subscription to the adviser for the compliance layer — agreements,
  risk profiling, record-keeping, fee collection, audit pack.
- **Leakage priced in, not fought.** An RIA relationship is worth far more than
  the take on one call. Off-platform clauses are unenforceable and sour supply.
  Get paid whether or not the relationship stays on the surface.
- **One comparable unit at the door, anything behind it.** The ₹5,499 call stays
  standard, because a marketplace needs something comparable. What the adviser
  sells afterwards is theirs.
- **Wedge: newly registered RIAs with no book.** India has roughly 1,000–1,300
  registered Investment Advisers. SEBI's 2024–25 reforms lowered the barrier and
  are adding to that number now. The established ones with full books do not
  need a platform; the newly licensed with zero clients do.
- **Situation-led front door.** Index on "my father left a portfolio", not on
  adviser profiles.

### Open questions for a lawyer, before any of it is built

- Whether a platform take sitting alongside a capped RIA fee is clean, and how
  it must be structured and disclosed.
- Whether the platform itself needs any registration to intermediate advice.
- What the platform's liability is for advice given by a listed adviser.

### One schema note

`sebiRegType` is already `ria | ra | none`. Dropping `none` turns today's claim
— *we show you the registration either way, even when it says Not registered* —
into a stronger one: **everyone here is registered, and it was checked.** It is
a one-value change and it is not urgent. It waits on the demand answer, because
it shrinks supply to a pool of about 1,300 people and Gaurav may not be in it.
