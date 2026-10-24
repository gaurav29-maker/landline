# Landline — what is left

Every line here was checked against the code on 24 October 2026, not
remembered. Counts and file paths are real; if one looks wrong, grep it.

Three groups, and the order matters: the first group is the only one that
can stop a launch, and almost none of it is code.

---

## 1. Blocked on you — nothing ships without these

| | What | Where | Why it blocks |
|---|---|---|---|
| 1.1 | **Razorpay keys** | `RAZORPAY_KEY_ID` unset | No money can be taken. 2 references in the code, both live. |
| 1.2 | **Email sending key** | `RESEND_API_KEY` unset | No booking confirmation, no sign-in link, no receipt. |
| 1.3 | **SMS provider + TRAI DLT** | `SMS_PROVIDER`, `SMS_API_KEY`, `SMS_SENDER_ID` unset | Phone sign-in is the front door and it cannot send a code. DLT registration is a regulator step with a lead time — start it before you need it. |
| 1.4 | **The 21 legal blanks** | 9 in `app/legal/privacy`, 7 in `app/legal/terms`, 5 in `app/legal/refunds` | Registered entity name, CIN, address, GSTIN, grievance officer, retention periods, the cancellation percentage. They render as visible `[bracketed]` placeholders today — a visitor can read them. |
| 1.5 | **Trade mark number** | `lib/brand.ts:66` | `TRADEMARK_REGISTERED` is already `true`, so ® is on every surface. Under s.107 of the Trade Marks Act 1999, claiming registration you do not hold is an offence. Write the number and class into that comment, or set the flag back to `false`. |

**1.4 and 1.5 are the two with legal exposure.** Everything else here just
means a thing does not work yet.

---

## 2. Decisions only you can make

| | What | The question |
|---|---|---|
| 2.1 | **The broker strip** | The home page says *"BUILT FOR INVESTORS USING ICICI DIRECT · GROWW · ANGEL ONE · UPSTOX"*. We have no relationship with any of them. The phrasing is defensible — *for investors who use them*, not *with them* — but it is the only claim on the page borrowing someone else's marks, in the most prominent slot after the hero. Keep, reword to disclaim affiliation, or drop the names. |
| 2.2 | **`.agents/vercel-optimize/`** | 156 files, 1.2 MB, **89 runnable `.mjs` scanners**, now committed. It arrived as a side effect of vendoring an 8 KB markdown skill. Keep it vendored, or gitignore it and let `skills-lock.json` restore it. |
| 2.3 | **"Personalised investment plan"** | Copy that was never resolved. On a SEBI-sensitive product, *plan* is a loaded word. Needs your legal steer before it goes anywhere near the site. |
| 2.4 | **The Higgsfield film** | Account has **0 credits, free plan, no unlim allowance**. A 5-second 1080p silent 16:9 clip preflights at **80 credits**. The slot is wired and off (`FILM = null` in `components/AuditExample.tsx`); flipping one constant turns it on. |

---

## 3. ~~Ready to build~~ — all four done, 25 October 2026

Ordered by how much each one changes for a real visitor.

### ~~3.1 Move The Log up the console~~ — done
`app/member/page.tsx`. Current order: Coming up → Your first session →
Book a session → bundles → renewal → **The Log** → Past sessions. It is
the most distinctive thing in the product — nobody else shows a retail
trader their own holdings first-session against latest — and it sits
below the fold on every laptop.

### ~~3.2 A pre-call block in the console~~ — done
The new first-session block says what *happens*. Nothing says what to
have open when you sit down. Reaches every member, every time, and the
marketing site does this work right up until they become a customer.

### ~~3.3 The three home-page sections never built~~ — done
From the audit of what the page is missing, in the order I would do them:

1. **How an expert gets listed.** The biggest unanswered question on a
   marketplace with one expert is *who let this person on here*. Every
   clause is already enforced in code — a person checks the background
   before approval, it is locked afterwards, the SEBI row renders "Not
   registered" rather than vanishing, the payout is a share of the
   session so nobody earns from what you hold. It would also give
   `/principles` something to link from.
2. **"Not for you if…"** — "Terms of the thing" says what the *product*
   is not; nothing says who the *customer* is not. Turning people away is
   the strongest trust signal a SEBI-sensitive site has.
3. **A downloadable sample record.** The reel shows 8 lines of
   `landline-2026-09-16-gaurav-khona.txt`. Let them keep the whole file —
   one route, one link, and it is the only artefact a visitor can hold
   before paying.

### ~~3.4 One blue, read from one place~~ — done
`lib/email.ts` ×8 and `components/BookingDialog.tsx` ×1 now read
`BRAND_BLUE`.

**`app/global-error.tsx` keeps its two literals, deliberately.** That
file documents why at the top: it replaces the root layout, so
`globals.css` is not loaded when it renders, and it is the one file that
must not import the design system — because the reason it is showing may
be that the design system failed to load. Listing it here was my error.
A comment now sits next to the hex so nobody else tries.

---

## 4. Waiting on an asset

These are real work, already designed, that cannot start without a file.

| | What | Needs |
|---|---|---|
| 4.1 | **`/experts` photo grid** | Expert photographs. There is no photo field on the schema yet either. |
| 4.2 | **The real logotype** | `public/brand/landline.svg`, text converted to outlines. The folder holds a README explaining exactly how, and nothing else — the wordmark is set in type everywhere today. One line in `lib/brand.ts` swaps it in across nav, footer, three consoles and both share cards. |
| 4.3 | **The first testimonial** | `lib/testimonials.ts` is an empty array on purpose, and the file explains why at length. The block is built and renders nothing until one real person says one real thing and agrees to be quoted. |

---

## Not on this list, deliberately

- **Fabricated anything.** No invented testimonials, no stock photo of a
  desk behind the sign-in panel, no "they read it before the call". Each
  of those was considered and refused for a reason written down where
  the decision lives.
- **Work the tests already cover.** 138 checks pass; if something here
  broke one of them it would not be a todo, it would be a bug.
