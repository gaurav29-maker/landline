import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";
import Wordmark from "@/components/Wordmark";
import NavMenu, { type NavLink } from "@/components/NavMenu";

/**
 * The public shell, shared rather than copied.
 *
 * `onLanding` is not cosmetic. The section links are in-page anchors on the
 * home page and must become root-relative anywhere else, or they scroll to
 * nothing — and a same-page "/#experts" would trigger a full navigation
 * instead of a scroll.
 */
export default function SiteNav({ onLanding = false }: { onLanding?: boolean }) {
  const to = (hash: string) => (onLanding ? hash : `/${hash}`);

  /*
   * One list, rendered twice: the capsule on a wide screen, the panel on a
   * phone. Written once so the two cannot drift — a link added to the bar and
   * forgotten in the menu is a link no phone can reach, which is exactly the
   * state this nav was already in.
   */
  const links: NavLink[] = [
    { href: "/experts", label: "Find an expert" },
    { href: to("#audit"), label: "Audit my portfolio" },
    { href: to("#ways"), label: "Packages" },
    { href: to("#how"), label: "How it works" },
  ];

  return (
    <nav className="nav">
      <div className="nav-in">
        <Wordmark className="mark" href="/" />
        <div className="nav-mid">
          {links.map((l) =>
            /* A bare href for a same-page hash: see the note above. */
            l.href.startsWith("#") ? (
              <a key={l.href} href={l.href}>
                {l.label}
              </a>
            ) : (
              <Link key={l.href} href={l.href}>
                {l.label}
              </Link>
            ),
          )}
        </div>
        <div className="nav-end">
          {/* Before the button: it is a setting, not a call to action. */}
          <ThemeToggle />
          <Link className="b b-fill b-sm" href="/experts">
            Find an expert
          </Link>
        </div>
      </div>

      {/*
        Sign-in sits outside the capsule, not in it.

        The capsule is what the site is — where to go and what to do. Getting
        into your own console is a different kind of errand and belongs beside
        that object rather than inside it, which is also how the reference
        separates its account link from its navigation.

        Below 860 that same slot carries the menu button and the capsule
        collapses to a wordmark, so NavMenu owns the slot: the button and the
        panel it opens share one piece of state and cannot share a parent.

        "Find an expert" is dropped from the panel's list because it is the
        button at the foot of it — the same errand twice, once as a line of
        text and once as the thing you press.
      */}
      <NavMenu
        links={links.filter((l) => l.href !== "/experts")}
        signInHref="/member/login"
        ctaHref="/experts"
      />
    </nav>
  );
}
