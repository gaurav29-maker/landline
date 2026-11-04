"use client";

import { useState } from "react";
import { SHAPES } from "@/lib/sample-record";

/**
 * The three shapes a book arrives in, as a list you pick from.
 *
 * REPLACES THE FILM. What stood here was a 16:9 card that cross-faded
 * through five frames on a loop with a play button — editlobby's
 * introduction block, rebuilt. It had one real problem: the argument was
 * on screen for three seconds in every seventeen, and a reader who
 * glanced at the section got whichever frame happened to be up.
 *
 * This is their PROBLEM section instead. Measured off their own markup
 * rather than guessed off the render:
 *
 *   grid            1fr min(420px, 100%)
 *   grid gap        clamp(20px, 2.5vw, 36px)
 *   row gap         12px
 *   label           14px / 600 / 0.14em, uppercase
 *   row headline    15px
 *   row stat        20px, its caption 13px
 *   panel stat      68px
 *
 * THE COUNT IS NOT THEIRS. They run four rows. We have three shapes in
 * lib/sample-record and a fourth would have to be invented, which is the
 * one thing this section exists not to do.
 *
 * NOTHING NEW WAS WRITTEN FOR IT. Every figure, question and label comes
 * out of lib/sample-record — the same source the downloadable file uses,
 * so the card and the artefact cannot drift. It is all invented, no
 * security is named and nobody is described; the footnote at the foot
 * says so and the mark on the heading points at it.
 *
 * EVERY CLASS AND ID HERE CARRIES AN aud- PREFIX, and that is load
 * bearing. components/BookShapes renders the SAME THREE SHAPES further
 * down this page and owns `.shapes`, `.shapes-tab`, `.shapes-rows` and
 * the id `shape-tab-<key>`. A first draft of this file used those names
 * and would have inherited that section's flex column AND put duplicate
 * ids on one document. The two components are neighbours on one page and
 * must not share a namespace.
 *
 * THEY ALSO SHOULD NOT BOTH EXIST. See the note in app/page.tsx above
 * this component — two sections two bands apart now show the same three
 * figures, and that is a content decision rather than a styling one.
 */

/*
   Drawn for these three, not borrowed. A 40 grid stroked at 1.6 and
   painted with currentColor, which is the convention the "how it works"
   icons on this page already use, so the set reads as one hand.

   aria-hidden on the wrapper: the label beside each one says what it is,
   and a screen reader announcing "circle, circle, circle" before "A long
   list of small ones" is noise.
*/
const ICONS: Record<string, React.ReactNode> = {
  /* One tall bar and two short: half the money in a few names. */
  concentrated: (
    <>
      <path d="M11 29V17" />
      <path d="M20 29V9" />
      <path d="M29 29v-8" />
    </>
  ),
  /* Nine small marks, none of them larger than another. */
  scattered: (
    <>
      {[12, 20, 28].map((y) =>
        [12, 20, 28].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.9" />)
      )}
    </>
  ),
  /* A small base with a much larger shape resting on it. */
  derivatives: (
    <>
      <rect x="9" y="24" width="22" height="6" rx="2" />
      <path d="M13 24V14a7 7 0 0 1 14 0v10" />
    </>
  ),
};

export default function AuditShapes() {
  /*
     Opens on the first shape rather than on nothing, so the panel is
     already carrying its argument in the first still frame — a thumbnail,
     a shared link and a reader who never clicks all get a populated page
     instead of an empty slot waiting for input.
  */
  const [picked, setPicked] = useState(0);
  const shape = SHAPES[picked];

  return (
    <div className="aud">
      <div className="aud-grid">
        <div className="aud-rows" role="tablist" aria-label="Three shapes a portfolio arrives in">
          {SHAPES.map((s, n) => (
            <button
              key={s.key}
              type="button"
              role="tab"
              id={`aud-tab-${s.key}`}
              aria-selected={n === picked}
              aria-controls="aud-panel"
              className={`aud-row${n === picked ? " on" : ""}`}
              onClick={() => setPicked(n)}
            >
              <span className="aud-ico" aria-hidden="true">
                <svg
                  viewBox="0 0 40 40"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  {ICONS[s.key]}
                </svg>
              </span>

              <span className="aud-text">
                <span className="aud-label">
                  {String(n + 1).padStart(2, "0")} &mdash; {s.chip}
                </span>
                <span className="aud-head">{s.summary}</span>
              </span>

              {/*
                THE NUMBER ALONE, AND THE CAPTION UNDER IT WAS A BUG.

                It printed s.bar.aLabel beneath s.figure.value, which are
                two different facts: the scattered book showed "4%" over
                "top three", when 4% is the largest SINGLE holding and the
                top three are 11%. Two of the three shapes were captioned
                with a number that was not the one above it.

                Theirs captions this slot with the word "before", which
                belongs to a before-and-after framing we do not have. With
                no honest one-word equivalent, the chip is the figure and
                nothing else — the full caption is in the panel, one click
                away and set at 68px.
              */}
              <span className="aud-chip" aria-hidden="true">
                <b>{s.figure.value}</b>
              </span>

              <span className="aud-arrow" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h13M13 7l5 5-5 5" />
                </svg>
              </span>
            </button>
          ))}
        </div>

        <aside
          className="aud-panel"
          id="aud-panel"
          role="tabpanel"
          aria-labelledby={`aud-tab-${shape.key}`}
          /* The key remounts it, so the panel fades on each pick rather
             than cutting. The animation is declared in the stylesheet
             with a reduced-motion fallback, not here. */
          key={shape.key}
        >
          <div className="aud-panel-head">
            <span className="aud-panel-n">Shape {String(picked + 1).padStart(2, "0")}</span>
            <h3>{shape.chip}</h3>
          </div>

          <p className="aud-fig">
            <b>{shape.figure.value}</b>
            <span>{shape.figure.caption}</span>
          </p>

          {/*
            Two segments that sum to 100 — a proportion of one book, never
            a score. Both labels are printed, because a bar with one
            number on it invites the reader to guess what the rest is.

            THE HEADING ABOVE IT IS NOT DECORATION. The figure and the bar
            are different facts, and in two of the three shapes they are
            different numbers: the F&O book reads 62% in the figure and
            fills the bar to 38%, because the figure is the margin and the
            filled segment is the cash. Sitting a bar directly under a
            large percentage invites the reader to take one as a picture
            of the other. Naming it stops that.
          */}
          <p className="aud-bar-h">How the book splits</p>
          <div className="aud-bar" aria-hidden="true">
            <span style={{ width: `${shape.bar.aPct}%` }} />
          </div>
          <p className="aud-bar-key">
            <span>
              <i /> {shape.bar.aLabel} &middot; {shape.bar.aPct}%
            </span>
            <span>
              {shape.bar.bLabel} &middot; {shape.bar.bPct}%
            </span>
          </p>

          <blockquote className="aud-ask">{shape.expertAsks}</blockquote>

          {/*
            The one artefact a visitor can hold before paying anything,
            and it is the same file the member downloads afterwards.
          */}
          <p className="aud-get">
            <a href="/sample-record">
              Read a whole session record
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 12h13M13 7l5 5-5 5" />
              </svg>
            </a>
          </p>
        </aside>
      </div>

      {/*
        Commercial and legal facts rather than decoration, so they stay
        visible instead of going inside the panel where two of the three
        picks would hide them. The footnote mark on the heading lands here.
      */}
      <p className="reel-cap" id="audit-note">
        <sup>1</sup> An example, and not a client &mdash; nobody is described and no security is
        named. No recommendation, no price target, no model portfolio. One call, no mandate
        and nothing to cancel. The rate and the SEBI answer are on the expert&rsquo;s page
        before you pay.
      </p>
    </div>
  );
}
