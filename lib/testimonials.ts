/**
 * What people said, once anyone has said anything.
 *
 * EMPTY ON PURPOSE. The section that reads this renders nothing at all
 * while the list is empty, so the page loses a slot rather than showing a
 * heading with nothing under it.
 *
 * It is empty rather than seeded because a fabricated review is not a
 * placeholder, it is a false statement to a consumer. Under the Consumer
 * Protection Act 2019 and the CCPA's 2022 guidelines on misleading
 * advertisements, publishing invented endorsements is an unfair trade
 * practice — and doing it on a page that sells portfolio reviews to retail
 * investors is the worst available place to try it.
 *
 * ADDING THE FIRST ONE
 *
 * After a real session, ask the member two questions: what did you bring,
 * and what changed. Their answer is the quote. Then get their agreement in
 * writing to publish it, and ask how they want to be named — full name,
 * first name and city, or initials. Any of those is fine; inventing one is
 * not.
 *
 *   { quote: "…", name: "…", note: "…" }
 *
 * `note` is whatever makes the person real to a stranger without
 * identifying them further than they agreed to: "F&O trader, Pune", "runs
 * a 14-stock book", "member since March". Never a firm they did not say.
 *
 * Three reads best in the grid. Two is fine. One is fine — one real
 * sentence from one real person outruns three invented paragraphs, which
 * is the entire reason this file starts empty.
 */
export type Testimonial = {
  /** Their words. Not tidied into marketing copy — the flatness is the proof. */
  quote: string;
  /** However they agreed to be named. */
  name: string;
  /** A detail that places them, within what they consented to. */
  note?: string;
};

export const TESTIMONIALS: Testimonial[] = [];
