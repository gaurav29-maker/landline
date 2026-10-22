"use client";

import { useEffect, useRef, useState } from "react";
import { TESTIMONIALS } from "@/lib/testimonials";

/**
 * What people said, in editlobby.com's testimonial block.
 *
 * Their numbers, read off the live page: a pill, 24px of air, then cards
 * 410 wide at 24px of radius with 100px 36px of padding on a ground one
 * step off the page, two visible at a time, and a 40x40 pair of arrows
 * at the top right. Name and quote are both 18px at 500, the name in the
 * same grey as the quote, with a hairline between them.
 *
 * THIS RENDERS NOTHING TODAY, and that is the point of it.
 *
 * lib/testimonials.ts is an empty array on purpose, and the reasoning is
 * written out in that file: a fabricated review is not a placeholder, it
 * is a false statement to a consumer, and on a page selling portfolio
 * reviews to retail investors it is the worst available place to try it.
 * So this component is the fixture and not the content — the day somebody
 * real says something and agrees to be quoted, one entry in that array
 * turns this on.
 *
 * NO EMPHASIS MARKUP. Theirs bolds the good bits of each quote — seamless,
 * consistently clean, tailored perfectly. We take the quote as one plain
 * string and set all of it the same, because the thing that makes a real
 * testimonial read as real is that it has not been edited for effect, and
 * bolding the best four words is editing it for effect.
 */
export default function Testimonials() {
  const railRef = useRef<HTMLDivElement | null>(null);
  /*
     Arrows that cannot do anything should not be drawn. Measured rather
     than counted, because whether three cards overflow depends on the
     window and not on there being three of them.
  */
  const [canScroll, setCanScroll] = useState(false);
  const [at, setAt] = useState({ start: true, end: false });

  useEffect(() => {
    const el = railRef.current;
    if (!el) return;
    const read = () => {
      const slack = el.scrollWidth - el.clientWidth;
      setCanScroll(slack > 4);
      setAt({ start: el.scrollLeft <= 4, end: el.scrollLeft >= slack - 4 });
    };
    read();
    el.addEventListener("scroll", read, { passive: true });
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", read);
      ro.disconnect();
    };
  }, []);

  /* One card plus the gap, so a press lands on a card edge and not mid-card. */
  function nudge(dir: -1 | 1) {
    const el = railRef.current;
    if (!el) return;
    const card = el.querySelector(".heard-card");
    const step = card ? card.getBoundingClientRect().width + 24 : el.clientWidth * 0.8;
    el.scrollBy({ left: dir * step, behavior: "smooth" });
  }

  if (TESTIMONIALS.length === 0) return null;

  return (
    <div className="heard">
      <div className="heard-head">
        <h2 className="band-pill">What people said</h2>
        {canScroll ? (
          <div className="heard-arrows">
            <button
              type="button"
              className="heard-arrow"
              onClick={() => nudge(-1)}
              disabled={at.start}
              aria-label="Previous"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M15 5l-7 7 7 7" />
              </svg>
            </button>
            <button
              type="button"
              className="heard-arrow"
              onClick={() => nudge(1)}
              disabled={at.end}
              aria-label="Next"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        ) : null}
      </div>

      <div
        ref={railRef}
        className="heard-rail"
        tabIndex={0}
        role="group"
        aria-label="What members said. Scroll sideways for more."
      >
        {TESTIMONIALS.map((t) => (
          <figure className="heard-card" key={t.name + t.quote.slice(0, 24)}>
            <figcaption className="heard-who">
              {t.name}
              {t.note ? <span>{t.note}</span> : null}
            </figcaption>
            <blockquote className="heard-quote">{t.quote}</blockquote>
          </figure>
        ))}
      </div>
    </div>
  );
}
