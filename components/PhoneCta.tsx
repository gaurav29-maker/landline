"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

/**
 * The bottom capsule, twin of the one in the nav.
 *
 * Same material as .nav::before — the glass ground, the rim and the lift, at
 * the same fully round radius — so the phone has one object at each end of
 * the screen rather than a nav capsule at the top and a different kind of
 * thing at the bottom. After Palace, where the thing you are meant to press
 * sits at the bottom of the first screen, in the thumb's reach, instead of
 * halfway up it.
 *
 * WHY IT WAITS. A bar that is always there would put "Find an expert" twice
 * on one screen, a hundred pixels apart, while the hero's own button is
 * still visible — which reads as a bug rather than a convenience. So it
 * watches the hero and appears once the hero has gone. An IntersectionObserver
 * rather than a scroll handler: one callback when the state actually changes,
 * instead of a measurement on every frame of a scroll.
 *
 * NO OBSERVER, NO PROBLEM. If the hero is not on the page — any route that
 * is not the home page — the observer never attaches and the capsule shows
 * immediately, which is the right behaviour there anyway.
 *
 * Phone only. Above 900 the nav carries a Find an expert button of its own
 * and this would be a third copy; the CSS hides it rather than this file
 * guessing at a width.
 */
export default function PhoneCta() {
  const [shown, setShown] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const hero = document.querySelector(".hero-band");
    if (!hero) {
      setShown(true);
      return;
    }

    const io = new IntersectionObserver(
      ([entry]) => setShown(!entry.isIntersecting),
      /* A little of the hero still showing counts as showing. */
      { threshold: 0, rootMargin: "-80px 0px 0px 0px" },
    );
    io.observe(hero);
    return () => io.disconnect();
  }, []);

  return (
    <div className={`phone-cta${shown ? " is-up" : ""}`} ref={ref} aria-hidden={!shown}>
      <Link className="phone-cta-link" href="/experts" tabIndex={shown ? 0 : -1}>
        Find an expert
      </Link>
    </div>
  );
}
