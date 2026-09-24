"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import ThemeToggle from "@/components/ThemeToggle";

export type NavLink = { href: string; label: string };

/**
 * The phone nav: a wordmark, and a way to everything else.
 *
 * On a wide screen the capsule holds four links, a theme toggle and a call to
 * action, and sign-in floats beside it. None of that fits a 375px row, so
 * until now the links were simply `display: none` below 900 — which is not a
 * mobile nav, it is four links nobody on a phone could reach. The only route
 * to "How it works" was scrolling past it to the footer.
 *
 * Everything the capsule holds moves in here, so there is exactly one place
 * to look rather than some-of-it-in-the-bar-and-some-of-it-gone.
 *
 * This owns `.nav-aside` rather than sitting inside it because the button and
 * the panel share one piece of state and have to be siblings in different
 * places — the button in the right-hand slot, the panel positioned against
 * the whole bar. A fragment cannot straddle two parents, so the slot comes
 * with it.
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
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const close = () => setOpen(false);

  /*
   * Escape closes it, and the focus goes back to the button that opened it.
   * Without that second half, dismissing the menu drops the caret at the top
   * of the document and a keyboard user starts the page again.
   */
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  /*
   * A press anywhere outside closes it. The scrim catches most of that, but
   * not the bar itself — which is above the scrim, because the button has to
   * stay pressable while the menu is open.
   */
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (panelRef.current?.contains(t) || buttonRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
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

  return (
    <>
      <div className="nav-aside">
        {/* Above 860 this is the floating glass button; below, it moves inside. */}
        <Link className="b b-line b-sm" href={signInHref}>
          Landline OS
        </Link>

        <button
          ref={buttonRef}
          type="button"
          className="nav-burger"
          aria-expanded={open}
          aria-controls={panelId}
          aria-label={open ? "Close menu" : "Menu"}
          onClick={() => setOpen((v) => !v)}
        >
          {/*
            Three lines becoming a cross. Drawn rather than swapped, so the
            shape that was pressed is the shape that closes it.
          */}
          <svg width="22" height="16" viewBox="0 0 22 16" aria-hidden focusable="false">
            <line className="bl bl-1" x1="1" y1="1.5" x2="21" y2="1.5" />
            <line className="bl bl-2" x1="1" y1="8" x2="21" y2="8" />
            <line className="bl bl-3" x1="1" y1="14.5" x2="21" y2="14.5" />
          </svg>
        </button>
      </div>

      <div className="nav-scrim" data-open={open} onClick={close} aria-hidden />

      <div className="nav-panel" id={panelId} data-open={open} ref={panelRef}>
        {links.map((l) =>
          /*
           * A same-page hash stays a bare anchor, for the reason SiteNav
           * gives: routed through Link it navigates instead of scrolling.
           */
          l.href.startsWith("#") ? (
            <a key={l.href} className="nav-panel-link" href={l.href} onClick={close}>
              {l.label}
            </a>
          ) : (
            <Link key={l.href} className="nav-panel-link" href={l.href} onClick={close}>
              {l.label}
            </Link>
          ),
        )}

        <Link className="nav-panel-link" href={signInHref} onClick={close}>
          Landline OS
        </Link>

        <div className="nav-panel-foot">
          <Link className="b b-fill b-sm" href={ctaHref} onClick={close}>
            Find an expert
          </Link>
          <ThemeToggle />
        </div>
      </div>
    </>
  );
}
