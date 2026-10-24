import { INTAKE_RETENTION_DAYS } from "@/lib/constants";

/**
 * The worked example, and the file it produces.
 *
 * LIFTED OUT OF components/AuditExample so two things can share it: the
 * card on the home page that shows eight lines of a record, and the route
 * that hands over the whole file. A visitor who wants to read the artefact
 * before paying should get the same artefact the card is quoting, not a
 * second one written to look like it.
 *
 * Nothing here is client-only, so it carries no "use client" and a route
 * handler can import it.
 *
 * Everything in it is invented. Three shapes, no security named, nobody
 * described — the reasoning is in the component that renders it, and the
 * footnote under that card says so to the reader.
 */

export function head(title: string): string[] {
  return ["", title.toUpperCase(), "-".repeat(title.length), ""];
}

export type Shape = {
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

export const EXPERT = "Gaurav Khona";

export const SHAPES: Shape[] = [
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
export function recordFor(s: Shape): string {
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
