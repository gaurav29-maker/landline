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
    does: "Most of the call on the three.",
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
        ZERODHA'S, AND THE CARDS ARE GONE.

        Their homepage was read rather than remembered, at 1280:

          container   1100px
          h2          24px / 500 / lh 36 / #424242, margin 0 0 40px
          h3          20px / 500 / lh 32 / #424242, margin 0
          p           16px / 400 / lh 28.8 / #666666, margin 5px 0 32px
          link        16px / 500 / #387ED1, no underline
          letter-spacing: normal, everywhere
          no cards, no borders, no radius, no shadows, no fills

        The whole system is four type sizes, two weights and two greys on
        white. The only colour on the page is the link blue — and it is
        #387ED1, which is this site's --accent to the byte. We were
        already using their blue.

        WHAT THAT MEANS FOR THIS SECTION. Every card went: the gradient
        grounds, the 22px radius, the 28px of padding, the chip behind
        the tag and the rule above the closing line. Zerodha would not
        draw a box around a sentence. What is left is the sentence, a
        label over it and a line under it, with air doing the separating
        that six rectangles were doing before.

        The questions, the labels and the closing lines are unchanged —
        this is a change of setting, not of content.

        TWO OF THEIRS THAT ARE NOT TAKEN, both on purpose:

        Inter. Theirs is Inter throughout; ours stays Satoshi, because
        the instruction on this site is to use its own faces and the
        scale is the transferable part.

        The white ground. Theirs is white and this band is in the dark
        run that starts at the audit card — a page-level rhythm, not a
        section decision. The restraint survives the ground; the type
        below reads the same on either.
      */}
      <div className="work-list">
        {ASKS.map((a) => (
          <div className="work-item" key={a.tag}>
            <p className="work-tag">{a.tag}</p>
            <h3 className="work-ask">{a.ask}</h3>
            <p className="work-does">{a.does}</p>
          </div>
        ))}
      </div>

      <p className="work-note">
        Written as examples of what a session is for. Nobody is quoted, and no security is named.
      </p>
    </div>
  );
}
