import { recordFor, SHAPES } from "@/lib/sample-record";

export const runtime = "nodejs";
export const dynamic = "force-static";

/**
 * The example record, whole, for anyone who has not paid.
 *
 * The card on the home page shows the first eight lines of
 * landline-2026-09-16-gaurav-khona.txt and then stops. This hands over the
 * rest. It is the only artefact a visitor can hold before buying anything,
 * and it is the strongest thing the page has: not a description of what you
 * get, the thing itself.
 *
 * SAME SOURCE AS THE CARD. Both read lib/sample-record, so the file
 * somebody downloads cannot drift from the file they were shown — which it
 * would, the first time one of them was edited and the other was not.
 *
 * NOT A REAL SESSION, and the file says so in its own closing lines before
 * anybody has to take our word for it. Nobody is described, no security is
 * named, no Landline session has been reproduced.
 *
 * force-static because the content is a constant. It is the same bytes for
 * every visitor, so it should be built once rather than assembled per
 * request.
 */
export function GET() {
  const shape = SHAPES[0];
  const body = [
    "LANDLINE — EXAMPLE SESSION RECORD",
    "",
    "This is a sample, not a client. Nobody below is a real person, no",
    "security is named, and no Landline session has been reproduced here.",
    "A real record has the same shape and is yours to keep.",
    "",
    "-".repeat(68),
    recordFor(shape),
  ].join("\n");

  return new Response(body, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      /*
         inline, not attachment. A download that starts on click is a
         download somebody has to go and find; this opens in the tab, which
         is where a person deciding whether to pay actually wants it. The
         filename is still set, so saving it keeps a sensible name.
      */
      "content-disposition": `inline; filename="landline-example-record.txt"`,
      "cache-control": "public, max-age=3600, s-maxage=86400",
    },
  });
}
