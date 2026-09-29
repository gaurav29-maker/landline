"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import ThemeToggle from "@/components/ThemeToggle";
import Wordmark from "@/components/Wordmark";

export type NavLink = { href: string; label: string };

/** Where a phone goes when it is not going anywhere on this page. */
const META: NavLink[] = [
  { href: "/legal/terms", label: "Terms" },
  { href: "/legal/privacy", label: "Privacy" },
  { href: "/legal/refunds", label: "Refunds" },
];

/**
 * The phone nav: a wordmark, and a way to everything else.
 *
 * The menu is a full screen rather than a card hanging off the bar, after
 * x.ai — its own header with the wordmark and a close button, the
 * destinations as full-width rows divided by hairlines, and a footer with
 * the one thing we actually want pressed.
 *
 * A sheet that covers the page needs no scrim behind it and has no outside
 * to press, so both are gone: what closes it is the button, Escape, or
 * choosing somewhere to go.
 *
 * This owns `.nav-aside` rather than sitting inside it because the button
 * and the panel share one piece of state and belong in different places —
 * the button in the bar's right-hand slot, the panel over the whole screen.
 * A fragment cannot straddle two parents, so the slot comes with it.
 */
export default function NavMenu({
  links,
  signInHref,
  ctaHref,
}: {
  links: NavLink[];
  signInHref: string;
  ctaHref: string;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const openerRef = useRef<HTMLButtonElement>(null);
  const closerRef = useRef<HTMLButtonElement>(null);

  const close = () => setOpen(false);

  /*
   * Escape closes, and the focus goes back to the button that opened it.
   * Without that second half, dismissing the menu drops the caret at the top
   * of the document and a keyboard user starts the page again.
   */
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        openerRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  /*
   * Opening moves focus into the sheet. It covers the page, so leaving the
   * caret behind it would let a keyboard tab through a screenful of links
   * nobody can see.
   */
  useEffect(() => {
    if (open) closerRef.current?.focus();
  }, [open]);

  /*
   * The page behind must not scroll under the menu. Restoring the previous
   * value rather than clearing it: something else may own overflow one day,
   * and this should not be the thing that quietly takes it.
   */
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  /* A same-page hash stays a bare anchor: through Link it navigates instead
     of scrolling, which is the note SiteNav already carries. */
  const row = (l: NavLink, className: string) =>
    l.href.startsWith("#") ? (
      <a key={l.href} className={className} href={l.href} onClick={close}>
        {l.label}
      </a>
    ) : (
      <Link key={l.href} className={className} href={l.href} onClick={close}>
        {l.label}
      </Link>
    );

  return (
    <>
      <div className="nav-aside">
        {/*
          Above 900 this is a button in the bar; below, it opens the sheet.

          Filled, not outlined. Signing in is an action somebody came here to
          take, and editlobby's equivalent — Login to LobbyOS — is a solid
          pill sitting next to their solid Book a call. An outline next to a
          fill reads as "this one is the lesser option", which is not true of
          a returning member.
        */}
        <Link className="b b-fill b-sm" href={signInHref}>
          Landline OS
        </Link>

        <button
          ref={openerRef}
          type="button"
          className="nav-burger"
          aria-expanded={open}
          aria-controls={panelId}
          aria-label="Menu"
          onClick={() => setOpen(true)}
        >
          {/*
            Three bars, not three strokes. x.ai draws this as a filled path
            with square ends — 16 wide and 2 deep on a 24 grid, 6 apart —
            where ours was round-capped lines. A round cap on a 2px line
            eats a pixel off each end and reads softer than the type beside
            it; a drawn rectangle is the same weight at any size.
          */}
          <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden focusable="false">
            <rect className="bl" x="4" y="5" width="16" height="2" />
            <rect className="bl" x="4" y="11" width="16" height="2" />
            <rect className="bl" x="4" y="17" width="16" height="2" />
          </svg>
        </button>
      </div>

      <div className="nav-panel" id={panelId} data-open={open} role="dialog" aria-modal="true" aria-label="Menu">
        {/*
          The sheet's header is the bar's measurements exactly — same height,
          same gutter — so the wordmark does not move when the menu opens.
        */}
        <div className="nav-panel-top">
          <Wordmark className="mark" href="/" />
          <div className="nav-panel-top-end">
            <ThemeToggle />
            <button
              ref={closerRef}
              type="button"
              className="nav-burger nav-close"
              aria-label="Close menu"
              onClick={close}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden focusable="false">
                <path className="bl" d="M6 6L18 18M18 6L6 18" />
              </svg>
            </button>
          </div>
        </div>

        <div className="nav-panel-links">
          <ul>
            {links.map((l) => (
              <li key={l.href}>{row(l, "nav-panel-link")}</li>
            ))}
            <li>{row({ href: signInHref, label: "Landline OS" }, "nav-panel-link")}</li>
          </ul>
        </div>

        <div className="nav-panel-foot">
          <Link className="b b-fill" href={ctaHref} onClick={close}>
            Find an expert
          </Link>
          <div className="nav-panel-meta">
            {META.map((m, i) => (
              <span key={m.href}>
                {i > 0 ? <span aria-hidden>·</span> : null}
                <Link href={m.href} onClick={close}>
                  {m.label}
                </Link>
              </span>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
