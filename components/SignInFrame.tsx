import Link from "next/link";
import Wordmark from "@/components/Wordmark";
import { BRAND_TAGLINE_PARTS } from "@/lib/brand";
import { CONTACT_EMAIL } from "@/lib/constants";

/**
 * The front door, as a split.
 *
 * editlobby.com's console login: a rounded panel on the left carrying the
 * mark at the top and the company's one promise at the bottom, and the
 * form on the right in a column of its own. Below their lg breakpoint the
 * panel goes and the mark moves above the form.
 *
 * ONE FRAME, TWO PAGES. /member/login and /member/verify are two steps of
 * the same arrival and used to be two copies of the same column. They
 * share this now, so the panel cannot drift between asking for a number
 * and asking for the code it sent.
 *
 * WHAT IS NOT COPIED IS THE FORM. Theirs is Email and Password. Landline
 * has no passwords — a phone and a texted code, or a link by email — and
 * a password field on a product without passwords is not a design
 * decision, it is a lie about how the thing works. The layout is theirs;
 * the fields stay what they actually are.
 */
export default function SignInFrame({ children }: { children: React.ReactNode }) {
  return (
    <main className="site signin">
      {/*
        The panel. No photograph behind it: the only brand artwork this
        repo has is a README saying where the logotype will go, and a
        stock image of a desk would be the kind of filler this site has
        spent its whole build refusing. The gradient is the one the audit
        card and the question rail already use.
      */}
      <aside className="signin-brand" aria-hidden="true">
        <Wordmark className="logo signin-brand-mark" as="p" sub="os" />
        <div>
          <p className="signin-brand-line">
            {BRAND_TAGLINE_PARTS[0]}
            <span className="said">{BRAND_TAGLINE_PARTS[1]}</span>
            {BRAND_TAGLINE_PARTS[2]}
          </p>
          {/*
            tabIndex -1 because the panel is aria-hidden: a link a screen
            reader cannot see but a keyboard can still land on is a hole
            in the tab order. The same destination is in the footer below,
            where it is announced properly.
          */}
          <Link className="signin-brand-more" href="/" tabIndex={-1}>
            Learn more
          </Link>
        </div>
      </aside>

      <div className="signin-pane">
        <div className="signin-col">
          {/* Only below the breakpoint, where the panel is not there to carry it. */}
          <Wordmark className="logo signin-mark" as="p" sub="os" />

          {children}

          <p className="signin-foot">
            <Link href="/#how">How it works</Link>
            <Link href="/#ways">What it costs</Link>
            <Link href="/legal/terms">Terms</Link>
            <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
          </p>
        </div>
      </div>
    </main>
  );
}
