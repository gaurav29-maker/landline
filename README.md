# Landline

An expert-call marketplace for Indian retail traders. Customers book a
45-minute portfolio audit or F&O session, pay through Razorpay, and fill a
short intake form before the call. Every expert's SEBI registration is shown
on their profile, or its absence is stated plainly.

Next.js (App Router) · Postgres · Drizzle · Razorpay · Resend · Vercel.

The design and the reasoning behind it are in
[`docs/plans/2026-09-08-backend-design.md`](docs/plans/2026-09-08-backend-design.md).
Read that before changing how booking or payment works.

## Where this is

**Phase 1 — demo.** Everything works end to end except payment, which has
never been exercised against Razorpay: no keys are configured. No real money,
no real experts.

Expert accounts and self-serve availability, once planned for phase 3, are
built — see *The expert console* below. What is left before this is usable by
anyone is a production `DATABASE_URL`, a Resend key (without which nobody can
sign in anywhere, since sign-in is a link by email), and Razorpay test keys.

## Running it

You need a Postgres database and a Razorpay test account. Both are free.

From a fresh clone, in order. Every step below was run against an empty
database before it was written down.

```bash
npm install
cp .env.example .env.local     # then fill it in — see below
```

`TOKEN_SECRET` has to be set before anything will sign in. Generate one:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Then, in its own terminal, leave the database running:

```bash
npm run db:local
```

And in another, build the schema and fill it:

```bash
npm run db:push                          # every table
npx tsx scripts/add-ops-identity.ts      # NOT optional — see below
npm run db:seed                          # three demo experts, weekdays 10-1 and 3-7 IST
npx tsx scripts/add-operator.ts "Your Name" you@landline.in
npm run dev
```

### Why two of those steps are not optional

**`add-ops-identity.ts` after `db:push`.** Push creates all the tables,
including `ops_events`, and cannot create the trigger that makes it
append-only — Drizzle's schema has no way to express one. So a database built
with push alone has an audit trail that anybody can edit or delete, which is
the one property it exists to have. The script is idempotent; run it after
every push. Verified: straight after `db:push` the trigger is absent, and
after the script it is there.

**`add-operator.ts`.** The ops console has no signup page and no password in
the environment, so with no operator rows it refuses everyone — the same
locked door a missing password used to give. The script prints a generated
password once and stores only a scrypt hash, so it cannot be read back; rerun
with `--reset` if it is lost, and `--disable you@landline.in` to switch an
account off.

### Migrating a database that already has data

`db:push` diffs the schema and can refuse a change it cannot work out — on
PGlite it tries to recreate a primary key and Postgres answers *column "id"
is in a primary key*. The three scripts below write those changes out
explicitly. All are idempotent and safe on a database that already has them.

```bash
npx tsx scripts/add-signin-codes.ts      # phone sign-in codes, phone uniqueness
npx tsx scripts/add-member-sessions.ts   # revocable member sessions, payer columns
npx tsx scripts/add-expert-sessions.ts   # revocable expert sessions
```

On a fresh database `db:push` covers all three; they exist for the one that
is already live.

### About `db:local`

It needs no account and nothing installed: Postgres compiled to WebAssembly
behind the ordinary wire protocol, so Drizzle and postgres.js cannot tell the
difference. Data lives in the OS temp directory, deliberately **outside** this
repo — set `LOCAL_DB_DIR` to move it. Being outside the working tree is why
moving the project does not disturb the database, and why a stray `rm -rf` in
the repo cannot take it with them.

Equally: a temp directory is not a promise. There is no backup and no
durability guarantee, and clearing temp files starts you at `db:push` again.
Development only; production still needs a real Postgres.

One known defect, measured rather than suspected: the socket server loses the
statement issued immediately after an error on the same connection. Provoke a
constraint violation, catch it, and the next query can come back empty. It has
produced two wrong conclusions in this codebase already, so a check that
deliberately triggers an error should verify the outcome rather than the
exception, and read back with a retry.

### Filling in `.env.local`

| Variable | Where it comes from |
|---|---|
| `DATABASE_URL` | Neon or Supabase. Use the **pooled** connection string. |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | Razorpay dashboard → Settings → API Keys. Must start `rzp_test_`. |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID` | Same value as `RAZORPAY_KEY_ID`. |
| `RAZORPAY_WEBHOOK_SECRET` | Razorpay dashboard → Settings → Webhooks. **Not** the key secret. |
| `RESEND_API_KEY` | Resend dashboard. Point `EMAIL_FROM` at your own inbox in phase 1. |
| `TOKEN_SECRET` | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `SMS_PROVIDER` / `SMS_API_KEY` / `SMS_SENDER_ID` / `SMS_TEMPLATE_SIGNIN` | Your SMS provider, **after** DLT registration (see below). Leave unset in development: the code is printed to the server console. |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY` | Cloudflare dashboard → Turnstile → Add site. Optional; set both or neither. |
| `CRON_SECRET` | Any long random string. Guards the Cron endpoints. |
| _(no variable)_ | The ops console uses operator accounts, not a password in the environment. See **Who did it** below. |
| `EXPERT_PAYOUT_PAISE` | What an expert is paid per session. Only used to estimate margin in `/ops/members`; defaults to ₹2,200, which is a **placeholder**. |

### Phone sign-in, and the paperwork in front of it

Members sign in with their mobile number and a six-digit code. The whole
flow works locally with nothing configured — with no `SMS_PROVIDER` set, a
development server prints the code to its own console and sign-in completes
end to end. Production with no provider throws rather than silently
dropping the message.

Delivering to a real Indian handset is gated on **DLT registration**, which
TRAI's TCCCPR requires of every commercial sender. Three registrations, in
order, through a telecom DLT platform:

1. **Entity** — PAN, GST and business proof. Needs the company to exist, so
   this is blocked behind the same thing as live Razorpay keys.
2. **Header** — a six-character sender ID (e.g. `LNDLNE`). A sign-in code
   must go out on a *transactional* header, approved separately from a
   promotional one.
3. **Template** — the exact message body with `{#var#}` placeholders,
   approved one template at a time and issued a template id. What is sent
   must match what was approved; an edited word is a rejected message.

Operators drop unregistered traffic and there is no test mode that reaches a
real phone, so the registrations cannot be hurried. **The code is not what is
waiting** — the provider call is written against MSG91's Flow API, and four
environment variables turn it on.

Two things it handles that are easy to get wrong, both covered by the suite
against a local mock server rather than by sending anything:

- MSG91 answers **HTTP 200 with `{"type":"error"}`** when a send fails — a
  wrong template id, an unregistered header, a number on DND. A `res.ok`
  check calls every one of those a successful send, and the member sits
  waiting for a message the logs swear went out. The body decides, not the
  status.
- Their own docs disagree about the template field: the apidoc page says
  `flow_id`, their current documentation and client library say
  `template_id`. Both go out carrying the same value, because guessing wrong
  means a 200 and no message.

The number is sent as `919876543210` — country code, no plus. The template
must define `VAR1` (the code) and `VAR2` (minutes), and its registered text
must match `signInSms()` in `lib/sms.ts` word for word.

Until all three registrations are done, leave `SMS_PROVIDER` unset: a
development server prints the code to its own console and sign-in works end
to end. Production with no provider throws rather than leaving somebody
waiting for a message nobody sent.

Members who predate phone sign-in, or who have no number on file, still
sign in by emailed link at `/member/login?email=1`.

### Testing payment locally

Razorpay cannot reach `localhost`, so the webhook — which is the only thing
that confirms a booking — will not fire. Tunnel it:

```bash
npx untun@latest tunnel http://localhost:3000
```

Then add `<tunnel-url>/api/webhooks/razorpay` as a webhook in the Razorpay
dashboard, subscribed to `payment.captured`. Test card `4111 1111 1111 1111`,
any future expiry, any CVV.

## How it fits together

```
app/
  page.tsx                       landing page, experts from the database
  experts/[slug]/                expert profile, with live availability
  apply/                         public application form
  expert/                        the expert console — schedule, hours, profile
  sitemap.ts robots.ts           only live experts are listed
  opengraph-image.tsx            generated share cards, one per expert too
  booking/[id]/page.tsx          post-payment status, polls until confirmed
  booking/[id]/intake/page.tsx   intake form, reached by signed link
  api/
    experts/[slug]/slots         computed availability
    bookings/hold                reserves a slot for 10 minutes
    payments/order               creates the Razorpay order
    webhooks/razorpay            THE ONLY PLACE A BOOKING IS CONFIRMED
    bundles/hold                 buys three calls, holds the first slot
    bookings/redeem              spends a bundle credit, no payment
    memberships/purchase         buys a pass; tier name only, price server-side
    memberships/book             books inside a pass, no payment
    member/session               trades a sign-in link for a session cookie
    cron/expire-holds            daily housekeeping; expiry itself is lazy
    cron/reminders               hourly via GitHub Actions, not Vercel
    cron/purge-intake            daily — deletes intake 90 days after the call
  member/                        the member console, magic-link guarded
  ops/                           the operations console, password-guarded
    members                      usage and margin per pass
lib/
  db/schema.ts                   thirteen tables
  slots.ts                       availability arithmetic, no stored slots
  razorpay.ts                    client and signature verification
  email.ts                       Resend, send-at-most-once
```

## Products and passes

| | Price | Entitlement | Account |
|---|---|---|---|
| Single call | ₹5,499 | one session | no, magic link |
| 3-call bundle | ₹9,999 | 3 credits, 60 days, one expert | no, magic link |
| Quarterly pass | ₹45,000 | unlimited, 90 days, any expert | **yes** |
| Annual pass | ₹2,45,000 | unlimited, 365 days, any expert | **yes** |

**Credits and periods are different shapes and live in different tables.**
`bundles` is a pot that depletes. `memberships` is a window of time with no
counter at all — booking under a pass asks only whether an active membership
covers the date.

Two things about this pricing are knowingly shipped as they stand, both
recorded in `docs/plans/2026-09-08-membership-and-pricing-design.md`: four
quarterly passes cost less than one annual for identical coverage, and the
bundle sells calls at a 39% discount, which is the widest gap in the ladder.

**Passes sidestep RBI e-mandate entirely.** A pass bought once upfront is a
payment, not a mandate — no additional-factor auth at registration, no
pre-debit notice, no auto-debit ceiling. The cost is that renewal is an email
rather than a silent charge.

## The member console

`/member` is what a pass buys. Single-call and bundle customers never see it;
it exists because a membership is a balance held over time, which a one-off
transaction has no use for.

Sign-in is a link by email, no password — customers should not have
credentials to lose. Tokens are scoped: a 30-minute `link` token and a 30-day
`session` token are signed over different payloads with the same secret, so a
session cookie cannot be replayed as a sign-in link. `/api/member/session`
performs the exchange, because Next only permits `cookies().set()` in a route
handler or server action, never during a page render.

## The ops console

`/ops` is the tool for running phase 2 by hand: every booking with its intake
form and payments, mark-complete, cancel and refund, and pausing or repricing
an expert.

### A phone is an account, not a person

Signing in proves possession of a number. So does taking one over, which is
neither difficult nor rare, and portfolio data is worth the trouble. Three
things narrow that, none of which involve collecting identity documents —
under the **DPDP Act 2023**, papers you do not need are a liability you chose
to carry.

**Sessions are rows, so they can be ended.** The cookie used to carry the
customer id and nothing else: complete on its own, valid for thirty days, and
impossible to revoke because there was nothing to revoke. It names a session
now, and `member_sessions` says whose it is, what device it was opened from
and whether it is still allowed. `/member/profile` lists them — "Chrome on
Windows, two minutes ago" — and ends any of them. A member is the only person
who can look at that list and know whether it was them.

**The screens worth stealing ask again.** A session carries two clocks: it
expires in thirty days, and `verifiedAt` moves only when somebody types a
code. Reading your bookings needs the first; downloading a session record —
your holdings, and an expert's written opinion of them — needs the second,
within 15 minutes. Changing the phone number needs it too, because that is
the credential itself.

**Changing the number proves the new number.** It used to be a field on the
profile form: type anything, press Save. Anyone holding a session could point
the account at their own number and keep it, and the owner could not undo it,
because the way back in was the number just taken away. It now takes a fresh
session *and* a code sent to the new number, and signs out every other device
when it lands.

**And the one identity signal that was already there.** A captured payment
means a bank or a UPI app authenticated somebody against an instrument in
their name — a far stronger claim than a SIM, made by an institution that
does it for a living. It always arrived in `payments.raw` and sat in a blob
nobody queried, which is the same as not having it. The method, the last four
digits or UPI handle, and the verified contact are columns now, shown on the
ops booking page where a dispute is actually handled. A payer contact that
differs from the account's number is **not** fraud — people pay for their
parents — it is just the first thing worth looking at.

The card number, the CVV and the bank credentials are deliberately not taken.
Razorpay holds those and is certified to.

### Who did it

The console used to take one shared password. That answered the question
"is somebody allowed in" and threw away the more important one: a shared
secret proves that *somebody* knew it, so every refund, every adviser
approval and every payout marked paid was attributable to nobody — including
on the days there genuinely was only one operator, because "it must have been
me" is not a record.

Operators are rows now. Add one:

```bash
npx tsx scripts/add-operator.ts "Full Name" you@landline.in
```

It prints a generated password once and stores only a scrypt hash, so it
cannot be read back — rerun with `--reset` if it is lost, and `--disable
you@landline.in` to switch an account off. There is no signup page and there
should not be one: the list of people who can move money changes when
somebody with database access decides it does. With no operator rows the
console refuses everyone, which is the same locked door the missing password
used to give.

A signed, httpOnly cookie holds the session for seven days and carries the
operator's id. `middleware.ts` verifies the signature at the edge; each
server action re-checks — a server action is a POST endpoint in its own
right — and also confirms the operator is still active, because a cookie
lasts a week and without that lookup disabling somebody would not disable
them until it expired.

Every change made from the console is written to `ops_events` **inside the
same transaction as the change**, so a refund that succeeds while its record
fails is not discouraged, it is impossible. `/ops/activity` reads it back as
sentences: who, what, from where, when.

That table is append-only, enforced by a trigger that raises on `UPDATE` and
`DELETE` — including for us. A `REVOKE` would not have done it, since the
app connects as the table's owner and an owner can grant itself back what it
revoked. A history we can tidy up answers "who did it" with "whoever tidied
it last".

Applications from `/apply` are reviewed here too. Approving creates the
expert as **draft**, never live: publishing someone the moment they are
approved would put a profile on the site with no availability behind it.

## The expert console

`/expert` is the tool for the person delivering the product. Same magic-link
sign-in as members, on its own cookie and its own scope — an expert sees other
people's portfolios, a member sees only their own, and a token minted for one
cannot be presented as the other.

- **Schedule.** Sessions that have already happened come first, under *Needs
  closing*, because they are the only thing on the page that needs a decision.
  Each session shows the customer's intake, takes a per-session join link, and
  closes as completed or no-show.
- **Availability.** The weekly windows, editable. A window shorter than one
  session is refused, because it can never produce a bookable slot and would
  silently do nothing.
- **Profile.** Headline, description and rate, self-service — `/apply`
  promises "you set your own rate and hours", and a promise the software does
  not keep is worse than one never made. Changing a rate never re-prices an
  existing booking: a booking captures `amount_paise` when the slot is held.

Two things an expert deliberately cannot change. **SEBI registration is
read-only** — the entire value of that line on a public profile is that a
person checked it against the register before the expert went live, and an
editable field would verify nothing. **Going live is not self-service** either:
an expert can pause and unpause themselves, but draft to live stays with
whoever did the verifying.

## Becoming an expert

`/apply` is a public form; `/ops/applications` is the queue. Applicants are
kept out of `experts` until a person approves them — an applicant has no
price, no hours and no account, and a row in `experts` is something the
booking code is entitled to treat as somebody we have checked.

A claimed SEBI registration must carry a number, or the profile would publish
a bare "RIA" with nothing to check it against. One open application per
address, enforced by a partial unique index on `lower(email)` where the status
is still `new`, so the form cannot be sent nine times while it sits in the
queue but somebody rejected in March can apply again in October.

The form is throttled at five per source per hour, keyed on a **salted hash**
of the address rather than the address. Throttling only ever asks "same source
again?", which does not require knowing who they are.

## Checking it still works

```bash
npm run db:local     # in one terminal
npm run dev          # in another
npm run verify
```

117 checks against a real database and a running server. They cover the parts
that need neither Razorpay nor Resend, and several of them exist because the
thing they check is a claim rather than an observation:

- two simultaneous holds on one slot — exactly one wins, defended by the
  partial unique index rather than by application code
- a correctly signed payment webhook paying the wrong amount confirms nothing
- an expert's sign-in link cannot open a member session, and the reverse
- one booking's intake link cannot fill in another's
- a draft expert is absent from the site and their profile returns 404
- a session note is purged with the intake it describes, and one inside the
  window is not
- no price or policy figure is retyped anywhere in the UI

That last one is a source check, not a flow. The booking dialog once carried
its own copy of the bundle price marked "display only"; the list moved and the
copy did not, so the dialog offered a ₹9,999 bundle at ₹3,600.

Four routes remain unexercised — `bundles/hold`, `payments/order`,
`memberships/purchase` and `cron/reminders` — and every one of them needs
Razorpay or Resend.

## The design

One system across the public pages and all three consoles, taken from
tesla.com and measured off the live site rather than recalled: two text
weights (400 and 500), letter-spacing left at normal, a 4px control radius, a
56px nav, one elevation, and text that never sits at pure black.

What could not be carried over is the layout. Four fifths of that site is
product photography and every panel is carried by a car; Landline sells
forty-five minutes of somebody's attention and has nothing to photograph. Each
band is carried instead by a piece of the product — the hero holds a real
availability read, computed through the same helper the booking dialog uses,
so the page cannot advertise a week the dialog then refuses.

The public pages wrap in `.site`. The member and expert consoles wrap in
`.site-dark os` and the ops console in `.ops`; all three share the same
neutral ramp and the same accent.

**On the accent.** White clears `#3E6AE1` at 4.82:1, which is why a filled
control carries a white label. The same blue as *text* reads 4.82:1 on white
but only 3.95:1 on the dark ground, so `--blue-deep` darkens in the light
theme and lightens in the dark one. Same token, opposite direction, because
the ground moved rather than the hue. Do not lift a colour system one value at
a time.

## Three things not to break

**The webhook is the source of truth.** Razorpay's client-side success handler
is a convenience — it can be lost, or forged. Nothing else may confirm a
booking.

**Prices are read server-side.** `/api/payments/order` takes a booking id and
nothing else. The moment a price crosses the wire from the browser, a ₹2,200
slot can be bought for ₹1.

**The partial unique index on `bookings` prevents double-booking.** Do not
replace it with a check in application code; that loses the race.

**Passes are unlimited with no throttle, by decision.** Nothing in the code
stops a member booking three calls a week. `/ops/members` is the instrument
that replaces the cap: it shows calls taken against fee paid, so a member who
costs more than they pay is visible before renewal rather than after. If that
page is ever removed, the cap has to come back.

## Before real money

- A lawyer on the SEBI position. Charging to review real holdings sits close
  to regulated investment advice. See the design doc.
- Live Razorpay keys need a registered entity with completed KYC.
- Real experts, real SEBI registration numbers, and pricing they have agreed to.
- The policy pages at `/legal/*` are drafts that no lawyer has read, and every
  bracketed item in them still needs a real answer. Razorpay asks for them
  during onboarding.

## Deploying

The Vercel MCP connector 404s on this account. Use the CLI:

```bash
npx vercel deploy --prod --yes
```

A new environment needs the same two steps a fresh clone does, run against
whatever database it points at — with `DATABASE_URL` set to the production
one, not the local:

```bash
npx tsx scripts/add-ops-identity.ts      # or the audit trail is editable
npx tsx scripts/add-operator.ts "Your Name" you@landline.in
```

Without the second one nobody can open `/ops` at all, which is the intended
locked door and an easy half-hour to lose if it is forgotten.

Cron schedules are in `vercel.json` and need a plan that allows them.
