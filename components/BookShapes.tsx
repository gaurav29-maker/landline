"use client";

import { useState } from "react";
import Link from "next/link";
import { SHAPES } from "@/lib/sample-record";

/**
 * What a book looks like, and what an expert asks about it.
 *
 * THE SHAPE IS BORROWED, THE CONTENT IS NOT. davidprotein.com runs a tabbed
 * block — a pill switcher, then a large piece of media beside a heading, a
 * short list and one button. It works because the tabs are the thing being
 * sold and the media is the product.
 *
 * Landline has no product photography. There are no expert portraits, no
 * logotype and no pack shots, and the honest version of this pattern is not
 * a grey box where the photograph goes. So the media is the only artefact
 * this product actually has: the book itself, drawn from the same SHAPES
 * that feed the worked example further up the page. Each tab is a shape a
 * portfolio arrives in, and the panel beside it is that portfolio.
 *
 * NOTHING HERE IS INVENTED. SHAPES is the existing sample-record data, used
 * by the reel and by the downloadable example, so the figures on screen are
 * the same figures the file contains. No security is named in any of them —
 * the chips are shapes, and a shape carries no ticker.
 *
 * TWO VOICES, SET DIFFERENTLY, as everywhere else on this site. The member's
 * situation is in the sans. The expert's question is Instrument Serif,
 * italic, because it is a person speaking.
 */
export default function BookShapes() {
  const [active, setActive] = useState(0);
  const shape = SHAPES[active];

  return (
    <div className="shapes">
      {/*
        A segmented control, not a row of links. One of these is always on,
        which is what a radiogroup means and what a list of buttons does not.
      */}
      <div className="shapes-tabs" role="tablist" aria-label="Shapes a portfolio arrives in">
        {SHAPES.map((s, i) => (
          <button
            key={s.key}
            type="button"
            role="tab"
            id={`shape-tab-${s.key}`}
            aria-selected={i === active}
            aria-controls={`shape-panel-${s.key}`}
            className={`shapes-tab${i === active ? " on" : ""}`}
            onClick={() => setActive(i)}
          >
            {s.chip}
          </button>
        ))}
      </div>

      <div
        className="shapes-body"
        role="tabpanel"
        id={`shape-panel-${shape.key}`}
        aria-labelledby={`shape-tab-${shape.key}`}
      >
        {/*
          Copy first in the DOM and second on a wide screen, so a reader on a
          phone meets the words before the figures and a reader on a laptop
          sees the book first. Same trick the reference uses.
        */}
        <div className="shapes-copy">
          <h3 className="shapes-h">{shape.summary}</h3>

          <p className="shapes-ask">
            <span className="said">&ldquo;{shape.expertAsks}&rdquo;</span>
          </p>
          <p className="shapes-ask-who">What your expert opens with.</p>

          <Link className="b b-fill" href="/experts">
            Find an expert
          </Link>
        </div>

        {/*
          The media. A book rather than a photograph: one figure, the split
          it comes from, and the holdings underneath it. Every number drawn
          here is in the sample record you can download.
        */}
        <div className="shapes-book">
          <p className="shapes-fig">{shape.figure.value}</p>
          <p className="shapes-fig-cap">{shape.figure.caption}</p>

          <div className="shapes-split" aria-hidden="true">
            <span className="shapes-split-a" style={{ width: `${shape.bar.aPct}%` }} />
            <span className="shapes-split-b" style={{ width: `${shape.bar.bPct}%` }} />
          </div>
          <p className="shapes-split-key">
            <span>
              {shape.bar.aLabel} {shape.bar.aPct}%
            </span>
            <span>
              {shape.bar.bLabel} {shape.bar.bPct}%
            </span>
          </p>

          <ul className="shapes-rows">
            {shape.holdings.map((h) => (
              <li key={h.label}>
                <span className="shapes-row-label">{h.label}</span>
                <span className="shapes-row-bar" aria-hidden="true">
                  {/*
                    Scaled against the largest holding rather than against
                    100, or every bar on the scattered book would be a
                    hairline and the chart would say nothing.
                  */}
                  <span style={{ width: `${(h.pct / shape.holdings[0].pct) * 100}%` }} />
                </span>
                <span className="shapes-row-pct">{h.pct}%</span>
              </li>
            ))}
          </ul>

          <p className="shapes-note">
            From the example record. Written as an example &mdash; nobody is quoted and no
            security is named.
          </p>
        </div>
      </div>
    </div>
  );
}
