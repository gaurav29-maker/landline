import { BRAND_BLUE, ON_ACCENT } from "@/lib/brand";

/**
 * The app icon's mark, drawn once for every size that needs it.
 *
 * WHAT IT IS. A line with a point at each end — the direct line, which is
 * the product, the tagline and the name. Not a telephone handset: a
 * marketplace whose first promise is "not a tip service" does not want
 * the icon every tipping app in the Play Store already uses, and a
 * handset at 16px is an indistinct blob anyway.
 *
 * It is also the site's own hairline. The rules between the audit beats,
 * between the record rows and under every testimonial name are the same
 * stroke; the icon is that stroke with its two ends made visible.
 *
 * DRAWN IN BOXES, NOT SVG. next/og renders through Satori, whose SVG
 * support is narrower than its flexbox support. Three divs in a row
 * cannot be mis-rasterised.
 *
 * EVERY DIMENSION IS A RATIO of the canvas, because this is rendered at
 * 32px for a browser tab and 180px for a Home Screen and the two must be
 * the same drawing rather than two drawings that resemble each other.
 */
export function Mark({ size, inset }: { size: number; inset: number }) {
  /*
     Weights set by looking at the render rather than by picking round
     numbers. At a 0.46 span with a 0.055 stroke the mark read as a small
     dumbbell adrift in a blue field; Apple's grid carries the key shape
     at far more weight than that. The span barely moved — the stroke and
     the two points did the work.
  */
  const span = Math.round(size * 0.56);
  const dot = Math.max(3, Math.round(size * 0.17));
  const stroke = Math.max(2, Math.round(size * 0.08));

  return (
    <div
      style={{
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: BRAND_BLUE,
        /*
           iOS masks the Home Screen icon with its own continuous-corner
           squircle, so an app icon is drawn full bleed and square and
           rounds ITSELF nowhere. A browser tab is not masked, so the
           favicon does round itself. That is the whole reason this takes
           an inset: same mark, two different jobs at the edge.
        */
        borderRadius: inset,
      }}
    >
      <div style={{ width: span, display: "flex", alignItems: "center" }}>
        <div
          style={{
            width: dot,
            height: dot,
            borderRadius: dot,
            background: ON_ACCENT,
          }}
        />
        <div style={{ flex: 1, height: stroke, background: ON_ACCENT }} />
        <div
          style={{
            width: dot,
            height: dot,
            borderRadius: dot,
            background: ON_ACCENT,
          }}
        />
      </div>
    </div>
  );
}
