"use client";

import { useState } from "react";
import { SHAPES } from "@/lib/sample-record";

/**
 * The three shapes, as a chart you switch between.
 *
 * REPLACES A LIST OF ROWS. Before this the section was editlobby's PROBLEM
 * layout — three rows on the left, a panel on the right — and before that a
 * film. The rows said "14 stocks and 3 funds, with half the money in three
 * names" and asked the reader to picture it. The chart IS it.
 *
 * The control is davidprotein.com's, measured at 1280:
 *
 *   track    46px tall, rounded-full, rgb(32,32,32)
 *   pill     47px, rgb(22,22,22), 1px rgb(144,144,144)
 *   label    12px, white when active, rgb(144,144,144) when not
 *
 * Theirs slides the pill with GSAP Flip. Ours moves it with a transform on
 * a CSS transition, which is the same effect in four lines and no library,
 * and it is disabled under prefers-reduced-motion in the stylesheet.
 *
 * ONE SCALE FOR ALL THREE, AND IT IS THE WHOLE POINT. The obvious
 * implementation gives each shape its own y-axis so every chart fills the
 * box — and then the concentrated book and the scattered one draw an
 * IDENTICAL picture, because both are just five bars descending. The
 * section's claim is that the shape is the thing nobody has said out loud,
 * so the axis is fixed at CHART_MAX across all three: concentrated towers,
 * scattered is nearly flat, and the difference is visible without reading
 * a number. A chart that rescales per tab would have quietly argued the
 * opposite of the copy above it.
 *
 * EVERY FIGURE IS FROM lib/sample-record — the same holdings the
 * downloadable example file lists, so the chart and the artefact cannot
 * disagree. It is all invented, no security is named, and the footnote at
 * the foot says so.
 */

/*
   The tallest holding in any of the three shapes is 22. 24 gives the bar
   a little headroom so the tallest one is not flush with the ceiling, and
   it is a constant rather than a computed max so adding a shape later
   cannot silently rescale the other two.
*/
const CHART_MAX = 24;

export default function AuditShapes() {
  const [picked, setPicked] = useState(0);
  const shape = SHAPES[picked];

  return (
    <div className="aud">
      {/*
        A real tablist of real buttons. The sliding pill is one absolutely
        positioned element translated by the index — not three backgrounds
        fading in and out, which is what makes the movement read as one
        object rather than a crossfade.
      */}
      <div className="aud-toggle" role="tablist" aria-label="Three shapes a portfolio arrives in">
        <span
          className="aud-toggle-pill"
          aria-hidden="true"
          style={{ transform: `translateX(${picked * 100}%)` }}
        />
        {SHAPES.map((s, n) => (
          <button
            key={s.key}
            type="button"
            role="tab"
            id={`aud-tab-${s.key}`}
            aria-selected={n === picked}
            aria-controls="aud-panel"
            className={`aud-tab${n === picked ? " on" : ""}`}
            onClick={() => setPicked(n)}
          >
            {s.chip}
          </button>
        ))}
      </div>

      <div className="aud-panel" id="aud-panel" role="tabpanel" aria-labelledby={`aud-tab-${shape.key}`}>
        <p className="aud-chart-h">The five largest holdings, as a share of the book</p>

        {/*
          role="img" with a written label, because five bars are a picture
          to a screen reader no matter how they are marked up. The sentence
          says what the shape is, which is what a sighted reader takes from
          the drawing.
        */}
        <div
          className="aud-bars"
          role="img"
          aria-label={`${shape.chip}: largest holdings ${shape.holdings
            .map((h) => `${h.label} ${h.pct}%`)
            .join(", ")}. ${shape.figure.value} ${shape.figure.caption}.`}
        >
          {shape.holdings.map((h, i) => (
            <div className="aud-bar" key={`${shape.key}-${h.label}-${i}`}>
              <span className="aud-bar-pct">{h.pct}%</span>
              <span
                className="aud-bar-fill"
                /* The transition is on height, so the bars grow into their
                   new values when the tab changes rather than cutting. */
                style={{ height: `${(h.pct / CHART_MAX) * 100}%` }}
                data-lead={i === 0 ? "true" : undefined}
              />
              <span className="aud-bar-label">{h.label}</span>
            </div>
          ))}
        </div>

        {/*
          The one number worth setting large, under the drawing it came
          from rather than above it: the chart earns the figure.
        */}
        <p className="aud-fig">
          <b>{shape.figure.value}</b>
          <span>{shape.figure.caption}</span>
        </p>

        <blockquote className="aud-ask">{shape.expertAsks}</blockquote>

        <p className="aud-get">
          <a href="/sample-record">
            Read a whole session record
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12h13M13 7l5 5-5 5" />
            </svg>
          </a>
        </p>
      </div>

      <p className="reel-cap" id="audit-note">
        <sup>1</sup> An example, and not a client &mdash; nobody is described and no security is
        named. No recommendation, no price target, no model portfolio. One call, no mandate
        and nothing to cancel. The rate and the SEBI answer are on the expert&rsquo;s page
        before you pay.
      </p>
    </div>
  );
}
