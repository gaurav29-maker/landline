import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy — Landline",
  description: "What Landline collects, who sees it, and when it is deleted.",
};

const TODO = ({ children }: { children: React.ReactNode }) => (
  <span className="todo">{children}</span>
);

export default function Privacy() {
  return (
    <>
      <h1>Privacy Policy</h1>
      <p className="updated">Draft of 8 September 2026</p>

      <div className="draft">
        <b>This draft has not been reviewed by a lawyer.</b>
        It is an accurate description of what the software actually collects and deletes, written
        against the Digital Personal Data Protection Act, 2023. It still needs review, and every
        bracketed item needs a real answer, before Landline accepts real money.
      </div>

      <h2>The short version</h2>
      <p>
        We collect your name, email and an optional phone number. We do not ask you to write down
        what you hold any more &mdash; you show your expert on the call instead &mdash; so the only
        account of your portfolio we keep is what your expert writes up afterwards, and that is
        deleted 90 days later. We never see your card details, and we never ask for a broker login.
      </p>

      <h2>1. Who is responsible</h2>
      <p>
        The Data Fiduciary is <TODO>[registered entity name and address]</TODO>. For anything in
        this policy, contact <TODO>[Data Protection Officer or grievance contact]</TODO>.
      </p>

      <h2>2. What we collect, and why</h2>
      <ul>
        <li>
          <strong>Name and email</strong> — to confirm your booking, send reminders, and give the
          expert someone to expect. Required.
        </li>
        <li>
          <strong>Phone number</strong> — optional, used only if we need to reach you about a
          session.
        </li>
        {/*
          Kept rather than removed, and reworded. We no longer ASK for this —
          the intake form is switched off — but the form still answers at a
          link already sent, and every submission made before the change is
          still held until its retention clock runs out. A policy that stopped
          listing data the business still holds would be the wrong kind of
          tidy.
        */}
        <li>
          <strong>Your portfolio summary, goals, risk comfort and questions</strong> — only if you
          filled in an intake form. We no longer ask for one: you show your expert what you hold
          on the call instead. Anything sent before that change is still held, and still deleted
          on the clock below.
        </li>
        <li>
          <strong>Payment records</strong> — the amount, the time and Razorpay&rsquo;s reference for it.
          Card, UPI and bank details are handled by Razorpay and never reach us.
        </li>
        <li>
          <strong>Your consent record</strong> — the time you accepted the disclaimer, and the IP
          address it came from, because we may need to show it was given.
        </li>
      </ul>

      <h2>3. What we never collect</h2>
      <p>
        <strong>Demat, broker or trading account credentials.</strong> There is no field for one
        anywhere in the product or in our database. Nobody at Landline will ever ask you for one.
      </p>

      <h2>4. Who sees your data</h2>
      <ul>
        <li>
          <strong>The expert you booked</strong> — your name, and an intake form if you filled one
          in before we stopped asking. No other expert sees it.
        </li>
        <li>
          <strong>Razorpay</strong>, to take the payment.{" "}
          <TODO>[link Razorpay&rsquo;s privacy policy]</TODO>
        </li>
        <li>
          <strong>Resend</strong>, to deliver email. <TODO>[link Resend&rsquo;s privacy policy]</TODO>
        </li>
        <li>
          <strong>Vercel and <TODO>[database provider]</TODO></strong>, who host the site and store
          the data.
        </li>
      </ul>
      <p>We do not sell your data, and we do not share it for anyone else&rsquo;s advertising.</p>

      <h2>5. How long we keep it</h2>
      <ul>
        <li>
          <strong>Intake forms are deleted 90 days after the call.</strong> This is automatic, not a
          promise we have to remember to keep — a scheduled job erases the content and leaves only
          the fact that a session happened.
        </li>
        <li>
          <strong>Booking and payment records</strong> are kept for{" "}
          <TODO>[N years, per tax and accounting requirements]</TODO>.
        </li>
        <li>
          <strong>Consent records</strong> are kept as long as the booking record they belong to.
        </li>
      </ul>

      <h2>6. Your rights</h2>
      <p>Under the DPDP Act you can ask us to:</p>
      <ul>
        <li>
          tell you what we hold about you and who we have shared it with — you do not have to
          ask us for this one. Sign in and open{" "}
          <Link href="/member/profile">Your details</Link>; the whole file downloads from
          there, including who each piece has been shared with.
        </li>
        <li>
          correct anything inaccurate or incomplete — your name, number and email are editable
          in the same place.
        </li>
        <li>
          erase your data where we no longer need it — you do not have to ask us for this
          one either. Sign in, open <Link href="/member/profile">Your details</Link> and
          delete your account. It erases your name, your number, your email, everything you
          told us about what you own and everything your expert wrote back, and it signs you
          out everywhere. Payment and booking records stay on our books for as long as tax
          and company law requires, with your name and contact details removed from them; the
          page says which ones and until when before you confirm anything. We will refuse
          while a session you have booked has not happened yet, because an expert is expecting
          you — cancel it first and the deletion goes through.
        </li>
        <li>nominate someone to exercise these rights if you cannot.</li>
      </ul>
      {/*
        Three of the four rights are self-serve now and say so. Only the
        nomination still routes through a person, and that contact is still a
        blank — which is the point of leaving the placeholder visible rather
        than writing something reassuring and untrue.
      */}
      <p>
        To nominate someone, write to <TODO>[grievance contact]</TODO>. We aim to respond
        within <TODO>[N]</TODO> days. If we cannot resolve it, you may complain to the Data
        Protection Board of India.
      </p>

      <h2>7. Withdrawing consent</h2>
      <p>
        You can withdraw consent at any time. In practice the way to do it is to{" "}
        <Link href="/member/delete">delete your account</Link>, which erases what we are not
        legally required to keep and signs you out everywhere. Withdrawing consent does not
        undo anything done while it was given, and we cannot deliver a session you have
        already booked to an account that no longer exists — which is why deletion asks you
        to cancel an upcoming session first.
      </p>

      <h2>8. Cookies and tracking</h2>
      <p>
        Landline currently runs <strong>no analytics and no advertising trackers</strong>. The site
        stores nothing in your browser beyond what a page needs to work. If that changes, this
        section changes with it, and we will ask for consent where consent is required.
      </p>

      <h2>9. Security</h2>
      <p>
        Data is encrypted in transit. Access to the database is restricted to{" "}
        <TODO>[who]</TODO>. Intake links are signed so they cannot be guessed. No system is
        perfectly secure, and if a breach affects you we will tell you and the Data Protection
        Board as the Act requires.
      </p>

      <h2>10. Children</h2>
      <p>Landline is not for anyone under 18, and we do not knowingly collect their data.</p>

      <h2>11. Changes</h2>
      <p>
        If we change this policy we will post the new version here and, for anything significant,
        email you.
      </p>
    </>
  );
}
