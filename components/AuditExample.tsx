"use client";

import { useState } from "react";
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

export default function AuditExample() {
  const [key, setKey] = useState(SHAPES[0].key);
  const shape = SHAPES.find((s) => s.key === key) ?? SHAPES[0];

  return (
    <div className="spec">
      {/*
        The flag is the first thing in the block and the file repeats the
        disclaimer at its foot, because this is the one place on the site
        where being mistaken for a real client's numbers would matter.
      */}
      <p className="spec-flag">
        <span className="eyebrow">An example — not a client</span>
        <span className="spec-note">
          Invented to show the shape of a record. All three describe nobody, no security is named,
          and no Landline session has been reproduced here.
        </span>
      </p>

      {/*
        Radio rather than tabs: three answers to one question, and the
        question is asked out loud so the row is not decoration.
      */}
      <div
        className="spec-pick"
        role="radiogroup"
        aria-label="Which of these looks most like your portfolio?"
      >
        <span className="eyebrow">Which looks most like yours?</span>
        {SHAPES.map((s) => (
          <button
            key={s.key}
            type="button"
            role="radio"
            aria-checked={s.key === key}
            className={`chip${s.key === key ? " on" : ""}`}
            onClick={() => setKey(s.key)}
          >
            {s.chip}
          </button>
        ))}
      </div>

      <p className="spec-summary">{shape.summary}</p>

      {/*
        A file, drawn as one. The name bar is the filename the route really
        builds — date first, so a folder of these sorts by when the call
        happened.
      */}
      <figure className="spec-file">
        <figcaption className="spec-file-name">
          {`landline-${shape.stamp}-gaurav-khona.txt`}
        </figcaption>
        <pre className="spec-file-body">{recordFor(shape)}</pre>
      </figure>

      <p className="spec-not">
        This is the whole of it: what you sent, what was discussed, and the retention rule. There
        is no report, no score and no rating, because a session is a conversation and this is the
        note that outlives it.
      </p>
    </div>
  );
}
