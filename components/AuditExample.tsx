"use client";

import { useEffect, useRef, useState } from "react";
import { INTAKE_RETENTION_DAYS } from "@/lib/constants";

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
function head(title: string): string[] {
  return ["", title.toUpperCase(), "-".repeat(title.length), ""];
}

type Shape = {
  key: string;
  chip: string;
  summary: string;
  /*
     The one fact that defines the shape, drawn. Two segments that sum to
     100 — a proportion of the same book, not a score and not a rating.
  */
  bar: { aLabel: string; aPct: number; bLabel: string; bPct: number };
  /*
     The one number worth setting large, after Tesla — whose product pages
     put a bare figure at 48px, the same size as the product name, with a
     small label under it and nothing else competing.

     Written per shape rather than generated from the bar, because the most
     striking framing is different each time: the concentrated book is about
     how MUCH is in three names, the scattered one about how LITTLE the
     largest is. A template would have produced three sentences and one
     good one.
  */
  figure: { value: string; caption: string };
  /*
     What the expert asks about it.

     The beat this section never had. The product is a conversation, and the
     most convincing thing about a good one is the question — not the
     finding, which reads as a verdict, but the thing somebody says out loud
     that you had not asked yourself.

     Observational by construction: each is about the book's SHAPE and how
     it came to be, and none of them has a right answer that would amount to
     advice. "What should I do about it" is the question we do not print.
  */
  expertAsks: string;
  when: string;
  /** The date the real filename leads with, so a folder sorts by call. */
  stamp: string;
  holdings: { pct: number; label: string }[];
  intakeSummary: string;
  goals: string;
  experience: number;
  risk: string;
  fno: boolean;
  asked: string;
  note: string;
};

const EXPERT = "Gaurav Khona";

const SHAPES: Shape[] = [
  {
    key: "concentrated",
    chip: "A few big positions",
    summary: "14 stocks and 3 funds, with half the money in three names.",
    figure: { value: "51%", caption: "of the book sits in three names" },
    expertAsks: "Was that a decision, or did it arrive one buy at a time?",
    bar: {
      aLabel: "Top three",
      aPct: 51,
      bLabel: "The other 14 holdings",
      bPct: 49,
    },
    when: "Tue, 16 Sept, 10:00 am IST",
    stamp: "2026-09-16",
    holdings: [
      { pct: 22, label: "Private bank" },
      { pct: 16, label: "IT services" },
      { pct: 13, label: "NBFC" },
      { pct: 9, label: "Cement" },
      { pct: 8, label: "Large-cap fund" },
    ],
    intakeSummary:
      "14 stocks and 3 funds. Two of the funds are large-cap and I think they hold a lot of the same things I hold directly.",
    goals: "Not planning to sell anything. I want to know whether the shape of it is sensible.",
    experience: 9,
    risk: "Medium",
    fno: false,
    asked: "Is being this concentrated in three names a problem, or is it just a decision?",
    note:
      "We went through the book position by position and spent most of the hour on the three names that are half of it. Talked about whether that concentration was chosen or arrived at one buy at a time, and what you would want to see before it changed. Also looked at the two large-cap funds against your direct holdings — six names appear in both.",
  },
  {
    key: "scattered",
    chip: "A long list of small ones",
    summary: "41 stocks and 9 funds, with nothing large enough to matter on its own.",
    figure: { value: "4%", caption: "is the largest single holding, across fifty of them" },
    expertAsks: "Which of these could you still give me the reason for?",
    bar: {
      aLabel: "Top three",
      aPct: 11,
      bLabel: "The other 47 holdings",
      bPct: 89,
    },
    when: "Thu, 18 Sept, 6:30 pm IST",
    stamp: "2026-09-18",
    holdings: [
      { pct: 4, label: "Private bank" },
      { pct: 4, label: "Flexi-cap fund" },
      { pct: 3, label: "IT services" },
      { pct: 3, label: "Mid-cap fund" },
      { pct: 3, label: "Pharma" },
    ],
    intakeSummary:
      "41 stocks and 9 funds. I have been adding for about six years and have not sold much. The list is long and I am not sure all of it still makes sense.",
    goals: "I want to understand what I actually own, rather than what the list says I own.",
    experience: 6,
    risk: "Medium",
    fno: false,
    asked: "Is fifty holdings too many?",
    note:
      "Went through the whole list. Most of the session was on which positions you could still give a reason for, and on how much of the spread survives once the nine funds are looked through rather than counted. Ended on IT, which comes to 19% across the direct holdings and the funds together and is a larger position than anything on the list.",
  },
  {
    key: "derivatives",
    chip: "Mostly F&O",
    summary: "A small cash book, and most of the risk in open positions.",
    figure: { value: "62%", caption: "of capital is margin, not holdings" },
    expertAsks: "What are you expressing with the seven that share an underlying?",
    bar: {
      aLabel: "Cash book",
      aPct: 38,
      bLabel: "Margin in use",
      bPct: 62,
    },
    when: "Mon, 22 Sept, 8:00 pm IST",
    stamp: "2026-09-22",
    holdings: [
      { pct: 14, label: "Private bank" },
      { pct: 9, label: "IT services" },
      { pct: 6, label: "Index fund" },
      { pct: 5, label: "Auto" },
      { pct: 4, label: "Metals" },
    ],
    intakeSummary:
      "6 stocks and 1 fund, about 38% of capital. The rest is margin against 11 open F&O positions, 7 of them on the index.",
    goals: "I want someone to look at the whole thing at once. I usually only look position by position.",
    experience: 4,
    risk: "High",
    fno: true,
    asked: "Am I taking one risk eleven times?",
    note:
      "Spent the session on the open positions rather than the holdings, since that is where the capital is. Went through the seven on the same underlying and what you were expressing with them together rather than separately. Also talked about how rarely the book gets looked at as a whole — this was the first time you had seen all eleven on one page.",
  },
];

/** The file, assembled the way the download route assembles it. */
function recordFor(s: Shape): string {
  const lines: string[] = [
    "LANDLINE — SESSION RECORD",
    "=========================",
    "",
    `Expert    ${EXPERT}`,
    `When      ${s.when}`,
    "Status    completed",
    "Paid      ₹5,499",
    "Reference 3f9a21c4-7e08-4b1d-9c55-2ab6e0f41d73",
  ];

  lines.push(...head("What you shared before the call"));
  lines.push("Holdings");
  for (const h of s.holdings) lines.push(`  ${h.pct}%  ${h.label}`);
  lines.push("  …");
  lines.push("");
  lines.push("Summary", `  ${s.intakeSummary}`, "");
  lines.push("Goals", `  ${s.goals}`, "");
  lines.push(
    `Experience  ${s.experience} years`,
    `Risk        ${s.risk}`,
    `F&O         ${s.fno ? "yes" : "no"}`,
  );
  lines.push("", "What you asked", `  ${s.asked}`);

  lines.push(...head(`What ${EXPERT.split(" ")[0]} wrote back`));
  lines.push(s.note);

  lines.push(
    ...head("About this record"),
    `Landline keeps your intake and the expert's note for ${INTAKE_RETENTION_DAYS} days after`,
    "the call, then deletes both. This file is your copy and is not deleted.",
    "",
    "A Landline session is a review and a discussion of a portfolio you already",
    "hold. It is not personalised investment advice, and nothing above is a",
    "recommendation to buy or sell anything.",
    "",
  );

  return lines.join("\n");
}

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
                <p className="reel-name">
                  {`landline-${SHAPES[0].stamp}-gaurav-khona.txt`}
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
