/**
 * What the thing is for, as a row of cards you push sideways.
 *
 * editlobby.com's "Our Work" block, measured off the live page: a pill
 * label — 50px radius, 1px of rgba(255,255,255,0.1), backdrop-blur(10px),
 * 14px at 700 — then 64px of air, then a horizontal carousel of 9:16
 * portrait cards 255x453 with 20px of radius and a 10px gap, scrolling
 * under a hidden scrollbar with the next card cut off at the right edge.
 *
 * WHAT GOES IN THEM IS THE WHOLE QUESTION. Theirs are video stills of
 * work they have delivered. We have delivered none: Landline has one
 * expert and no completed sessions, so a row of cards headed "Our Work"
 * would be six lies in a trenchcoat. The heading is what it is FOR, which
 * is true on day one and still true at a thousand sessions.
 *
 * The cards are the questions somebody can arrive with. Written as
 * examples and said so under the row — the same discipline the audit
 * card's footnote holds to. Nobody is quoted. No security is named: the
 * chips are shapes, and a shape carries no ticker.
 *
 * TWO VOICES, AND THEY ARE SET DIFFERENTLY. The expert's question in the
 * audit card is Instrument Serif, italic. The member's question here is
 * the sans, upright. One page, two people, and you can tell which is
 * speaking without being told.
 */

type Ask = {
  /** The shape of the book, which is what the chip says. */
  tag: string;
  /** What they arrive with, in their own words. */
  ask: string;
  /** What the call does with it. Not what it concludes. */
  does: string;
};

const ASKS: Ask[] = [
  {
    tag: "Concentrated",
    ask: "Half of it is in three names. Is that a decision or an accident?",
    does: "Most of the hour on the three.",
  },
  {
    tag: "Scattered",
    ask: "I own fifty things and I cannot tell you why I own most of them.",
    does: "Gone through, one at a time.",
  },
  {
    tag: "Derivatives",
    ask: "Eleven open positions, seven on the same index. Am I taking one risk eleven times?",
    does: "Read as one book, not eleven.",
  },
  {
    tag: "Inherited",
    ask: "This was my father’s. I have never touched it and I do not know what is in it.",
    does: "Read out loud, line by line.",
  },
  {
    tag: "First year",
    ask: "I started in January. I do not know whether I am doing anything wrong yet.",
    does: "A second opinion before the habits set.",
  },
  {
    tag: "Overlap",
    ask: "Four funds and twenty stocks. How much of it is the same company twice?",
    does: "The funds looked through, not counted.",
  },
];

export default function QuestionsStrip() {
  return (
    <div className="work">
      {/* The pill is the section's heading, not a label above one. */}
      <h2 className="band-pill">What it is for</h2>

      {/*
        A scroll container is only reachable with a keyboard if it can take
        focus, so it does — role and label included, because a focusable
        div with neither is a trap rather than a control. No arrows: the
        card cut off at the right edge is the affordance, which is how
        theirs says it too.
      */}
      <div
        className="work-rail"
        tabIndex={0}
        role="group"
        aria-label="Questions a Landline session is for. Scroll sideways for more."
      >
        {ASKS.map((a, n) => (
          <article className="work-card" key={a.tag} data-tone={n % 3}>
            <span className="work-tag">{a.tag}</span>
            <p className="work-ask">{a.ask}</p>
            <p className="work-does">{a.does}</p>
          </article>
        ))}
      </div>

      <p className="work-note">
        Written as examples of what a session is for. Nobody is quoted, and no security is named.
      </p>
    </div>
  );
}
