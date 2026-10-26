import fs from "node:fs";
import path from "node:path";
import { Resend } from "resend";
import { db } from "@/lib/db";
import { notifications } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { istDateTime, rupees } from "@/lib/format";
import { calendarUrl, intakeUrl, siteUrl } from "@/lib/tokens";
import { BRAND_BLUE, BRAND_TAGLINE } from "@/lib/brand";
import { ASK_FOR_INTAKE } from "@/lib/constants";

type Kind = (typeof notifications.kind.enumValues)[number];

let cached: Resend | null = null;
function resend(key: string): Resend {
  if (!cached) cached = new Resend(key);
  return cached;
}

/** Where the message says it is from. Resend will only send as a domain you
    have verified with them; the default is their sandbox sender, which
    delivers only to the address that owns the Resend account. */
function sender(): string {
  return process.env.EMAIL_FROM ?? "Landline <onboarding@resend.dev>";
}


/**
 * Which of the three things happens to a message, as a pure decision.
 *
 * Separated out so the safety property can be asserted directly rather than
 * reasoned about: that a production server with no key REFUSES, instead of
 * printing a booking confirmation to a log nobody reads. Testing that by
 * setting NODE_ENV inside the suite would change it for every check that
 * follows; asking the function is free.
 */
export type EmailTransport = "resend" | "console" | "refuse";

export function transportFor(
  key: string | undefined,
  nodeEnv: string | undefined,
): EmailTransport {
  if (key && key.trim() !== "") return "resend";
  return nodeEnv === "production" ? "refuse" : "console";
}

/**
 * Hand one message to the provider, or to the console.
 *
 * THE SHAPE IS LIFTED FROM lib/sms DELIBERATELY. That module already decided
 * how this project behaves with no provider configured: a development server
 * prints the message and the flow completes end to end, production with
 * nothing configured throws rather than silently dropping it. Email had no
 * such path — every send threw the moment RESEND_API_KEY was missing, which
 * is the state this site has been in for its whole life.
 *
 * WHAT THAT COST, concretely, and why this is not a convenience. sendOnce
 * claims a notification row, sends, and DELETES the row when the send throws.
 * With no key every send throws, so no notification row ever survived, so
 * nothing about reminders, nudges or follow-ups could be exercised at all —
 * a test could only ever prove that no email went out, which it already knew.
 * One feature this session had to grow a pure function to be testable around
 * that. This removes the reason.
 *
 * GUARDED BY NODE_ENV, not by a flag. A flag can be left on, and an email
 * that quietly goes to a console in production is a booking confirmation
 * nobody receives.
 */
async function deliver(message: { to: string; subject: string; html: string }): Promise<void> {
  const key = process.env.RESEND_API_KEY?.trim();
  const transport = transportFor(key, process.env.NODE_ENV);

  if (transport === "refuse") {
    throw new Error(
      "RESEND_API_KEY is not set, so no email can be delivered — no booking " +
        "confirmation, no sign-in link, no receipt. Set it, or take the site down.",
    );
  }

  if (transport === "console") {

    /*
       Development only. The links are what is printed, because they are what
       a person needs to carry a flow forward on a laptop: the sign-in link,
       the intake form, the calendar file. The whole rendered message goes to
       a file so a template can be opened and looked at, under the OS temp
       directory rather than the repository — this project lives inside
       OneDrive, and a stream of files appearing in the working tree is the
       kind of thing that syncs badly and shows up in `git status`.
    */
    const links = [...new Set([...message.html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]))]
      .filter((u) => u.startsWith("http"))
      .slice(0, 4);

    /*
       The rendered message, but only when somebody asks for it.

       It used to write one file per send unconditionally, which meant the
       verification suite produced a few dozen of them and did a synchronous
       disk write inside every email path. Writing files as a side effect of
       sending is the wrong default: it is a thing you want when you are
       looking at a template and noise every other time. Set
       EMAIL_PREVIEW_DIR to a folder and they come back.
    */
    let saved = "";
    const previewDir = process.env.EMAIL_PREVIEW_DIR?.trim();
    if (previewDir) {
      try {
        fs.mkdirSync(previewDir, { recursive: true });
        const stem = message.subject.slice(0, 40).replace(/[^a-zA-Z0-9]+/g, "-");
        saved = path.join(previewDir, `${Date.now()}-${stem}.html`);
        fs.writeFileSync(saved, message.html, "utf8");
      } catch {
        /* Never let writing a convenience file break a send. */
        saved = "";
      }
    }

    const lines = [`[email] to ${message.to} — ${message.subject}`];
    for (const u of links) lines.push(`[email] ${u}`);
    if (saved) lines.push(`[email] ${saved}`);
    console.info(lines.join("\n"));
    return;
  }

  await resend(key as string).emails.send({
    from: sender(),
    replyTo: process.env.EMAIL_REPLY_TO,
    to: message.to,
    subject: message.subject,
    html: message.html,
  });
}

/**
 * Send an email at most once per (booking, kind), ever.
 *
 * The claim row goes in first. If two Cron runs overlap, the second one's
 * insert conflicts and it sends nothing. If the send itself fails, the claim
 * is released so a later run can retry.
 */
export async function sendOnce(
  bookingId: string,
  kind: Kind,
  message: { to: string; subject: string; html: string },
): Promise<"sent" | "already-sent" | "failed"> {
  const claimed = await db
    .insert(notifications)
    .values({ bookingId, kind })
    .onConflictDoNothing()
    .returning({ id: notifications.id });

  if (claimed.length === 0) return "already-sent";

  try {
    await deliver(message);
    return "sent";
  } catch (err) {
    await db
      .delete(notifications)
      .where(and(eq(notifications.bookingId, bookingId), eq(notifications.kind, kind)));
    console.error(`[email] ${kind} for ${bookingId} failed`, err);
    return "failed";
  }
}

/**
 * Sends without the once-only claim row.
 *
 * `notifications` is keyed to a booking, and a pass has none. Safe here
 * because the webhook already de-duplicates on Razorpay's event id, so a
 * redelivered capture never reaches this twice.
 */
export async function sendRaw(message: { to: string; subject: string; html: string }) {
  await deliver(message);
}

const DISCLAIMER = `
  <p style="color:#6B6B6B;font-size:12px;line-height:1.6;margin-top:28px;
            border-top:1px solid #E4E8EF;padding-top:16px">
    Landline sessions are a review and discussion of your existing portfolio and
    approach. They are not a recommendation to buy or sell any security, and are
    not personalised investment advice. You remain responsible for your own
    decisions. Never share your demat or broker login with anyone, including us.
  </p>`;

/*
 * Every email opened straight into "Hi {name}" with no mark on it at all —
 * a transactional mail that looks like it came from nowhere. This is the
 * lockup from the artwork, in system faces because no email client can be
 * relied on to fetch a webfont, and as text rather than an image because
 * most clients block remote images by default and a logo nobody can see is
 * worse than none.
 */
const MASTHEAD = `
  <div style="border-bottom:1px solid #E4E8EF;padding-bottom:15px;margin-bottom:24px">
    <div style="font-size:18px;font-weight:800;letter-spacing:-0.02em;color:#1A1A1A">land<span style="color:${BRAND_BLUE}">line</span></div>
    <div style="font-size:12px;color:#6B6B6B;margin-top:4px">${BRAND_TAGLINE}</div>
  </div>`;

function shell(body: string): string {
  return `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;
                      color:#1A1A1A;max-width:520px;line-height:1.65">
    ${MASTHEAD}
    ${body}
    ${DISCLAIMER}
  </div>`;
}

export function customerConfirmation(args: {
  customerName: string;
  expertName: string;
  startsAt: Date;
  amountPaise: number;
  bookingId: string;
  meetingUrl: string | null;
}) {
  return {
    subject: `Your Landline call with ${args.expertName} is confirmed`,
    html: shell(`
      <h2 style="font-size:20px;margin:0 0 16px">You're booked in.</h2>
      <p>Hi ${args.customerName}, your session with
         <strong>${args.expertName}</strong> is confirmed.</p>
      <p style="background:#E8F5FE;padding:14px 16px;border-radius:8px;margin:20px 0">
        <strong>${istDateTime(args.startsAt)} IST</strong><br>
        ${args.amountPaise > 0 ? `Paid ${rupees(args.amountPaise)}` : "Included in your plan"}
        ${args.meetingUrl ? `<br><a href="${args.meetingUrl}">Join link</a>` : ""}
      </p>
      ${
        /* Behind ASK_FOR_INTAKE, which is off: the expert has the right data,
           so asking the member to type their holdings ahead of the call is
           work for nothing. The template keeps both halves so flipping the
           constant restores the email exactly. */
        ASK_FOR_INTAKE
          ? `<p><strong>One thing before the call.</strong> Fill in the short intake form so your
                holdings are in front of your expert while you talk, instead of being described from
                memory:</p>
             <p><a href="${intakeUrl(args.bookingId)}"
                   style="display:inline-block;background:${BRAND_BLUE};color:#FFFFFF;padding:11px 20px;
                          border-radius:8px;text-decoration:none">Fill the intake form</a></p>
             <p style="font-size:13px;color:#6B6B6B">It asks for a summary of your holdings —
                never a login.</p>`
          : ""
      }
      <!--
        And the appointment itself. Underneath the intake because the intake
        is the thing we need from them and this is the thing they need from
        us — but on every confirmation, because a time written in an email is
        a time somebody has to copy across by hand, and the ones who forget
        are the ones who do not turn up.
      -->
      <p style="font-size:13px;color:#6B6B6B;margin-top:22px">
        <a href="${calendarUrl(args.bookingId)}" style="color:${BRAND_BLUE}">Add it to your
        calendar</a> — works with Google Calendar, Apple Calendar and Outlook.</p>`),
  };
}

export function expertNotification(args: {
  expertName: string;
  customerName: string;
  startsAt: Date;
  bookingId: string;
}) {
  return {
    subject: `New booking: ${args.customerName}, ${istDateTime(args.startsAt)}`,
    html: shell(`
      <h2 style="font-size:20px;margin:0 0 16px">New booking</h2>
      <p>Hi ${args.expertName}, <strong>${args.customerName}</strong> has booked a
         session.</p>
      <p style="background:#E8F5FE;padding:14px 16px;border-radius:8px;margin:20px 0">
        <strong>${istDateTime(args.startsAt)} IST</strong>
      </p>
      ${ASK_FOR_INTAKE ? "<p>Their intake form will follow once they've filled it in.</p>" : ""}`),
  };
}

/**
 * Your session has no joining link, and it is tomorrow.
 *
 * THE HOLE THIS SITS UNDER. A Meet link cannot be created from a URL, and
 * creating one on an expert's behalf needs Google OAuth, a Cloud project and
 * a consent screen that do not exist yet — see lib/meet. So the link is
 * pasted in by hand, which works right up until somebody forgets, and the
 * first anyone hears of it is a customer sitting in front of a booking with
 * nowhere to join.
 *
 * Two messages rather than one. A day out this is a reminder and reads like
 * one. Two hours out the same fact is a different message, and saying "just a
 * reminder" then would be underselling what is about to happen.
 */
export function expertLinkMissing(args: {
  expertName: string;
  customerName: string;
  startsAt: Date;
  urgent: boolean;
}) {
  const when = istDateTime(args.startsAt);
  return {
    subject: args.urgent
      ? `No joining link yet — ${args.customerName} in under two hours`
      : `Add a joining link for ${args.customerName} tomorrow`,
    html: shell(`
      <h2 style="font-size:20px;margin:0 0 16px">${
        args.urgent ? "Your session has no link" : "One thing to add"
      }</h2>
      <p>Hi ${args.expertName}, your session with <strong>${args.customerName}</strong> is at
         <strong>${when} IST</strong> and there is still no joining link on it.</p>
      <p style="background:#E8F5FE;padding:14px 16px;border-radius:8px;margin:20px 0">
        ${
          args.urgent
            ? "They will open their console at the hour and find nothing to click."
            : "They can already see the session in their console; the link is the part that is missing."
        }
      </p>
      <p>Open your console, use <strong>Add to Google Calendar</strong> on the booking to
         create a Meet room, then paste the link into the field beside it.</p>
      <p><a href="${siteUrl()}/expert"
            style="display:inline-block;background:${BRAND_BLUE};color:#FFFFFF;padding:11px 20px;
                   border-radius:8px;text-decoration:none">Add the link</a></p>`),
  };
}

export function intakeNudge(args: { customerName: string; startsAt: Date; bookingId: string }) {
  return {
    subject: "Two minutes before your Landline call tomorrow",
    html: shell(`
      <p>Hi ${args.customerName}, your call is at
         <strong>${istDateTime(args.startsAt)} IST</strong> and the intake form is
         still empty.</p>
      <p>Filling it in is what makes the session useful — otherwise the first fifteen
         minutes go on describing your portfolio out loud.</p>
      <p><a href="${intakeUrl(args.bookingId)}"
            style="display:inline-block;background:${BRAND_BLUE};color:#FFFFFF;padding:11px 20px;
                   border-radius:8px;text-decoration:none">Fill it in now</a></p>`),
  };
}

export function reminder(args: {
  customerName: string;
  expertName: string;
  startsAt: Date;
  meetingUrl: string | null;
  soon: boolean;
  bookingId: string;
}) {
  return {
    subject: args.soon
      ? `Your call with ${args.expertName} starts in an hour`
      : `Your call with ${args.expertName} is tomorrow`,
    html: shell(`
      <p>Hi ${args.customerName}, a reminder that your session with
         <strong>${args.expertName}</strong> is at
         <strong>${istDateTime(args.startsAt)} IST</strong>.</p>
      ${
        args.meetingUrl
          ? `<p><a href="${args.meetingUrl}"
                  style="display:inline-block;background:${BRAND_BLUE};color:#FFFFFF;padding:11px 20px;
                         border-radius:8px;text-decoration:none">Join the call</a></p>`
          : "<p>Your expert will send the join link shortly.</p>"
      }
      ${
        /*
           Only on the day-before reminder. An hour out, somebody is about to
           be on the call — offering to put it in their calendar then is
           noise in the one message that should be a single button.
        */
        args.soon
          ? ""
          : `<p style="font-size:13px;color:#6B6B6B;margin-top:22px">
               Not in your calendar yet?
               <a href="${calendarUrl(args.bookingId)}" style="color:${BRAND_BLUE}">Add it</a>.</p>`
      }`),
  };
}

export function bundleSlotLost(args: {
  customerName: string;
  expertName: string;
  startsAt: Date;
  creditsLeft: number;
}) {
  return {
    subject: "That slot went — your three calls are safe",
    html: shell(`
      <p>Hi ${args.customerName}, your payment for the
         ${istDateTime(args.startsAt)} IST slot arrived just after someone else
         had taken it.</p>
      <p><strong>Nothing has been lost.</strong> Your bundle is active with all
         ${args.creditsLeft} calls unspent — no money has been refunded because
         none of it has been used.</p>
      <p>Just pick another time with ${args.expertName} whenever suits you.</p>`),
  };
}

export function memberSignInLink(args: { customerName: string; url: string }) {
  return {
    subject: "Your Landline sign-in link",
    html: shell(`
      <p>Hi ${args.customerName}, here is your link into the Landline console.
         It works once and expires in 30 minutes.</p>
      <p><a href="${args.url}"
            style="display:inline-block;background:${BRAND_BLUE};color:#FFFFFF;padding:11px 20px;
                   border-radius:8px;text-decoration:none">Open my console</a></p>
      <p style="font-size:13px;color:#6B6B6B">If you did not ask for this, ignore it —
         nobody can get in without the link.</p>`),
  };
}

export function emailChangeConfirm(args: { customerName: string; url: string }) {
  return {
    subject: "Confirm your new Landline email",
    html: shell(`
      <p>Hi ${args.customerName}, someone asked to use this address for a Landline
         account. Confirm it and it becomes the address you sign in with.</p>
      <p><a href="${args.url}"
            style="display:inline-block;background:${BRAND_BLUE};color:#FFFFFF;padding:11px 20px;
                   border-radius:8px;text-decoration:none">Confirm this address</a></p>
      <p style="font-size:13px;color:#6B6B6B">The link expires in 30 minutes. If this
         was not you, ignore it — nothing changes unless the link is followed.</p>`),
  };
}

export function expertSignInLink(args: { expertName: string; url: string }) {
  return {
    subject: "Your Landline sign-in link",
    html: shell(`
      <p>Hi ${args.expertName}, here is your link into your Landline schedule.
         It works once and expires in 30 minutes.</p>
      <p><a href="${args.url}"
            style="display:inline-block;background:${BRAND_BLUE};color:#FFFFFF;padding:11px 20px;
                   border-radius:8px;text-decoration:none">Open my schedule</a></p>
      <p style="font-size:13px;color:#6B6B6B">If you did not ask for this, ignore it.</p>`),
  };
}

export function membershipWelcome(args: {
  customerName: string;
  tierLabel: string;
  endsAt: Date;
  consoleUrl: string;
}) {
  return {
    subject: `Your ${args.tierLabel} is active`,
    html: shell(`
      <h2 style="font-size:20px;margin:0 0 16px">You're in.</h2>
      <p>Hi ${args.customerName}, your <strong>${args.tierLabel}</strong> is active
         until <strong>${istDateTime(args.endsAt)} IST</strong>.</p>
      <p>Sessions are unlimited for that whole period, with any expert on the
         platform. Book them from your console:</p>
      <p><a href="${args.consoleUrl}"
            style="display:inline-block;background:${BRAND_BLUE};color:#FFFFFF;padding:11px 20px;
                   border-radius:8px;text-decoration:none">Open your console</a></p>
      <p style="font-size:13px;color:#6B6B6B">The link signs you in — no password.
         It is tied to this email address, so keep it to yourself.</p>`),
  };
}

export function refundApology(args: {
  customerName: string;
  startsAt: Date;
  amountPaise: number;
}) {
  return {
    subject: "That slot went — your money is on its way back",
    html: shell(`
      <p>Hi ${args.customerName}, your payment for the
         ${istDateTime(args.startsAt)} IST slot arrived just after someone else
         had taken it.</p>
      <p>We haven't kept the money. <strong>${rupees(args.amountPaise)}</strong> has been
         refunded and will reach your account in 5-7 working days.</p>
      <p>Sorry — genuinely. Please do pick another slot.</p>`),
  };
}
