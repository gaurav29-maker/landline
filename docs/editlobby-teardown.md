# editlobby.com — a teardown

Written 2 November 2026, walking the site section by section with a CMO's
eye and a CDO's. Every number here was read off computed styles in a real
browser at 1440 and at 375 — nothing is estimated from a screenshot. Where
something is inference rather than measurement it says so.

The purpose is Landline, so each section ends with what ours is and what it
should be. **They sell a video editing service. We sell access to a market
professional. The product is different and the machine is the same**: a
stranger arrives cold, has to believe a human will do skilled work for a
knowable price, and has to book before they leave.

---

## 1. The system, before the sections

### Type

One ladder, breakpointed rather than fluid. Measured at five widths:

| | 375 | 810 | 1280 | 1440 | 1920 |
|---|---|---|---|---|---|
| hero h1 | 36 | 72 | 96 | 96 | 110 |
| section h2 | 28 | 54 | 72 | 72 | 72 |
| section label | 14 | 16 | 16 | 16 | 16 |
| section sub | 16 | 18 | 22 | 22 | 22 |
| card title | 24 | — | 28 | 28 | 28 |
| card body | 18 | — | 16 | 16 | 16 |
| button label | — | — | 21 | 21 | 21 |

**The section heading is three quarters of the hero heading at every width.**
That single ratio is the whole system. A section opens as loudly as the page
does, one notch quieter.

Weights: **500** for everything that reads — headings and body alike. **700**
for labels and card titles. 900 appears only in footer column heads. There is
no 400 body text anywhere above the legal type.

Tracking: **−0.05em on display sizes** (h1, h2 at ≥810), **−0.02em on
everything else**, and the only positive tracking on the entire page is the
hero's 11px eyebrow at +1.6px. Line heights: 1.1 display, 1.2 heads, 1.5
subs, 1.3 body, 1.0 labels.

Faces: **Satoshi** (Fontshare) for everything, **Instrument Serif italic**
for one or two words inside a heading. That italic is the only decoration on
the page and it is used about six times in 10,350px of scroll.

### Colour and material

- Ground `rgb(10, 10, 12)`. Not black — a hair of blue in it.
- Accent `#AE94FF`, a soft lavender. It carries the primary button, the
  hero eyebrow, and almost nothing else.
- Primary button: lavender fill, **black** label. Secondary: `rgba(13,13,13,0.5)`,
  light label, no border.
- Buttons are 68px tall, `24px 48px` padding, `999px` radius, 21px/500 label.
- **Their feature cards have no card.** 24px radius, `48px 36px` of padding,
  background fully transparent, border width 0. The "card" is spacing and
  nothing else. This is the single biggest visual difference from ours and
  the one I would steal first.

### Rhythm

Page is 10,350px at 1440. Twelve sections. Section heads are centred, label
→ heading gap **20px**, heading → sub gap **16px**. Content container 1200px
with the inner measure at 1104.

---

## 2. Section by section

### § 1 — Hero (0 → 700px)

> `10000+ Videos Delivered` · **We _edit_ really cool videos in 48-72hrs.** ·
> Affordable, fast and human powered video edits. · [Book a call] [See plans]
> · *avatars* Trusted by 100+ Brands

**CMO.** Four jobs in 700px, in the right order. The eyebrow is a *volume
claim* — it answers "has anyone else done this" before the headline asks for
anything. The headline is **what you get plus the constraint that makes it
credible**: not "great video editing" but "in 48-72hrs". A number in a
headline is a promise you can be held to, and that is exactly why it
converts. The sub is three adjectives — *affordable, fast, human powered* —
which pre-empts the three objections in order: price, speed, "is this AI
slop". Then two buttons: one for the talker, one for the self-server. Then
faces, because the last doubt is whether people exist behind it.

**CDO.** 700px box, content centred on both axes, 64px gutter at desktop and
24px on a phone, nav fixed on top so the hero starts at page y=0. Headline
96/500/−0.05em/1.1. One Instrument Serif italic word inside it. The logo
marquee lives *inside* the 700 box, near its bottom edge — not as a band
below.

**Landline.** Ours is structurally there: counted eyebrow, headline with the
italic voice, chips, two buttons. **The headline has no constraint in it.**
"Your direct line to a financial expert." has no 48-72hrs. Ours could carry
"in one call" or "in 45 minutes" — both true, both held to. And our hero's
bottom slot is empty where theirs carries social proof; we have no social
proof to put there, which is a real gap, not a styling one.

---

### § 2 — Logo marquee (inside the hero)

**CMO.** Borrowed authority, the cheapest kind. Nine logos, looping. Nobody
reads them; the *shape* of a logo row is the message.

**CDO.** Two identical tracks animating in sequence for a seamless loop. The
duplicate is aria-hidden.

**Landline.** We have this — the broker ticker, "Built for investors using".
Ours is honest in a way theirs is not: those are the brokers our clients
use, not clients of ours. Keep it, and keep the label that says so.

---

### § 3 — Work (1653 → 2509)

> `Our Work` · *grid of 8 vertical videos, each tagged SIMPLE or COMPLEX* ·
> [Book a call]

**CMO.** The proof section, and it is third because for a craft service
**the work is the argument**. The SIMPLE/COMPLEX tags are doing more than
they look: they teach the pricing model before the pricing section arrives,
so when "Simple 4-pack $55" and "Complex 4-pack $80" appear 3,000px later
the reader already knows what the words mean. That is good sequencing.

**CDO.** Eight 540×960 portrait tiles, horizontal rail. One button under it.
No heading at all — just the 16/700 label. The work is the heading.

**Landline.** This is our hardest section and the one with no honest answer
yet. **We have no portfolio** — a session is private, and showing it would
breach the thing we sell. Our nearest equivalent is `#shapes`: the sample
record, the shapes a portfolio arrives in, drawn from `lib/sample-record.ts`.
Worth asking whether that should move from slot 7 to slot 3, where they put
proof. Their tag trick is stealable: our chips could teach the price ladder.

---

### § 4 — Process (2509 → 3296)

> `Process` · **Your videos, effortlessly.** · Begin your editing journey in
> three effortless steps. · Buy / Brief / Review and Finalise · [Edit now!]

**CMO.** Three steps, three verbs, imperative. The job is to make the thing
feel *small*. Note what is absent: no timeline, no "onboarding", no account
setup. The word "effortless" appears twice in two lines, which is clumsy
writing doing effective work — it is the only promise the section makes.

**CDO.** Three cards, 368px each, flex row, zero gap, 24px radius,
transparent. Card title 28/500, body 16/500. Heading 72, sub 22, centred.

**Landline.** Ours is `#how` — "From a question to a conversation." / "Six
steps. Nothing to fill in first." **Six against their three.** Six steps is
not a small thing; it is a process. The sub does the right work ("nothing to
fill in first" is our "effortless") but six numbered cards argue against it.
Worth testing three.

---

### § 5 — Features (3296 → 5314)

> `How` · **Reasons Creators and Brands Choose Edit Lobby** · Quality
> checked, 48 hour delivery, and edits tailored to your brand every time. ·
> six cards

Six cards: Quality Checks · Lightning Fast Delivery · Simple, Flat Pricing ·
Built by Editors · Compatible Formats · True to You.

**CMO.** This is the objection-handling section and every card is an
objection in disguise: *will it be good* · *will it be late* · *will you
surprise me with a bill* · *will I have to explain my taste* · *will it work
where I post it* · *will it look generic*. Written as reasons, read as
reassurances. "Built by Editors" is the strongest — it is a **founder
credential doing the work of a testimonial**, and it costs nothing.

**CDO.** 3×2 grid, 368×319 cards, `48px 36px` padding, 24px radius, **no
background and no border**. Heading 72/500. Each card: 28/500 title, 16/500
body, roughly 12 words.

**Landline.** We do not have this section. We have "What this is not", which
is the same move inverted — refusal instead of reassurance — and it sits at
slot 9, after the pricing, where theirs is at 5, before it. **Objections
answered after the price are answered too late.** Our "Built by Editors"
equivalent writes itself: *built by someone who has run money*. Whether
that is true of Landline is Gaurav's to say, and if it is, it belongs here.

---

### § 6 — LobbyOS (inside Features, ~4199)

> **Upload. Review . Enjoy** · **New LobbyOS Dashboard** · *laptop
> screenshot* · [Learn More] [Login to LobbyOS]

**CMO.** The product-is-a-platform move. A service with a dashboard is a
*product*, and products are worth more than services. It also quietly
answers "what happens after I pay".

**CDO.** 64px Instrument Serif head over a 24px sans head, one wide image,
two buttons — one to learn, one for returning customers.

**Landline.** **This is the slot we have empty.** We have three consoles
built — member, expert, ops — and the home page never mentions any of them.
Noted as the one structural gap in the earlier comparison and it is still
the right call.

---

### § 7 — Pricing (5314 → 7191)

> `Pricing` · **Simple, Transparent Pricing** · No hidden fees. Just clear,
> flexible plans to suit your workflow. · tiered cards · Premium card ·
> **Find The Right Plan For You** → [Compare Plans & Pricing]

**CMO.** The anatomy is worth copying in full. Each card carries: a name, a
**pack-size toggle inside the card** (4 / 8 / 12), a per-unit price, a total,
a validity, a seven-line inclusion list, two exclusion bullets, and **two
buttons — Buy Now and Book a Call**. That last pair is the real lesson: every
price has an escape hatch to a human. "Most Popular" sits on the middle tier.
The Premium tier has no price, only "$500 onwards", which is how you keep an
enterprise conversation open. Then a compare-plans link for the people who
want a table.

**CDO.** Heading 72/500 centred, then left-aligned cards. Price 38/400,
pack name 26/700, feature lines 16/500. Premium is a 42/400 Instrument Serif
head — the serif marks the expensive tier.

**Landline.** `#ways`, "One call, one price." Our four products are a single
call, a 3-call bundle, a quarterly pass, an annual pass — a comparable
ladder. Two things to take: **two buttons per tier** (ours has one), and the
**in-card toggle** instead of four separate cards. Our known pricing oddity
(four quarterlies cost less than one annual) is exactly what a compare table
would expose, which is an argument for building one.

---

### § 8 — Testimonials + stats (7191 → 8345)

> `Our Testimonials` · six named quotes in a carousel · **10000+** Videos
> Delivered · **96%** Client Satisfaction Rate · **100+** Brands

**CMO.** Named, titled, company-attributed, long. Length is the signal —
a three-line quote reads as real in a way a one-liner does not. The stats
row underneath converts the qualitative into quantitative. Together they are
the heaviest-lifting 1,150px on the page.

**CDO.** Carousel with arrows, 36/500 stat numbers.

**Landline.** **We cannot copy this and must not fake it.** `lib/testimonials.ts`
is an empty array on purpose, there are no ratings anywhere, and a test fails
the build on invented metrics. One live expert and zero completed sessions
means every number in this section would be a lie. The slot stays dark until
a real client says a real thing. **If one thing in this document gets
ignored, let it be this section.**

---

### § 9 — FAQ (8345 → 9243)

> `Frequently Asked Questions` · **Have a different Question?** · Still
> curious? Our team is ready to help... · [Contact Us] · eight questions

**CMO.** The eight questions are all *post-purchase anxiety*: revisions,
scope, feedback windows, data security, what if I hate it, can I pick the
length. Nobody asks these before they have decided to buy — which means the
FAQ is positioned exactly right, after the price, as the last thing between
intent and action. The "ask a human" card sits *beside* the list, not after
it.

**CDO.** Two-column: the contact card left, the accordion right. 32/500 head.

**Landline.** Ours is `#faq` — "Frequently asked / Still curious?" Near
identical, including the phrase. Ours has no "ask a human" card beside it.
Given SEBI sensitivity, ours carries more weight than theirs does and could
be longer.

---

### § 10 — Closing CTA (9243 → 9658)

> **High-Quality Video Edits, Delivered in 48 - 72 Hours.** · Affordable,
> reliable, and tailored to your style, powered by real editors. ·
> [Book a call] [See plans]

**CMO.** The hero again, reworded, at 66px. Same promise, same two buttons,
no new information. That is the point — a reader who scrolled 9,000px gets
the offer restated rather than a new idea. Note "**powered by real editors**"
appears only here, at the bottom: the AI objection answered last, where it
lingers.

**CDO.** 66/500 head, 23/500 sub, the same two buttons.

**Landline.** Ours is the closer, "One call. One honest read." Right register,
no sub line under it. Theirs has one and it earns its place.

---

### § 11 — Footer (9658 → 10350)

> Navigate · Get in touch · Useful Links · **Are you an editor?** Think you
> have what it takes... [Join the team!] · ©EditLobby 2026

**CMO.** The supply-side ask lives in the footer, where it belongs — it is
addressed to a different reader than the whole page above it, and putting it
anywhere higher would interrupt the sale. "Think you have what it takes" is
a status filter, not a job ad.

**CDO.** Three link columns at 20/900 heads, then a bordered recruit card at
32/500 with a 42px lavender button.

**Landline.** Ours is the recruit band, "For market professionals" — but it
sits **above** the footer as its own full band, which gives it more weight
than a supply ask should have on a demand page. Theirs is the better
placement.

---

## 3. What to steal, in order

1. **Feature cards with no card.** Padding and a radius, no fill, no border.
   Instantly less generic than bordered boxes.
2. **Two buttons on every price.** Buy, and talk to someone.
3. **A constraint in the hero headline.** Theirs is 48-72hrs; ours is a
   single call with no time limit.
4. **Objections before price, not after.** Their Features at slot 5; our
   "What this is not" at slot 9.
5. **The LobbyOS slot.** We have three consoles and mention none.
6. **Three steps, not six.**
7. **A sub line under the closing CTA.**
8. **Recruit in the footer, not as a band.**

## 4. What not to take

- **Every number in § 8.** No invented counts, no satisfaction rate, no
  testimonials until somebody real says something real.
- **The lavender.** Their accent is `#AE94FF`; ours is blue and carries the
  wordmark. That is a brand decision, not a design-match one.
- **"Auto-renews every 60 days."** Ours are bought outright, deliberately,
  to stay clear of the RBI e-mandate framework.

## 5. Open questions

1. Does the sample record move to slot 3, where they put proof?
2. Is there a true "Built by Editors" line for Landline — a founder
   credential that does a testimonial's work?
3. Six steps or three?
4. Does the price ladder get a compare table, given four quarterlies cost
   less than one annual?
