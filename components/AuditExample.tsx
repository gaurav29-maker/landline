"use client";

import { useState } from "react";

/**
 * The specimen, made selectable.
 *
 * WHY IT CHANGED. It was one invented portfolio, shown flat. Two things are
 * wrong with that and the research on landing pages says both out loud: a
 * static specimen converts worse than one the reader operates, and a single
 * example quietly claims there is a single kind of problem. Somebody holding
 * forty names and nine funds read the concentrated example and concluded the
 * service was for somebody else.
 *
 * So there are three shapes and the reader picks. Choosing one is a small
 * piece of the work — you recognise your own book in a label and then read
 * what a person would notice about it — and that recognition is the thing
 * the section is actually selling.
 *
 * EVERYTHING HERE IS INVENTED and all three say so. The figures describe
 * nobody, no session has been reproduced, and the flag sits above the panel
 * where it cannot be scrolled past rather than under it.
 *
 * Every line is STRUCTURAL: what the portfolio is made of and how it is
 * shaped. Nothing says buy, sell, hold, or what anything is worth. That is
 * the line the terms draw — a session is a review and a discussion, never
 * personalised investment advice — and three examples is three times the
 * opportunity to cross it, so each one was written against that rule rather
 * than checked afterwards.
 *
 * Absent on purpose, as they were before: thesis development, hedging and
 * derivative strategy. Those are advisory activities and this platform is
 * not a registered adviser. The F&O example is the one where that pull is
 * strongest, and it observes the shape of the book without saying a word
 * about what to do with a position.
 */

type Row = { label: string; value: string };
type Finding = { head: string; body: string };
type Shape = { key: string; chip: string; summary: string; rows: Row[]; findings: Finding[] };

const SHAPES: Shape[] = [
  {
    key: "concentrated",
    chip: "A few big positions",
    summary: "14 stocks and 3 funds, with half the money in three names.",
    rows: [
      { label: "Holdings", value: "14 stocks, 3 funds" },
      { label: "Largest position", value: "22%" },
      { label: "Top three", value: "51%" },
      { label: "Largest sector", value: "Banking, 38%" },
      { label: "Fund overlap", value: "6 names held twice" },
      { label: "Cash", value: "4%" },
    ],
    findings: [
      {
        head: "Half the book is in three names",
        body: "Concentration is a decision, and it is worth knowing whether this one was made on purpose or arrived at one buy at a time.",
      },
      {
        head: "The funds are less diversified than the count suggests",
        body: "Two of the three hold six of the same companies, and those companies are also held directly. One position is being taken three ways.",
      },
      {
        head: "The portfolio carries a sector tilt",
        body: "Banking is 38% of the book. That is a view on banking, whether or not it was described as one.",
      },
    ],
  },
  {
    key: "scattered",
    chip: "A long list of small ones",
    summary: "41 stocks and 9 funds, with nothing large enough to matter on its own.",
    rows: [
      { label: "Holdings", value: "41 stocks, 9 funds" },
      { label: "Largest position", value: "4%" },
      { label: "Top three", value: "11%" },
      { label: "Largest sector", value: "IT, 19%" },
      { label: "Fund overlap", value: "23 names held twice" },
      { label: "Cash", value: "2%" },
    ],
    findings: [
      {
        head: "Fifty positions is more than a person can follow",
        body: "At 4% for the largest, no single holding changes the total much either way. It is worth asking which of these you could still explain the reason for.",
      },
      {
        head: "The nine funds behave like rather fewer",
        body: "Twenty-three companies appear in more than one of them. The count says nine decisions; the holdings underneath say something closer to three.",
      },
      {
        head: "The spread has a shape anyway",
        body: "IT is 19% across the direct holdings and the funds together — a larger position than any name on the list, arrived at without being chosen.",
      },
    ],
  },
  {
    key: "derivatives",
    chip: "Mostly F&O",
    summary: "A small cash book, and most of the risk in open positions.",
    rows: [
      { label: "Holdings", value: "6 stocks, 1 fund" },
      { label: "Open F&O", value: "11 positions" },
      { label: "Cash book", value: "38%" },
      { label: "Margin used", value: "62%" },
      { label: "Same underlying", value: "7 of 11" },
      { label: "Cash", value: "9%" },
    ],
    findings: [
      {
        head: "The holdings are not where the risk is",
        body: "The six stocks are 38% of the capital. The margin behind the open positions is the larger number, and it is the one that moves day to day.",
      },
      {
        head: "Eleven positions, fewer views",
        body: "Seven of the eleven are on the same underlying. That is one opinion expressed several times, which reads as diversification on a statement and is not.",
      },
      {
        head: "The book turns over faster than it gets reviewed",
        body: "Positions this short-dated are decided weekly and looked at as a whole rarely. The session is often the first time somebody has seen all eleven on one page.",
      },
    ],
  },
];

export default function AuditExample() {
  const [key, setKey] = useState(SHAPES[0].key);
  const shape = SHAPES.find((s) => s.key === key) ?? SHAPES[0];

  return (
    <div className="spec">
      {/*
        The flag is the first thing in the block and the closing line repeats
        it, because this is the one place on the site where being mistaken
        for a real client's numbers would matter.
      */}
      <p className="spec-flag">
        <span className="eyebrow">An example — not a client</span>
        <span className="spec-note">
          Invented to show the shape of a review. All three describe nobody, and no Landline
          session has been reproduced here.
        </span>
      </p>

      {/*
        Radio rather than tabs: these are three answers to one question, and
        the question is asked out loud so the row is not just decoration.
      */}
      <div className="spec-pick" role="radiogroup" aria-label="Which of these looks most like your portfolio?">
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

      <div className="spec-body">
        <div className="spec-col">
          <p className="eyebrow">What was sent in</p>
          <dl className="rec spec-rec">
            {shape.rows.map((r) => (
              <div key={r.label}>
                <dt>{r.label}</dt>
                <dd>{r.value}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="spec-col">
          <p className="eyebrow">What the expert said back</p>
          <ol className="spec-findings">
            {shape.findings.map((f) => (
              <li key={f.head}>
                <h3>{f.head}</h3>
                <p>{f.body}</p>
              </li>
            ))}
          </ol>
          <p className="spec-not">
            What a review does not contain: what to buy, what to sell, or a price target. That is
            the difference between a review and a tip.
          </p>
        </div>
      </div>
    </div>
  );
}
