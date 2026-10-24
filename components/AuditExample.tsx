"use client";

import { useEffect, useRef, useState } from "react";
import { recordFor, SHAPES, type Shape } from "@/lib/sample-record";

/**
 * The thing you actually keep, shown as the file it actually is.
 *
 * WHAT WAS WRONG WITH THE VERSION BEFORE THIS. It rendered "what the expert
 * said back" as three headed findings with paragraphs under them — which
 * reads as a written report, and Landline does not produce one. What it
 * produces is a 45-minute call, a note the expert writes afterwards capped
 * at 900 characters, and a plain-text record the member can download. A
 * visitor was being shown an analysis document and sold a conversation.
 *
 * That is the same fault as the "reads your portfolio before the call" copy
 * that came off the site last week: a page depicting something that does not
 * exist. This section now shows the record, in the format
 * app/member/sessions/[id]/record actually emits — same banner, same rules
 * under the headings, same retention paragraph, same closing disclaimer.
 *
 * KEPT IN SYNC BY SHAPE, NOT BY COPY-PASTE. `head()` below is the same four
 * lines as the route's helper: a blank, the title uppercased, a rule as long
 * as the title, a blank. If the route's format changes this will not follow
 * automatically — but it will be obviously wrong next to a real download,
 * which is a better failure than a stylised illustration that can never be
 * wrong because it never resembled anything.
 *
 * NO SECURITY IS NAMED. A real member writes "HDFC Bank" in their intake;
 * this file says "Private bank". Naming actual companies in a worked example
 * on a page that sells portfolio reviews puts a security beside an expert's
 * commentary, and the distance between that and an implied recommendation is
 * shorter than it looks. Sector labels carry the shape and carry no tickers.
 *
 * Everything is invented. Three shapes, so the page stops implying there is
 * one kind of portfolio and one kind of problem.
 */

/** The route's own heading: a blank, the title, a rule its length, a blank. */

/*
   THE FILM.

   editlobby.com's introduction block is one thing: a 16:9 card, 16px of
   radius, a 72px white circle in the middle of it, centred on the black
   page with 20px of air above and below and NOTHING else in the section —
   no heading, no copy, no list. Measured off the live page rather than
   guessed, and those are the numbers below.

   What the card plays is the only part that is ours. We have no video,
   and a play button that does nothing is a lie, so the film is built out
   of the section's own content: five frames, cross-faded, on a loop —
   what you send, the same question asked of three different books, and
   the file you keep. The whole product in seventeen seconds, which reads
   at a glance where 1,337px of text did not.

   WHEN A REAL FILM EXISTS this is one swap: a <video muted loop playsInline
   poster> goes into .reel-card in place of the frames and the control row
   stays as it is. The shape of the card does not change.
*/

type Frame =
  | { kind: "intake"; lead: string }
  | { kind: "shape"; shape: Shape }
  | { kind: "record"; lead: string };

const FRAMES: Frame[] = [
  { kind: "intake", lead: "You send what you hold." },
  ...SHAPES.map((s): Frame => ({ kind: "shape", shape: s })),
  { kind: "record", lead: "You keep the record." },
];

/* Long enough to read a twelve-word question without hurrying. */
const FRAME_MS = 3400;

/*
   THE FOOTAGE, WHEN THERE IS ANY.

   Null means the card is its own gradient and no <video> is rendered at
   all — not an empty <video> pointing at a file that is not there, which
   would 404 on every page load for every visitor forever. Turning the
   footage on is this one constant.

   WHAT GOES IN IT. The ground, and only the ground. The five frames stay
   in the DOM over the top, because they are the argument and not the
   decoration: 51%, 4%, 62%, three questions and the record's own first
   lines. A video model renders text unreliably, and the one thing this
   page cannot ship is a wrong number in the worked example.

   AND NO PEOPLE IN IT. A generated human reading a portfolio depicts a
   Landline expert and a session that never happened, on a page that sells
   portfolio reviews. That is the line the empty testimonial array and the
   "an example, and not a client" footnote already hold. Footage that
   depicts nothing factual — a handset, a desk, light — does not cross it.

   The poster is what paints before the file arrives and what a reduced
   motion visitor sees instead of movement. Give it one or the card shows
   its gradient until the video has buffered, which on a slow connection
   is the whole visit.
*/
const FILM: { src: string; poster?: string } | null = null;

export default function AuditExample() {
  const [i, setI] = useState(0);
  /*
     Starts stopped, the way editlobby's does, so the first frame a
     thumbnail or a skimming reader gets is a still one. It starts itself
     when it is actually on screen and stops when it is not — nothing
     should be animating in a band nobody is looking at.
  */
  const [playing, setPlaying] = useState(false);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const filmRef = useRef<HTMLVideoElement | null>(null);
  const started = useRef(false);

  /*
     Anybody who has asked their system for less motion gets the film as a
     still card they step through themselves. Read once on mount rather
     than watched, because the answer does not change mid-session.
  */
  const [still, setStill] = useState(false);
  useEffect(() => {
    setStill(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  useEffect(() => {
    const el = cardRef.current;
    if (!el || still) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting && !started.current) {
          started.current = true;
          setPlaying(true);
        } else if (!e.isIntersecting) {
          setPlaying(false);
        }
      },
      { threshold: 0.45 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [still]);

  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => setI((n) => (n + 1) % FRAMES.length), FRAME_MS);
    return () => clearInterval(t);
  }, [playing]);

  /*
     The footage runs on the same switch as the frames, so the scroll
     observer, the pause button and the reduced-motion answer all reach it
     without any of them knowing it exists. play() rejects rather than
     throwing when a browser declines to autoplay — it should not here,
     the element is muted, but an unhandled rejection in the console is
     not worth the two characters it costs to catch.
  */
  useEffect(() => {
    const v = filmRef.current;
    if (!v) return;
    if (playing && !still) void v.play().catch(() => {});
    else v.pause();
  }, [playing, still]);

  return (
    <div className="reel">
      <div
        ref={cardRef}
        className={`reel-card${playing ? " on" : ""}`}
        role="group"
        aria-label="A worked example of a Landline session, in five frames"
      >
        {FILM ? (
          <>
            {/*
              First in the DOM, so the frames and the button paint over it
              without anything needing a z-index. Decorative, so it is
              hidden from a screen reader and taken out of the tab order:
              the card's own controls are the controls.
            */}
            <video
              ref={filmRef}
              className="reel-film"
              src={FILM.src}
              poster={FILM.poster}
              muted
              loop
              playsInline
              preload="metadata"
              aria-hidden="true"
              tabIndex={-1}
            />
            <div className="reel-scrim" aria-hidden="true" />
          </>
        ) : null}

        {FRAMES.map((f, n) => (
          <div
            key={n}
            className={`reel-frame${n === i ? " on" : ""}`}
            aria-hidden={n === i ? undefined : true}
          >
            {f.kind === "intake" ? (
              <>
                <p className="reel-lead">{f.lead}</p>
                <ul className="reel-mono">
                  {SHAPES[0].holdings.map((h) => (
                    <li key={h.label}>
                      <b>{h.pct}%</b>
                      <span>{h.label}</span>
                    </li>
                  ))}
                  <li className="reel-more">
                    <b>&hellip;</b>
                    <span>and nine more</span>
                  </li>
                </ul>
              </>
            ) : null}

            {f.kind === "shape" ? (
              <>
                <p className="reel-fig">
                  <b>{f.shape.figure.value}</b>
                  <span>{f.shape.figure.caption}</span>
                </p>
                <div className="reel-bar">
                  <span style={{ width: `${f.shape.bar.aPct}%` }} />
                </div>
                <blockquote className="reel-ask">{f.shape.expertAsks}</blockquote>
              </>
            ) : null}

            {f.kind === "record" ? (
              <>
                <p className="reel-lead">{f.lead}</p>
                <pre className="reel-file">
                  {recordFor(SHAPES[0]).split("\n").slice(0, 8).join("\n")}
                </pre>
                {/*
                  The filename was a label; it is a link now. Eight lines
                  of a record is a description of the artefact — this is
                  the artefact, and it is the only one a visitor can hold
                  before paying anything. Same source as the lines above
                  it, so the two cannot drift.
                */}
                <p className="reel-name">
                  <a className="reel-get" href="/sample-record">
                    {`landline-${SHAPES[0].stamp}-gaurav-khona.txt`}
                    <span>Read the whole file</span>
                  </a>
                </p>
              </>
            ) : null}
          </div>
        ))}

        {/*
          The 72px white circle, at editlobby's own rgba(255,255,255,0.9).
          It is the whole control while the film is stopped and it shrinks
          out of the way the moment it is running.
        */}
        <button
          type="button"
          className="reel-play"
          onClick={() => setPlaying((p) => !p)}
          aria-label={playing ? "Pause the example" : "Play the example"}
        >
          {playing ? (
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M8 5.5l10.5 6.5L8 18.5z" />
            </svg>
          )}
        </button>
      </div>

      {/*
        The scrubber is also the chapter list: five real buttons, so the
        film is reachable with a keyboard and by anybody who would rather
        read it than watch it go past.
      */}
      <div className="reel-track">
        {FRAMES.map((f, n) => (
          <button
            key={n}
            type="button"
            className={`reel-seg${n === i ? " on" : ""}${n === i && playing ? " run" : ""}`}
            onClick={() => {
              setI(n);
              setPlaying(false);
            }}
            aria-label={`Frame ${n + 1} of ${FRAMES.length}`}
            aria-current={n === i ? "true" : undefined}
          >
            <span style={{ animationDuration: `${FRAME_MS}ms` }} />
          </button>
        ))}
      </div>

      {/*
        What survives of the four actions, on one line. They were a spec
        list of four rows, and the card is the section now — but they are
        commercial and legal facts, not decoration, so they stay visible
        rather than going inside the film where they would be on screen
        for three seconds in every seventeen. The footnote mark on the
        headline lands here.
      */}
      <p className="reel-cap" id="audit-note">
        <sup>1</sup> An example, and not a client &mdash; nobody is described and no security is
        named. No recommendation, no price target, no model portfolio. Forty-five minutes, no
        mandate and nothing to cancel. The rate and the SEBI answer are on the expert&rsquo;s page
        before you pay.
      </p>
    </div>
  );
}
